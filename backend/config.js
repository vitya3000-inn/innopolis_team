const path = require('path');
const fs = require('fs');

function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) return;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

loadEnvFile();

const SOURCE_PROFILES = [
  { id: 'bbc-news', name: 'BBC News', domain: 'bbc.com,bbc.co.uk' },
  // 4 фиксированных англоязычных источника помимо BBC (для NewsAPI они обычно доступны как sources=...).
  { id: 'cnn', name: 'CNN', domain: 'cnn.com' },
  { id: 'the-verge', name: 'The Verge', domain: 'theverge.com' },
  { id: 'associated-press', name: 'Associated Press', domain: 'apnews.com' },
  { id: 'al-jazeera-english', name: 'Al Jazeera English', domain: 'aljazeera.com' },
];

const CONFIG = {
  port: Number(process.env.PORT || 8787),
  newsApiKey: process.env.NEWS_API_KEY || '',
  newsApiBaseUrl: 'https://newsapi.org/v2',
  targetLanguage: process.env.TARGET_LANGUAGE || 'en',
  newsLookbackDays: Math.max(1, Math.min(14, Number(process.env.NEWS_LOOKBACK_DAYS || 3))),
  newsRequestDelayMs: Math.max(0, Math.min(5000, Number(process.env.NEWS_REQUEST_DELAY_MS || 1000))),
  newsCacheTtlMs: Math.max(
    0,
    Math.min(7 * 24 * 60 * 60 * 1000, Number(process.env.NEWS_CACHE_TTL_MS || 6 * 60 * 60 * 1000)),
  ),
  sourceProfiles: SOURCE_PROFILES,
  sourceIds: SOURCE_PROFILES.map((source) => source.id),
  maxTopics: 5,
  maxEventsPerTopic: Math.max(5, Math.min(30, Number(process.env.MAX_EVENTS_PER_TOPIC || 15))),
  maxArticlesPerSource: Math.max(10, Math.min(100, Number(process.env.MAX_ARTICLES_PER_SOURCE || 50))),
  refreshIntervalMs: 24 * 60 * 60 * 1000,
  storagePath: path.join(__dirname, 'data', 'store.json'),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  openaiBatchSize: Math.max(1, Number(process.env.OPENAI_BATCH_SIZE || 5)),
  openaiMaxEventsPerRefresh: Math.max(0, Number(process.env.OPENAI_MAX_EVENTS_PER_REFRESH || 25)),
  openaiMaxTokensPerBatch: Math.min(4096, Math.max(200, Number(process.env.OPENAI_MAX_TOKENS_PER_BATCH || 1200))),
  openaiMaxSnippetsPerEvent: Math.max(1, Math.min(8, Number(process.env.OPENAI_MAX_SNIPPETS_PER_EVENT || 4))),
  openaiTopicCount: Math.max(1, Math.min(8, Number(process.env.OPENAI_TOPIC_COUNT || 5))),
  openaiMinTopicRelevance: Math.max(
    0,
    Math.min(1, Number(process.env.OPENAI_MIN_TOPIC_RELEVANCE || 0.45)),
  ),
  translation: {
    // Не требует отдельного ключа, но может быть нестабилен; при ошибках оставляем оригинал.
    googleTranslateEndpoint:
      'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ru&dt=t&q=',
  },
};

module.exports = { CONFIG };
