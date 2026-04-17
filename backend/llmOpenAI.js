const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { CONFIG } = require('./config');
const { resolveFixedTopic } = require('./cluster');
const { stripNewsApiTruncationMeta } = require('./newsTextCleanup');

/** В карточке «AI Summary» не показываем длинный текст уровня полной цитаты источника. */
const AI_SUMMARY_MAX_CHARS = 400;

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

function cacheKeyForEvent(event) {
  return `${event.id}:${hashInput(event)}:${CONFIG.openaiLlmCacheKeySuffix}`;
}

function stripTrailingCommasInJson(text) {
  let s = text;
  let prev = '';
  while (s !== prev) {
    prev = s;
    s = s.replace(/,(\s*[}\]])/g, '$1');
  }
  return s;
}

function parseJsonFromContent(content) {
  const trimmed = (content || '').trim();
  const candidates = [trimmed, stripTrailingCommasInJson(trimmed)].filter(Boolean);
  const uniq = [...new Set(candidates)];

  for (const t of uniq) {
    try {
      return JSON.parse(t);
    } catch {
      /* try next */
    }
  }

  const start = trimmed.indexOf('{');
  if (start < 0) throw new Error('Invalid JSON from OpenAI');
  const body = stripTrailingCommasInJson(trimmed.slice(start));

  let last = body.lastIndexOf('}');
  let attempts = 0;
  const maxAttempts = 100;
  while (last > 0 && attempts < maxAttempts) {
    attempts += 1;
    try {
      return JSON.parse(body.slice(0, last + 1));
    } catch {
      last = body.lastIndexOf('}', last - 1);
    }
  }

  throw new Error('Invalid JSON from OpenAI');
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
      temperature: 0.1,
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

function stripInternalFields(event) {
  const { _fixedTopicTitle, ...rest } = event;
  return rest;
}

function normalizeBlanks(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function longestOpinionSummary(ev) {
  let m = '';
  for (const o of ev.opinions || []) {
    const t = (o.summary || '').trim();
    if (t.length > m.length) m = t;
  }
  return m;
}

function extractiveShortSummary(text, maxChars) {
  let t = stripNewsApiTruncationMeta(String(text || '').replace(/\n+/g, ' ').trim());
  if (!t) return '';
  if (t.length <= maxChars) return t;
  const sentences = t.split(/(?<=[.!?…])\s+/).filter(Boolean);
  let out = '';
  for (const sent of sentences) {
    const piece = sent.trim();
    const next = out ? `${out} ${piece}` : piece;
    if (next.length > maxChars) {
      if (!out && piece.length > maxChars) {
        return `${piece.slice(0, maxChars).replace(/\s+\S*$/, '').trim()}…`;
      }
      break;
    }
    out = next;
  }
  if (out) return out;
  return `${t.slice(0, maxChars).replace(/\s+\S*$/, '').trim()}…`;
}

function sharedPrefixLen(a, b) {
  const x = normalizeBlanks(a);
  const y = normalizeBlanks(b);
  const n = Math.min(x.length, y.length);
  let i = 0;
  while (i < n && x[i] === y[i]) i += 1;
  return i;
}

function summaryFromAnalysisOrFacts(ev, maxChars) {
  const bullets = (ev.analysis || []).filter(Boolean).map(String);
  if (bullets.length) {
    const joined = bullets.slice(0, 3).join(' ');
    return extractiveShortSummary(joined, maxChars);
  }
  const facts = (ev.keyFacts || [])
    .filter(Boolean)
    .map(String)
    .filter((f) => !/упоминаний в источниках|источник-лидер|последнее обновление/i.test(f));
  if (facts.length) {
    return extractiveShortSummary(facts.slice(0, 3).join(' '), maxChars);
  }
  return null;
}

/**
 * Единый слой для UI: блок «AI Summary» всегда короче основного текста в «Позициях СМИ».
 */
function finalizeEventSummariesForUi(events) {
  return events.map((ev) => {
    const summary = (ev.summary || '').trim();
    const longBody = longestOpinionSummary(ev);
    const maxC = AI_SUMMARY_MAX_CHARS;
    const enriched = Boolean(ev.llmEnriched);

    if (!summary && longBody) {
      return { ...ev, summary: extractiveShortSummary(longBody, maxC) };
    }

    if (!enriched) {
      return { ...ev, summary: extractiveShortSummary(summary || longBody, maxC) };
    }

    if (summary.length > maxC) {
      return { ...ev, summary: extractiveShortSummary(summary, maxC) };
    }

    if (longBody.length > 140 && summary.length > 80) {
      const prefix = sharedPrefixLen(summary, longBody);
      const threshold = Math.min(220, Math.max(90, Math.floor(summary.length * 0.88)));
      if (prefix >= threshold) {
        const alt = summaryFromAnalysisOrFacts(ev, maxC);
        if (alt) return { ...ev, summary: alt };
        return { ...ev, summary: extractiveShortSummary(longBody, maxC) };
      }
    }

    return ev;
  });
}

/**
 * Первый проход: summary, факты, relevance с учётом фиксированной секции приложения (если есть).
 */
async function enrichBatch(events) {
  const lang = (CONFIG.targetLanguage || 'en').toLowerCase() === 'ru' ? 'ru' : 'en';
  const compact = events.map((e) => ({
    id: e.id,
    appFixedTopicTitle: e._fixedTopicTitle || null,
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
    400 + events.length * 260,
  );

  const fixedTopicRules = [
    'When "appFixedTopicTitle" is a non-empty string, field "relevance" (0..1) measures ONLY how well this story belongs under that exact app section title.',
    'Be strict: same country or leader in the news is NOT enough. Domestic economy, culture, sports, unrelated cabinet moves, tech product news → relevance below 0.4 unless clearly tied to that section theme.',
    'For a military/conflict section: require hostilities, occupied areas, peace talks about THAT conflict, military aid/sanctions clearly about THAT war, humanitarian crisis in the theater, etc.',
    'If the story is tangential (shared keyword but different story) → relevance < 0.45.',
  ].join(' ');

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
          fixedTopicRules,
          'Return strict JSON only, schema:',
          '{"events":[{"id":"...","topic":"<short topic name>","relevance":0.0,"title":"<short>","summary":"2-3 sentences","keyFacts":["..."],"analysis":["..."]}]}',
          'Rules:',
          '"topic" must be specific to the current news hook (инфоповод), not generic. Avoid titles like "International relations", "Political campaigns".',
          'Make "topic" 3-7 words and include at least one named entity (country/person/org) when possible.',
          'When appFixedTopicTitle is null, "relevance" is how coherent the story is for its own hook; set <0.45 if weak/unclear.',
          '"analysis" is 3-5 bullets: what happened, why it matters, what to watch next (all grounded in input snippets).',
          '"keyFacts" must be concrete facts from the text (actions, decisions, incidents, claims attributed to a source). Do NOT output meta like "mentions count", "last update", or generic filler.',
          'If the input does not contain at least 2 concrete facts, return fewer items in "keyFacts".',
          'CRITICAL for "summary": write a NEW brief synthesis in at most 55 words (2-3 short sentences). It must compress the whole story; do NOT paste or lightly rephrase the "lead" field; do NOT repeat long phrases from snippets. If you only copy the input, the product breaks.',
        ].join(' '),
      },
      {
        role: 'user',
        content:
          'Task: For each event, return JSON only (no trailing commas). ' +
          'The "summary" field must be a tight distillation (max ~55 words), not a copy of "lead". ' +
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
 * Второй проход: независимая самопроверка — относится ли инфоповод к заданной секции приложения.
 */
async function verifyFixedTopicBatch(events) {
  if (!events.length) return new Map();

  const lang = (CONFIG.targetLanguage || 'en').toLowerCase() === 'ru' ? 'ru' : 'en';
  const compact = events.map((e) => ({
    id: e.id,
    appSectionTitle: e._fixedTopicTitle,
    title: (e.title || '').slice(0, 220),
    summary: (e.summary || '').slice(0, 420),
    snippets: (e.opinions || [])
      .slice(0, Math.min(3, CONFIG.openaiMaxSnippetsPerEvent))
      .map((o) => (o.summary || '').slice(0, 130)),
  }));

  const userPayload = jsonStringifySafe(compact);
  const maxTokens = Math.min(
    CONFIG.openaiVerifyMaxTokens,
    160 + events.length * 90,
  );

  const content = await callChatCompletions(
    [
      {
        role: 'system',
        content: [
          'You are an independent senior editor performing a SECOND, SEPARATE review.',
          'Do not assume any prior classification was correct. Base your answer only on appSectionTitle and the text fields.',
          'For each item, decide if the news story substantively belongs in that app section.',
          'belongs=false if: same country/keywords appear but the story is a different subject (domestic politics, markets, tech, culture, sports, elections unrelated to the conflict, generic diplomacy); or only a vague mention.',
          'belongs=true only if the main hook clearly matches the section theme (e.g. named conflict/war/humanitarian/military/diplomatic escalation directly about that theater).',
          lang === 'ru' ? 'Write reason_one_line in Russian.' : 'Write reason_one_line in English.',
          'Return strict JSON only, schema:',
          '{"verifications":[{"id":"...","belongs":true,"confidence":0.0,"reason_one_line":"..."}]}',
          'confidence is 0..1 (how sure you are). If belongs=false, confidence should still reflect your certainty.',
        ].join(' '),
      },
      {
        role: 'user',
        content:
          'Second-pass verification task. Return JSON only.\n' +
          'Input:\n' +
          userPayload,
      },
    ],
    maxTokens,
  );

  const parsed = parseJsonFromContent(content);
  const list = Array.isArray(parsed.verifications) ? parsed.verifications : [];
  const map = new Map();
  for (const row of list) {
    if (!row || !row.id) continue;
    const confidenceRaw = Number(row.confidence);
    const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0.65;
    map.set(String(row.id), {
      belongs: Boolean(row.belongs),
      confidence,
    });
  }
  return map;
}

function applyVerificationResults(events, verificationMap) {
  const rejectBelow = Math.max(0.15, CONFIG.openaiMinTopicRelevance - 0.25);

  return events.map((ev) => {
    if (!ev._fixedTopicTitle) return ev;

    const v = verificationMap.get(ev.id);
    if (!v) return ev;

    const firstPass =
      typeof ev.llmTopicRelevance === 'number' && Number.isFinite(ev.llmTopicRelevance)
        ? ev.llmTopicRelevance
        : 0.55;

    if (!v.belongs) {
      return {
        ...ev,
        llmTopicRelevance: rejectBelow,
        llmVerifyRejected: true,
        llmVerifyConfidence: v.confidence,
      };
    }

    const combined = Math.min(firstPass, v.confidence);
    return {
      ...ev,
      llmTopicRelevance: combined,
      llmVerifyRejected: false,
      llmVerifyConfidence: v.confidence,
    };
  });
}

/**
 * Экономия: кэш по хешу текста, батчи по N событий, верхний лимит за один refresh.
 */
async function enrichEventsWithLLM(events) {
  if (!CONFIG.openaiApiKey || CONFIG.openaiMaxEventsPerRefresh <= 0) {
    return finalizeEventSummariesForUi(events);
  }

  const cache = loadCache();
  const maxTotal = CONFIG.openaiMaxEventsPerRefresh;
  const head = events.slice(0, maxTotal);
  const tail = events.slice(maxTotal);

  const out = [];
  let batch = [];

  async function processEnrichChunk(chunk) {
    if (!chunk.length) return;

    const hinted = chunk.map((c) => ({
      ...c.event,
      _fixedTopicTitle: resolveFixedTopic(c.event)?.title || null,
    }));

    let enriched;
    try {
      enriched = await enrichBatch(hinted);
    } catch (err) {
      if (chunk.length > 1) {
        const mid = Math.ceil(chunk.length / 2);
        await processEnrichChunk(chunk.slice(0, mid));
        await processEnrichChunk(chunk.slice(mid));
        return;
      }
      console.warn('[llm] batch failed:', err.message);
      chunk.forEach((c) => out.push(c.event));
      return;
    }

    const needsVerify = CONFIG.openaiVerifyFixedTopic
      ? enriched.filter((e) => e._fixedTopicTitle)
      : [];

    if (needsVerify.length > 0) {
      try {
        const vMap = new Map();
        for (let i = 0; i < needsVerify.length; i += CONFIG.openaiBatchSize) {
          const slice = needsVerify.slice(i, i + CONFIG.openaiBatchSize);
          const part = await verifyFixedTopicBatch(slice);
          part.forEach((val, key) => vMap.set(key, val));
        }
        enriched = applyVerificationResults(enriched, vMap);
      } catch (err) {
        console.warn('[llm] verification batch failed:', err.message);
      }
    }

    enriched.forEach((ev, i) => {
      const { cacheKey } = chunk[i];
      const clean = stripInternalFields(ev);
      cache[cacheKey] = {
        summary: clean.summary,
        keyFacts: clean.keyFacts,
        analysis: clean.analysis,
        llmTopic: clean.llmTopic,
        llmTopicRelevance: clean.llmTopicRelevance,
        llmVerifyRejected: clean.llmVerifyRejected,
        llmVerifyConfidence: clean.llmVerifyConfidence,
        at: new Date().toISOString(),
      };
      out.push(clean);
    });
    saveCache(cache);
  }

  async function flush() {
    if (!batch.length) return;
    const chunk = batch;
    batch = [];
    await processEnrichChunk(chunk);
  }

  for (const event of head) {
    const cacheKey = cacheKeyForEvent(event);
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
        ...(typeof hit.llmVerifyRejected === 'boolean'
          ? { llmVerifyRejected: hit.llmVerifyRejected, llmVerifyConfidence: hit.llmVerifyConfidence }
          : {}),
      });
      continue;
    }

    batch.push({ event, cacheKey });
    if (batch.length >= CONFIG.openaiBatchSize) {
      await flush();
    }
  }

  await flush();

  return finalizeEventSummariesForUi([...out, ...tail]);
}

module.exports = {
  enrichEventsWithLLM,
  finalizeEventSummariesForUi,
  callChatCompletions,
  parseJsonFromContent,
};
