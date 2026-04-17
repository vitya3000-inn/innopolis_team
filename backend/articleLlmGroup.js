/**
 * Двухэтапная кластеризация статей в события:
 * 1) clusterArticlesStageOneTopicAware — без LLM (тема + Jaccard + редкие сущности).
 * 2) Батчи в OpenAI: в одном запросе несколько статей одной фикс-темы (по счёту, не по узкому окну времени).
 * 3) После Union-Find — отсечение «висяков» по Jaccard к лидеру (анти-ложные склейки вроде Kenya+другая история).
 */

const { CONFIG } = require('./config');
const { callChatCompletions, parseJsonFromContent } = require('./llmOpenAI');
const {
  FIXED_TOPICS,
  clusterArticlesIntoEvents,
  clusterArticlesStageOneTopicAware,
  articleStableId,
  buildMergedEventFromArticles,
  detectFixedTopicForArticle,
  buildCommonTokenFilter,
  similarityDiscriminativeWithFilter,
  similarity,
} = require('./cluster');
const { plainTextFromHtml, stripNewsApiTruncationMeta } = require('./newsTextCleanup');

class UnionFind {
  constructor() {
    this.parent = new Map();
  }

  make(x) {
    if (!this.parent.has(x)) this.parent.set(x, x);
  }

  find(x) {
    if (!this.parent.has(x)) this.make(x);
    let p = this.parent.get(x);
    if (p === x) return x;
    const r = this.find(p);
    this.parent.set(x, r);
    return r;
  }

  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

function jsonStringifySafe(value) {
  return JSON.stringify(value)
    .replace(/[^\S\r\n]+/g, ' ')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function firstSnippet(text, maxLen) {
  const t = stripNewsApiTruncationMeta((text || '').replace(/\s+/g, ' ').trim());
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen);
  const dot = cut.lastIndexOf('. ');
  if (dot > Math.min(100, maxLen * 0.35)) return cut.slice(0, dot + 1);
  const sp = cut.lastIndexOf(' ');
  if (sp > maxLen * 0.55) return cut.slice(0, sp).trim();
  return cut.trim();
}

function normalizeUrlKey(u) {
  return String(u || '')
    .trim()
    .toLowerCase()
    .replace(/[#?].*$/, '');
}

function articleSingletonMergeText(a) {
  const c = plainTextFromHtml(a.content || '').slice(0, 480);
  return `${a.title || ''} ${a.description || ''} ${c}`;
}

/**
 * Склеивает одностатейные события, если статьи в одной fixedTopicId, близки по времени
 * и Jaccard(title+description) ≥ порога — ловит пары, которые LLM/батчи разъединили.
 */
function mergeSingletonEventsByTextSimilarity(events, allArticles) {
  if (!events.length) return events;

  const urlToArticle = new Map();
  for (const a of allArticles) {
    const k = normalizeUrlKey(a.url);
    if (k) urlToArticle.set(k, a);
  }

  function resolveArticle(ev) {
    for (const op of ev.opinions || []) {
      const k = normalizeUrlKey(op?.articleUrl);
      if (k && urlToArticle.has(k)) return urlToArticle.get(k);
    }
    return null;
  }

  const singletons = [];
  const rest = [];
  for (const ev of events) {
    const mc = ev.mentionsCount ?? (ev.opinions?.length || 0);
    if (mc <= 1) singletons.push(ev);
    else rest.push(ev);
  }

  if (singletons.length < 2) return events;

  const resolved = [];
  const unresolved = [];
  for (const ev of singletons) {
    const art = resolveArticle(ev);
    if (art) resolved.push({ ev, art });
    else unresolved.push(ev);
  }

  if (resolved.length < 2) return events;

  const windowMs = CONFIG.openaiArticleGroupSingletonMergeHours * 60 * 60 * 1000;
  const minS = CONFIG.openaiArticleGroupSingletonMergeRawSim;
  const n = resolved.length;
  const uf2 = new UnionFind();
  for (let i = 0; i < n; i += 1) uf2.make(i);

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const ti = resolved[i].ev.fixedTopicId ?? null;
      const tj = resolved[j].ev.fixedTopicId ?? null;
      if (ti !== tj) continue;
      const a = resolved[i].art;
      const b = resolved[j].art;
      const ta = new Date(a.publishedAt).getTime();
      const tb = new Date(b.publishedAt).getTime();
      if (Number.isNaN(ta) || Number.isNaN(tb) || Math.abs(ta - tb) > windowMs) continue;
      if (similarity(articleSingletonMergeText(a), articleSingletonMergeText(b)) >= minS) uf2.union(i, j);
    }
  }

  const groups = new Map();
  for (let i = 0; i < n; i += 1) {
    const r = uf2.find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(resolved[i]);
  }

  let mergedMulti = 0;
  const fromSingletons = [];
  for (const g of groups.values()) {
    if (g.length === 1) {
      fromSingletons.push(g[0].ev);
    } else {
      mergedMulti += 1;
      fromSingletons.push(buildMergedEventFromArticles(g.map((x) => x.art)));
    }
  }

  if (mergedMulti > 0) {
    let foldedArticles = 0;
    for (const g of groups.values()) {
      if (g.length > 1) foldedArticles += g.length;
    }
    console.warn(
      `[articleLlmGroup] post-merge singletons: ${mergedMulti} multi-source event(s) (${foldedArticles} articles folded)`,
    );
  }

  return [...rest, ...fromSingletons, ...unresolved];
}

function articleFullText(a) {
  return `${a.title || ''} ${a.description || ''} ${a.content || ''}`;
}

function articleTitleDescForRawSim(a) {
  return `${a.title || ''} ${a.description || ''}`;
}

/**
 * Батчи по числу статей с перекрытием, порядок: сначала свежие.
 * Раньше обрезка по 72ч от первой статьи давала батчи из 1 статьи при редких датах — LLM никогда не видел пары для склейки.
 */
function buildOverlappingBatches(articles, batchSize, overlap) {
  const sorted = [...articles].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
  const batches = [];
  const bs = Math.max(1, batchSize);
  const ov = Math.min(Math.max(0, overlap), Math.max(0, bs - 1));
  let start = 0;
  while (start < sorted.length) {
    batches.push(sorted.slice(start, start + bs));
    const step = Math.max(1, bs - ov);
    start += step;
  }
  return batches;
}

/**
 * Сначала пара из 2 — мягкий порог. Для 3+: жадное ядро — статья входит, если похожа
 * хотя бы на одну уже в ядре (не только на «лидера» по дате), затем подхват лучшей пары к одинокому лидеру.
 */
function splitClusterByLeadSimilarity(articles, minSim, isCommonToken) {
  if (articles.length <= 1) return [articles];
  const sorted = [...articles].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
  const sim = (x, y) =>
    similarityDiscriminativeWithFilter(articleFullText(x), articleFullText(y), isCommonToken);
  const pairKeep = Math.max(
    CONFIG.openaiArticleGroupPairKeepFloor,
    minSim * CONFIG.openaiArticleGroupPairKeepLeadRatio,
  );

  if (sorted.length === 2) {
    if (sim(sorted[0], sorted[1]) >= pairKeep) return [sorted];
    const leadText = articleFullText(sorted[0]);
    const s = similarityDiscriminativeWithFilter(leadText, articleFullText(sorted[1]), isCommonToken);
    const core = s >= minSim ? sorted : [sorted[0]];
    const outliers = s >= minSim ? [] : [sorted[1]];
    const parts = [];
    if (core.length) parts.push(core);
    outliers.forEach((o) => parts.push([o]));
    return parts;
  }

  const core = [sorted[0]];
  const pool = sorted.slice(1);

  function expandGreedy() {
    let changed = true;
    while (changed && pool.length) {
      changed = false;
      for (let i = 0; i < pool.length; i++) {
        let best = 0;
        for (const c of core) {
          const s = sim(pool[i], c);
          if (s > best) best = s;
        }
        if (best >= minSim) {
          core.push(pool.splice(i, 1)[0]);
          changed = true;
          break;
        }
      }
    }
  }

  expandGreedy();

  if (core.length === 1 && pool.length) {
    let best = -1;
    let bestI = -1;
    for (let i = 0; i < pool.length; i++) {
      const s = sim(core[0], pool[i]);
      if (s > best) {
        best = s;
        bestI = i;
      }
    }
    if (best >= pairKeep) {
      core.push(pool.splice(bestI, 1)[0]);
      expandGreedy();
    }
  }

  const parts = [];
  if (core.length) parts.push(core);
  pool.forEach((o) => parts.push([o]));
  return parts;
}

/**
 * Цепочки A~B~C~D при слабом A~D: убираем статью с минимальной средней похожестью, пока все пары не ≥ порога.
 */
function peelOutliersDiscriminative(chunk, isCommonToken, minPairSim) {
  if (chunk.length < 3) return [chunk];
  const cur = [...chunk];
  const peeled = [];

  const simPair = (x, y) =>
    similarityDiscriminativeWithFilter(articleFullText(x), articleFullText(y), isCommonToken);

  while (cur.length >= 3) {
    let minPair = 2;
    for (let i = 0; i < cur.length; i += 1) {
      for (let j = i + 1; j < cur.length; j += 1) {
        const s = simPair(cur[i], cur[j]);
        if (s < minPair) minPair = s;
      }
    }
    if (minPair >= minPairSim) break;

    let worstIdx = 0;
    let worstAvg = Infinity;
    for (let i = 0; i < cur.length; i += 1) {
      let sum = 0;
      for (let j = 0; j < cur.length; j += 1) {
        if (i === j) continue;
        sum += simPair(cur[i], cur[j]);
      }
      const avg = sum / (cur.length - 1);
      if (avg < worstAvg) {
        worstAvg = avg;
        worstIdx = i;
      }
    }
    peeled.push([cur.splice(worstIdx, 1)[0]]);
  }

  const out = [];
  if (cur.length) out.push(cur);
  return out.concat(peeled);
}

function validateGroups(groups, validIds) {
  if (!Array.isArray(groups) || groups.length === 0) return false;
  const expected = new Set(validIds);
  const seen = new Set();

  for (const g of groups) {
    if (!g || !Array.isArray(g.ids) || g.ids.length === 0) return false;
    for (const id of g.ids) {
      if (typeof id !== 'string') return false;
      const normalized = id.trim();
      if (!expected.has(normalized) || seen.has(normalized)) return false;
      seen.add(normalized);
    }
  }

  return seen.size === expected.size;
}

/**
 * Приводит ответ LLM к валидному разбиению: убирает лишние/битые id, дубликаты,
 * каждую пропущенную статью кладёт в свою группу (вместо полного отказа).
 */
function repairLlmGroups(rawGroups, validIds) {
  const expected = new Set(validIds);
  const seen = new Set();
  const repaired = [];

  const arr = Array.isArray(rawGroups) ? rawGroups : [];
  for (const g of arr) {
    if (!g || typeof g !== 'object') continue;
    const rawIds = Array.isArray(g.ids) ? g.ids : [];
    const cleanIds = [];
    for (const id of rawIds) {
      if (typeof id !== 'string') continue;
      const normalized = id.trim();
      if (!expected.has(normalized) || seen.has(normalized)) continue;
      seen.add(normalized);
      cleanIds.push(normalized);
    }
    if (cleanIds.length > 0) {
      repaired.push({
        ids: cleanIds,
        headline: typeof g.headline === 'string' ? g.headline.slice(0, 120) : null,
      });
    }
  }

  for (const id of validIds) {
    if (!seen.has(id)) {
      repaired.push({ ids: [id], headline: null });
      seen.add(id);
    }
  }

  return repaired;
}

function fallbackGroupsFromStage1(batchArticles, stage1Clusters) {
  const batchSet = new Set(batchArticles);
  const used = new Set();
  const groups = [];

  for (const cl of stage1Clusters) {
    const inBatch = cl.items.filter((it) => batchSet.has(it));
    if (inBatch.length === 0) continue;
    const ids = inBatch.map(articleStableId);
    ids.forEach((id) => used.add(id));
    groups.push({ ids, headline: null });
  }

  for (const a of batchArticles) {
    const id = articleStableId(a);
    if (!used.has(id)) {
      groups.push({ ids: [id], headline: null });
      used.add(id);
    }
  }

  return groups.length
    ? groups
    : batchArticles.map((a) => ({ ids: [articleStableId(a)], headline: null }));
}

async function llmGroupBatch(batchArticles, sectionTitle) {
  const validIds = batchArticles.map(articleStableId);
  const items = batchArticles.map((a) => ({
    id: articleStableId(a),
    source: (a.source?.name || 'unknown').slice(0, 42),
    title: (a.title || '').slice(0, 200),
    snippet: firstSnippet(
      a.description || a.content || a.title || '',
      CONFIG.openaiArticleGroupSnippetChars,
    ),
  }));

  const userJson = jsonStringifySafe(items);
  const sectionHint =
    sectionTitle ||
    'World / political news — merge when clearly the same developing story.';

  const system = [
    'You partition articles into event groups. One group = the SAME single real-world incident or the SAME clearly labeled follow-up (same strike or disaster, same negotiation round, same named official statement about one act, same court ruling or vote on one matter).',
    'CRITICAL: Merge ALL articles that clearly refer to the SAME one incident, even when headlines, ledes, and wording differ (synonyms, passive vs active voice, different outlet framing, emphasis on victims vs perpetrators, etc.). Paraphrase and tone differences are NOT reasons to split.',
    'Return ONLY valid JSON (no markdown).',
    'Schema: {"groups":[{"ids":["id1","id2"],"headline":"4-10 words"}]}',
    'Rules:',
    '- Use ONLY "id" values from the input. Every id must appear exactly once in total across all groups — no missing, duplicate, or extra ids.',
    '- Copy each id character-for-character; do not invent or rename ids.',
    '- When two or more articles (especially from different sources) report the same specific incident — same place and event, same named attack/talks/sanction step, same quoted reaction to the same act — put them in ONE group even if titles differ in tone, length, or vocabulary.',
    '- If snippets point to the same dated development, same named actors and act, or same identifiable scene (one explosion, one vote, one announcement), merge even when one article uses vague phrasing and another is specific — as long as they are clearly the same story, not two different developments.',
    '- Prefer fewer, larger groups when the concrete hook matches; do not split one incident across multiple groups.',
    '- Before merging, ask: would one short headline cover BOTH articles without "and also" about a different topic? If not, use separate groups.',
    '- Do NOT merge articles that only share a broad theme (same country, same leader name, generic "the war", "tensions", "aid", "sanctions") without the same concrete hook (same act, same meeting round, same dated order).',
    '- Do NOT merge because both mention the same country or conflict zone; require the same specific development (what happened, to whom, where or when if stated).',
    '- The hook must be concrete: same named location + same type of event, or same meeting/round name, or same policy change identified the same way — not only the same country or conflict zone.',
    '- Do NOT merge troop deployment or training stories with unrelated combat or political pieces unless they explicitly reference the same program or same dated order.',
    '- Use a single-id group only when that article is clearly a different story from every other item in the batch.',
    `Section title is a weak hint only; do not merge on title alone: ${sectionHint}`,
  ].join(' ');

  const content = await callChatCompletions(
    [
      { role: 'system', content: system },
      {
        role: 'user',
        content: `Articles (JSON array):\n${userJson}\n\nRespond with JSON only. Include every input id exactly once. Merge every pair that reports the same single real-world incident, including when wording, angle, or source framing differs; only keep separate groups when they are genuinely different events.`,
      },
    ],
    CONFIG.openaiArticleGroupMaxTokens,
  );

  let parsed;
  try {
    parsed = parseJsonFromContent(content);
  } catch (err) {
    throw new Error(`LLM grouping JSON parse: ${err.message}`);
  }

  const rawGroups = Array.isArray(parsed?.groups) ? parsed.groups : [];
  const rawWasInvalid = rawGroups.length === 0 || !validateGroups(rawGroups, validIds);
  const groups = repairLlmGroups(rawGroups, validIds);

  if (!validateGroups(groups, validIds)) {
    return {
      groups: validIds.map((id) => ({ ids: [id], headline: null })),
      meta: { repairedPartition: false, forcedSingletons: true },
    };
  }

  const repairedPartition = Boolean(rawWasInvalid && validIds.length > 0);
  return {
    groups,
    meta: { repairedPartition, forcedSingletons: false },
  };
}

/**
 * @param {object[]} articles
 * @returns {Promise<object[]>} events
 */
async function clusterArticlesWithLlmGrouping(articles) {
  if (!articles.length) return [];

  if (!CONFIG.openaiApiKey) {
    return clusterArticlesIntoEvents(articles);
  }

  const stage1 = clusterArticlesStageOneTopicAware(articles);
  const isCommonToken = buildCommonTokenFilter(articles);
  const byId = new Map();
  for (const a of articles) {
    byId.set(articleStableId(a), a);
  }

  const uf = new UnionFind();
  for (const id of byId.keys()) {
    uf.make(id);
  }

  const buckets = new Map();
  for (const a of articles) {
    const ft = detectFixedTopicForArticle(a);
    const key = ft ? ft.id : '__misc__';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(a);
  }

  const minSimToLead = CONFIG.openaiArticleGroupMinSimToLead;
  const minPairInEvent = CONFIG.openaiArticleGroupMinPairSimInEvent;

  const llmBatchStats = { total: 0, repairedPartition: 0, forcedSingletons: 0 };
  const wholeMax = CONFIG.openaiArticleGroupWholeBucketMax;

  for (const [key, bucket] of buckets) {
    const sectionTitle =
      key === '__misc__' ? null : FIXED_TOPICS.find((t) => t.id === key)?.title || key;

    let bucketDone = false;
    if (wholeMax > 0 && bucket.length > 0 && bucket.length <= wholeMax) {
      llmBatchStats.total += 1;
      try {
        const { groups: wg, meta } = await llmGroupBatch(bucket, sectionTitle);
        if (meta.forcedSingletons) llmBatchStats.forcedSingletons += 1;
        else if (meta.repairedPartition) llmBatchStats.repairedPartition += 1;
        for (const g of wg) {
          const ids = g.ids;
          if (!ids || ids.length === 0) continue;
          const head = ids[0];
          for (let i = 1; i < ids.length; i += 1) {
            uf.union(head, ids[i]);
          }
        }
        bucketDone = true;
      } catch (err) {
        console.warn('[articleLlmGroup] whole-bucket LLM failed, overlapping batches:', err.message);
      }
    }

    if (bucketDone) continue;

    const batches = buildOverlappingBatches(
      bucket,
      CONFIG.openaiArticleGroupBatchSize,
      CONFIG.openaiArticleGroupOverlap,
    );

    for (const batch of batches) {
      let groups;
      llmBatchStats.total += 1;
      try {
        const { groups: g, meta } = await llmGroupBatch(batch, sectionTitle);
        groups = g;
        if (meta.forcedSingletons) llmBatchStats.forcedSingletons += 1;
        else if (meta.repairedPartition) llmBatchStats.repairedPartition += 1;
      } catch (err) {
        console.warn('[articleLlmGroup] batch LLM failed, stage1 fallback:', err.message);
        groups = fallbackGroupsFromStage1(batch, stage1);
      }

      for (const g of groups) {
        const ids = g.ids;
        if (!ids || ids.length === 0) continue;
        const head = ids[0];
        for (let i = 1; i < ids.length; i += 1) {
          uf.union(head, ids[i]);
        }
      }
    }
  }

  if (llmBatchStats.forcedSingletons > 0) {
    console.warn(
      `[articleLlmGroup] ${llmBatchStats.forcedSingletons}/${llmBatchStats.total} LLM batch(es): repair invariant failed, fell back to per-article groups`,
    );
  }
  if (llmBatchStats.repairedPartition > 0) {
    console.warn(
      `[articleLlmGroup] ${llmBatchStats.repairedPartition}/${llmBatchStats.total} LLM batch(es) had imperfect id lists; partition auto-repaired (valid output)`,
    );
  }

  // Этап 1 часто уже сгруппировал пары, но они в разных LLM-батчах — склеиваем похожие пары внутри его кластера.
  const pairSim = CONFIG.openaiArticleGroupStage1PairSim;
  const rawFloor = CONFIG.openaiArticleGroupStage1RawSimFloor;
  for (const cl of stage1) {
    const { items } = cl;
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const disc = similarityDiscriminativeWithFilter(
          articleFullText(items[i]),
          articleFullText(items[j]),
          isCommonToken,
        );
        const raw = similarity(
          articleTitleDescForRawSim(items[i]),
          articleTitleDescForRawSim(items[j]),
        );
        if (disc >= pairSim && raw >= rawFloor) {
          uf.union(articleStableId(items[i]), articleStableId(items[j]));
        }
      }
    }
  }

  const rootToIds = new Map();
  for (const id of byId.keys()) {
    const r = uf.find(id);
    if (!rootToIds.has(r)) rootToIds.set(r, []);
    rootToIds.get(r).push(id);
  }

  const events = [];
  for (const ids of rootToIds.values()) {
    const arts = ids.map((i) => byId.get(i)).filter(Boolean);
    if (arts.length === 0) continue;
    if (CONFIG.openaiArticleGroupSkipPostSplit) {
      events.push(buildMergedEventFromArticles(arts));
      continue;
    }
    const afterLead = splitClusterByLeadSimilarity(arts, minSimToLead, isCommonToken);
    for (const chunk of afterLead) {
      if (chunk.length === 0) continue;
      const refined = peelOutliersDiscriminative(chunk, isCommonToken, minPairInEvent);
      for (const sub of refined) {
        if (sub.length) {
          events.push(buildMergedEventFromArticles(sub));
        }
      }
    }
  }

  const allArticles = [...byId.values()];
  const withPostMerge = CONFIG.openaiArticleGroupMergeSingletons
    ? mergeSingletonEventsByTextSimilarity(events, allArticles)
    : events;

  return withPostMerge.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

module.exports = {
  clusterArticlesWithLlmGrouping,
  buildOverlappingBatches,
  validateGroups,
  repairLlmGroups,
  splitClusterByLeadSimilarity,
};
