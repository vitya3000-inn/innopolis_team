const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { CONFIG } = require('./config');

const CACHE_PATH = path.join(__dirname, 'data', 'llm-cache.json');

function loadCache() {
  try {
    if (fs.existsSync(CACHE_PATH)) {
      return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    }
  } catch {
    // ignore
  }
  return {};
}

function saveCache(cache) {
  const dir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
}

function hashInput(event) {
  const text = `${event.id}|${event.title}|${(event.summary || '').slice(0, 800)}|${(event.opinions || [])
    .slice(0, CONFIG.openaiMaxSnippetsPerEvent)
    .map((o) => (o.summary || '').slice(0, 160))
    .join('|')}`;
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function parseJsonFromContent(content) {
  const trimmed = (content || '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('Invalid JSON from OpenAI');
  }
}

async function callChatCompletions(messages, maxTokens) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CONFIG.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: CONFIG.openaiModel,
      messages,
      temperature: 0.15,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI ${res.status}: ${body}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI empty response');
  return content;
}

function jsonStringifySafe(value) {
  return JSON.stringify(value)
    .replace(/[^\S\r\n]+/g, ' ')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Один запрос на батч событий: минимум токенов на выходе, строгий JSON.
 */
async function enrichBatch(events) {
  const lang = (CONFIG.targetLanguage || 'en').toLowerCase() === 'ru' ? 'ru' : 'en';
  const compact = events.map((e) => ({
    id: e.id,
    title: (e.title || '').slice(0, 220),
    lead: (e.summary || '').slice(0, 420),
    snippets: (e.opinions || [])
      .slice(0, CONFIG.openaiMaxSnippetsPerEvent)
      .map((o) => (o.summary || '').slice(0, 140)),
    mentionsCount: Number(e.mentionsCount || 1),
  }));

  const userPayload = jsonStringifySafe(compact);
  const maxTokens = Math.min(
    CONFIG.openaiMaxTokensPerBatch,
    180 + events.length * 160,
  );

  const content = await callChatCompletions(
    [
      {
        role: 'system',
        content: [
          'You help structure news for a mobile MVP.',
          'Use ONLY facts present in the input. Do not invent names, numbers, dates.',
          'If unsure, keep it shorter and more general.',
          lang === 'ru' ? 'Write in Russian.' : 'Write in English.',
          lang === 'ru'
            ? 'Translate/normalize all output fields into Russian (including "topic", "title", "summary", "analysis", "keyFacts"), preserving proper nouns.'
            : '',
          'Return strict JSON only, schema:',
          '{"events":[{"id":"...","topic":"<short topic name>","relevance":0.0,"title":"<short>","summary":"2-3 sentences","keyFacts":["..."],"analysis":["..."]}]}',
          'Rules:',
          '"topic" must be specific to the current news hook (инфоповод), not generic. Avoid titles like "International relations", "Political campaigns".',
          'Make "topic" 3-7 words and include at least one named entity (country/person/org) when possible.',
          '"relevance" is 0..1: how well the event fits its topic; set <0.45 if weak/unclear.',
          '"analysis" is 3-5 bullets: what happened, why it matters, what to watch next (all grounded in input snippets).',
          '"keyFacts" must be concrete facts from the text (actions, decisions, incidents, claims attributed to a source). Do NOT output meta like "mentions count", "last update", or generic filler.',
          'If the input does not contain at least 2 concrete facts, return fewer items in "keyFacts".',
        ].join(' '),
      },
      {
        role: 'user',
        content:
          'Task: For each event, return JSON only (no trailing commas). ' +
          'Input JSON array:\n' +
          userPayload,
      },
    ],
    maxTokens,
  );

  const parsed = parseJsonFromContent(content);
  const list = Array.isArray(parsed.events) ? parsed.events : [];
  const byId = new Map(list.map((row) => [row.id, row]));

  return events.map((e) => {
    const row = byId.get(e.id);
    if (!row || !row.summary) return e;
    const facts = Array.isArray(row.keyFacts)
      ? row.keyFacts.filter(Boolean).slice(0, 4)
      : [];
    const analysis = Array.isArray(row.analysis)
      ? row.analysis
          .filter(Boolean)
          .slice(0, 5)
          .map((x) => String(x).trim())
          .filter(Boolean)
      : [];
    const topic = row.topic ? String(row.topic).trim().slice(0, 64) : '';
    const relevanceRaw = Number(row.relevance);
    const relevance = Number.isFinite(relevanceRaw) ? Math.max(0, Math.min(1, relevanceRaw)) : null;
    return {
      ...e,
      title: row.title ? String(row.title).trim().slice(0, 180) : e.title,
      summary: String(row.summary).trim(),
      keyFacts: facts.length ? facts : e.keyFacts,
      analysis: analysis.length ? analysis : e.analysis,
      llmTopic: topic || e.llmTopic,
      llmTopicRelevance: relevance ?? e.llmTopicRelevance,
      llmEnriched: true,
    };
  });
}

/**
 * Экономия: кэш по хешу текста, батчи по N событий, верхний лимит за один refresh.
 */
async function enrichEventsWithLLM(events) {
  if (!CONFIG.openaiApiKey || CONFIG.openaiMaxEventsPerRefresh <= 0) {
    return events;
  }

  const cache = loadCache();
  const maxTotal = CONFIG.openaiMaxEventsPerRefresh;
  const head = events.slice(0, maxTotal);
  const tail = events.slice(maxTotal);

  const out = [];
  let batch = [];

  async function flush() {
    if (!batch.length) return;
    const chunk = batch;
    batch = [];
    try {
      const enriched = await enrichBatch(chunk.map((c) => c.event));
      enriched.forEach((ev, i) => {
        const { cacheKey } = chunk[i];
        cache[cacheKey] = {
          summary: ev.summary,
          keyFacts: ev.keyFacts,
          analysis: ev.analysis,
          llmTopic: ev.llmTopic,
          llmTopicRelevance: ev.llmTopicRelevance,
          at: new Date().toISOString(),
        };
        out.push(ev);
      });
      saveCache(cache);
    } catch (error) {
      console.warn('[llm] batch failed:', error.message);
      chunk.forEach((c) => out.push(c.event));
    }
  }

  for (const event of head) {
    const cacheKey = `${event.id}:${hashInput(event)}`;
    const hit = cache[cacheKey];
    if (hit && hit.summary) {
      out.push({
        ...event,
        summary: hit.summary,
        keyFacts: hit.keyFacts || event.keyFacts,
        analysis: hit.analysis || event.analysis,
        llmTopic: hit.llmTopic || event.llmTopic,
        llmTopicRelevance:
          typeof hit.llmTopicRelevance === 'number' ? hit.llmTopicRelevance : event.llmTopicRelevance,
        llmEnriched: true,
      });
      continue;
    }

    batch.push({ event, cacheKey });
    if (batch.length >= CONFIG.openaiBatchSize) {
      await flush();
    }
  }

  await flush();

  return [...out, ...tail];
}

module.exports = { enrichEventsWithLLM };
