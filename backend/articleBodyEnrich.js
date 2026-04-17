const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { CONFIG } = require('./config');
const {
  stripNewsApiTruncationMeta,
  plainTextFromHtml,
  looksTruncatedNewsApiContent,
  extractParagraphsFromHtml,
} = require('./newsTextCleanup');

const CACHE_PATH = path.join(__dirname, 'data', 'article-body-enrich-cache.json');

function loadCache() {
  try {
    if (fs.existsSync(CACHE_PATH)) {
      return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    }
  } catch {
    // ignore
  }
  return { v: 1, entries: {} };
}

function saveCache(cache) {
  const dir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
}

function cacheKey(url) {
  return crypto.createHash('sha256').update(String(url || '')).digest('hex').slice(0, 32);
}

async function fetchArticlePlainText(url) {
  const u = String(url || '').trim();
  if (!u.startsWith('http')) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.max(4000, Math.min(15000, CONFIG.newsEnrichFetchTimeoutMs)));
  try {
    const res = await fetch(u, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'NewsMapIngest/1.0 (+local research; respects robots)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const fromP = extractParagraphsFromHtml(html);
    if (fromP.length > 400) return stripNewsApiTruncationMeta(fromP);
    const fallback = plainTextFromHtml(html);
    return fallback.length > 400 ? stripNewsApiTruncationMeta(fallback.slice(0, 12000)) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Подтягивает текст со страницы для статей с усечённым NewsAPI content (лимит запросов за refresh).
 */
async function enrichArticlesBodyFromSourcePages(articles) {
  if (!CONFIG.newsEnrichArticleBody || !articles?.length) return articles;

  const maxN = CONFIG.newsEnrichMaxArticlesPerRefresh;
  const cache = loadCache();
  cache.entries = cache.entries || {};
  const ttlMs = Math.max(0, CONFIG.newsEnrichCacheTtlMs);
  const now = Date.now();

  const toFetch = [];
  for (const a of articles) {
    if (toFetch.length >= maxN) break;
    const raw = a.content || '';
    if (!looksTruncatedNewsApiContent(raw)) continue;

    const ck = cacheKey(a.url);
    const hit = cache.entries[ck];
    const plainLen = plainTextFromHtml(raw).length;

    if (hit?.text && hit.fetchedAt && ttlMs > 0) {
      const age = now - new Date(hit.fetchedAt).getTime();
      if (age < ttlMs && hit.text.length > plainLen * 1.12) {
        a.content = hit.text;
        continue;
      }
    }
    toFetch.push({ article: a, ck });
  }

  let dirty = false;
  const conc = Math.max(1, Math.min(8, CONFIG.newsEnrichConcurrency));

  async function runOne(item) {
    const text = await fetchArticlePlainText(item.article.url);
    if (text && text.length > 120) {
      const plainLen = plainTextFromHtml(item.article.content || '').length;
      if (text.length > plainLen * 1.08) {
        item.article.content = text;
        cache.entries[item.ck] = { fetchedAt: new Date().toISOString(), text };
        dirty = true;
      }
    }
    if (CONFIG.newsEnrichDelayMs > 0) {
      await new Promise((r) => setTimeout(r, CONFIG.newsEnrichDelayMs));
    }
  }

  for (let i = 0; i < toFetch.length; i += conc) {
    const slice = toFetch.slice(i, i + conc);
    await Promise.all(slice.map((item) => runOne(item)));
  }

  if (dirty) {
    try {
      saveCache(cache);
    } catch {
      // ignore disk errors
    }
  }

  return articles;
}

module.exports = { enrichArticlesBodyFromSourcePages, fetchArticlePlainText };
