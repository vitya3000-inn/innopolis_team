const { CONFIG } = require('./config');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CACHE_PATH = path.join(__dirname, 'data', 'newsapi-cache.json');

const BASE_QUERY =
  '(iran OR israeli OR israel OR gaza OR hamas OR lebanon OR hezbollah OR ukraine OR russia OR war OR conflict OR government OR election OR sanctions OR diplomacy)';

function ensureCacheDir() {
  const dir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadCache() {
  try {
    if (fs.existsSync(CACHE_PATH)) {
      return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    }
  } catch {
    // ignore corrupted cache
  }
  return { v: 1, entries: {} };
}

function saveCache(cache) {
  ensureCacheDir();
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
}

function cacheKeyForSource(sourceProfile) {
  const fingerprint = [
    sourceProfile.id,
    sourceProfile.domain || '',
    `lookback=${CONFIG.newsLookbackDays}`,
    `max=${CONFIG.maxArticlesPerSource}`,
    `q=${BASE_QUERY}`,
  ].join('|');
  return crypto.createHash('sha256').update(fingerprint).digest('hex').slice(0, 24);
}

function isFresh(entry) {
  if (!entry || !entry.fetchedAt || !Array.isArray(entry.articles)) return false;
  if (CONFIG.newsCacheTtlMs <= 0) return false;
  const t = new Date(entry.fetchedAt).getTime();
  if (Number.isNaN(t)) return false;
  const age = Date.now() - t;
  // Пустые результаты кэшируем ненадолго, чтобы не "залипнуть" в 0 статей на часы.
  const ttl = entry.articles.length === 0 ? Math.min(5 * 60 * 1000, CONFIG.newsCacheTtlMs) : CONFIG.newsCacheTtlMs;
  return age < ttl;
}

function isoDateDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function applyCommonParams(url) {
  url.searchParams.set('q', BASE_QUERY);
  url.searchParams.set('language', 'en');
  url.searchParams.set('sortBy', 'publishedAt');
  url.searchParams.set('pageSize', String(CONFIG.maxArticlesPerSource));
  url.searchParams.set('from', isoDateDaysAgo(CONFIG.newsLookbackDays));
  return url;
}

function buildEverythingUrlForSource(sourceProfile) {
  const url = new URL(`${CONFIG.newsApiBaseUrl}/everything`);
  url.searchParams.set('sources', sourceProfile.id);
  return applyCommonParams(url);
}

function buildEverythingUrlForDomain(sourceProfile) {
  const url = new URL(`${CONFIG.newsApiBaseUrl}/everything`);
  url.searchParams.set('domains', sourceProfile.domain);
  return applyCommonParams(url);
}

function buildEverythingUrlForAllDomains() {
  const url = new URL(`${CONFIG.newsApiBaseUrl}/everything`);
  const domains = CONFIG.sourceProfiles.map((s) => s.domain).filter(Boolean).join(',');
  if (domains) url.searchParams.set('domains', domains);
  return applyCommonParams(url);
}

function pickSourceProfileForArticle(article) {
  const url = String(article?.url || '').toLowerCase();
  for (const sp of CONFIG.sourceProfiles) {
    const domains = String(sp.domain || '')
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    if (domains.some((d) => url.includes(d))) return sp;
  }
  return null;
}

function buildTopHeadlinesUrlForSource(sourceProfile) {
  const url = new URL(`${CONFIG.newsApiBaseUrl}/top-headlines`);
  url.searchParams.set('sources', sourceProfile.id);
  url.searchParams.set('pageSize', String(Math.min(100, CONFIG.maxArticlesPerSource)));
  return url;
}

const INTEREST_TERMS = [
  'ukraine',
  'kyiv',
  'kiev',
  'russia',
  'moscow',
  'donbas',
  'iran',
  'tehran',
  'israel',
  'gaza',
  'hamas',
  'lebanon',
  'hezbollah',
  'idf',
  'netanyahu',
];

function matchesInterest(article) {
  const text = `${article?.title || ''} ${article?.description || ''} ${article?.content || ''}`.toLowerCase();
  return INTEREST_TERMS.some((t) => text.includes(t));
}

function isUsefulArticle(article) {
  if (!article || !article.title || !article.url) return false;
  const url = (article.url || '').toLowerCase();
  const title = (article.title || '').toLowerCase();

  // Отсекаем программные/аудио страницы BBC, которые сильно шумят и
  // делают выдачу односторонней по одному источнику.
  if (
    url.includes('bbc.co.uk/programmes/') ||
    url.includes('bbc.co.uk/sounds/') ||
    title.includes('scotcast') ||
    title.includes('podcast')
  ) {
    return false;
  }
  return true;
}

function dedupeByUrl(list) {
  const map = new Map();
  (list || []).forEach((a) => {
    if (a && a.url && !map.has(a.url)) map.set(a.url, a);
  });
  return [...map.values()];
}

async function fetchArticlesForSource(sourceProfile, options = {}) {
  const force = Boolean(options.force);
  const cache = loadCache();
  const key = cacheKeyForSource(sourceProfile);
  const hit = cache.entries?.[key];
  if (!force && isFresh(hit)) {
    return hit.articles;
  }

  // NewsAPI у разных ключей может иметь разный список доступных "sources".
  // Поэтому сначала пробуем sources=..., а если API отвечает, что source не существует —
  // падаем обратно на domains=... (это стабильно работает для MVP).
  const tryFetch = async (url) => {
    const response = await fetch(url.toString(), { headers: { 'X-Api-Key': CONFIG.newsApiKey } });
    if (!response.ok) {
      const body = await response.text();
      const error = new Error(`NewsAPI error ${response.status} for ${sourceProfile.id}: ${body}`);
      error.status = response.status;
      error.body = body;
      throw error;
    }
    const payload = await response.json();
    if (!payload.articles || !Array.isArray(payload.articles)) return [];
    return payload.articles.filter(isUsefulArticle);
  };

  try {
    // Собираем максимум релевантных материалов, но экономно (2 запроса на источник максимум).
    const fromEverything = await tryFetch(buildEverythingUrlForSource(sourceProfile));
    const fromTopRaw = await tryFetch(buildTopHeadlinesUrlForSource(sourceProfile));
    const fromTop = fromTopRaw.filter(matchesInterest);
    return dedupeByUrl([...fromTop, ...fromEverything]);
  } catch (error) {
    const body = String(error?.body || error?.message || '');
    const looksLikeInvalidSource =
      String(error?.status) === '400' &&
      body.includes("request a source that doesn't exist");
    if (looksLikeInvalidSource && sourceProfile.domain) {
      const fromDomain = await tryFetch(buildEverythingUrlForDomain(sourceProfile));
      return dedupeByUrl(fromDomain);
    }
    throw error;
  }
}

async function fetchTopPoliticalArticles(options = {}) {
  if (!CONFIG.newsApiKey) {
    throw new Error('NEWS_API_KEY is not configured');
  }

  const batches = [];
  for (let i = 0; i < CONFIG.sourceProfiles.length; i++) {
    const sourceProfile = CONFIG.sourceProfiles[i];
    try {
      const articles = await fetchArticlesForSource(sourceProfile, options);
      batches.push(
        articles.map((article) => ({
          ...article,
          source: {
            ...(article.source || {}),
            id: sourceProfile.id,
            name: sourceProfile.name,
          },
        })),
      );

      // Сохраняем кэш по источнику после успешного получения (чтобы переживал перезапуск).
      const cache = loadCache();
      const key = cacheKeyForSource(sourceProfile);
      cache.entries = cache.entries || {};
      cache.entries[key] = {
        fetchedAt: new Date().toISOString(),
        sourceId: sourceProfile.id,
        articles,
      };
      saveCache(cache);
    } catch (error) {
      console.warn(`[newsapi] failed for ${sourceProfile.id}:`, error.message);
      batches.push([]);
    }

    if (i < CONFIG.sourceProfiles.length - 1 && CONFIG.newsRequestDelayMs > 0) {
      await new Promise((r) => setTimeout(r, CONFIG.newsRequestDelayMs));
    }
  }

  // Fallback: если по отдельным источникам пришло слишком мало, пробуем один общий запрос по всем доменам.
  // Это помогает, когда "sources" ограничены планом/ключом и дают пусто, а домены в сумме работают лучше.
  const currentTotal = batches.reduce((acc, b) => acc + b.length, 0);
  if (currentTotal < 10) {
    try {
      const response = await fetch(buildEverythingUrlForAllDomains().toString(), {
        headers: { 'X-Api-Key': CONFIG.newsApiKey },
      });
      if (response.ok) {
        const payload = await response.json();
        const list = Array.isArray(payload?.articles) ? payload.articles.filter(isUsefulArticle) : [];
        const mapped = list
          .map((article) => {
            const sp = pickSourceProfileForArticle(article);
            if (!sp) return null;
            return {
              ...article,
              source: { ...(article.source || {}), id: sp.id, name: sp.name },
            };
          })
          .filter(Boolean);
        batches.push(mapped);
      }
    } catch (_e) {
      // ignore fallback failures
    }
  }

  const dedupedByUrl = new Map();
  batches.flat().forEach((article) => {
    if (!dedupedByUrl.has(article.url)) {
      dedupedByUrl.set(article.url, article);
    }
  });

  const allArticles = [...dedupedByUrl.values()];
  allArticles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  // Перемешиваем ленту "по кругу" по источникам, чтобы одна редакция не доминировала
  // в верхней части списка и в кластерах.
  const bySource = new Map();
  allArticles.forEach((article) => {
    const sourceId = article.source?.id || 'unknown';
    if (!bySource.has(sourceId)) bySource.set(sourceId, []);
    bySource.get(sourceId).push(article);
  });

  const sourceOrder = [...bySource.keys()];
  const interleaved = [];
  let added = true;
  while (added) {
    added = false;
    for (const sourceId of sourceOrder) {
      const queue = bySource.get(sourceId);
      if (queue && queue.length > 0) {
        interleaved.push(queue.shift());
        added = true;
      }
    }
  }

  return interleaved;
}

module.exports = { fetchTopPoliticalArticles };
