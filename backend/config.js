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
  { id: 'bbc-news',          name: 'BBC News',            domain: 'bbc.com,bbc.co.uk'   },
  { id: 'cnn',               name: 'CNN',                 domain: 'cnn.com'              },
  { id: 'associated-press',  name: 'Associated Press',    domain: 'apnews.com'           },
  { id: 'al-jazeera-english',name: 'Al Jazeera English',  domain: 'aljazeera.com'        },
  { id: 'the-guardian-uk',   name: 'The Guardian',        domain: 'theguardian.com'      },
  { id: 'reuters',           name: 'Reuters',             domain: 'reuters.com'          },
  { id: 'abc-news',          name: 'ABC News',            domain: 'abcnews.go.com'       },
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
  /**
   * Подгрузка текста со страницы URL, если NewsAPI вернул усечённый content с [+N …].
   * Может давать 403 на части сайтов; лимит запросов за один refresh. NEWS_ENRICH_ARTICLE_BODY=1
   */
  newsEnrichArticleBody: process.env.NEWS_ENRICH_ARTICLE_BODY === '1',
  newsEnrichMaxArticlesPerRefresh: Math.max(
    0,
    Math.min(150, Number(process.env.NEWS_ENRICH_MAX_ARTICLES || 36)),
  ),
  newsEnrichConcurrency: Math.max(1, Math.min(8, Number(process.env.NEWS_ENRICH_CONCURRENCY || 3))),
  newsEnrichDelayMs: Math.max(0, Math.min(3000, Number(process.env.NEWS_ENRICH_DELAY_MS || 120))),
  newsEnrichFetchTimeoutMs: Math.max(
    5000,
    Math.min(20000, Number(process.env.NEWS_ENRICH_FETCH_TIMEOUT_MS || 10000)),
  ),
  newsEnrichCacheTtlMs: Math.max(
    0,
    Math.min(
      7 * 24 * 60 * 60 * 1000,
      Number(process.env.NEWS_ENRICH_CACHE_TTL_MS || 48 * 60 * 60 * 1000),
    ),
  ),
  sourceProfiles: SOURCE_PROFILES,
  sourceIds: SOURCE_PROFILES.map((source) => source.id),
  maxTopics: 5,
  maxEventsPerTopic: Math.max(1, Math.min(30, Number(process.env.MAX_EVENTS_PER_TOPIC || 10))),
  maxArticlesPerSource: Math.max(10, Math.min(100, Number(process.env.MAX_ARTICLES_PER_SOURCE || 50))),
  refreshIntervalMs: 24 * 60 * 60 * 1000,
  storagePath: path.join(__dirname, 'data', 'store.json'),
  /** Supabase: статьи / события / связи после refresh (service role только на сервере). */
  supabaseUrl: (process.env.SUPABASE_URL || '').trim(),
  supabaseServiceKey: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  supabaseEnabled: process.env.SUPABASE_ENABLED === '1',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  openaiBatchSize: Math.max(1, Number(process.env.OPENAI_BATCH_SIZE || 3)),
  openaiMaxEventsPerRefresh: Math.max(0, Number(process.env.OPENAI_MAX_EVENTS_PER_REFRESH || 25)),
  openaiMaxTokensPerBatch: Math.min(4096, Math.max(400, Number(process.env.OPENAI_MAX_TOKENS_PER_BATCH || 3200))),
  openaiMaxSnippetsPerEvent: Math.max(1, Math.min(8, Number(process.env.OPENAI_MAX_SNIPPETS_PER_EVENT || 4))),
  openaiTopicCount: Math.max(1, Math.min(8, Number(process.env.OPENAI_TOPIC_COUNT || 5))),
  openaiMinTopicRelevance: Math.max(
    0,
    Math.min(1, Number(process.env.OPENAI_MIN_TOPIC_RELEVANCE || 0.45)),
  ),
  // Второй проход LLM: перепроверка попадания в фиксированную тему (секцию приложения).
  openaiVerifyFixedTopic: process.env.OPENAI_VERIFY_FIXED_TOPIC !== '0',
  openaiVerifyMaxTokens: Math.min(2048, Math.max(200, Number(process.env.OPENAI_VERIFY_MAX_TOKENS || 900))),
  /** Суффикс ключа кэша LLM — смена сбрасывает кэш после изменения пайплайна. */
  openaiLlmCacheKeySuffix: process.env.OPENAI_LLM_CACHE_SUFFIX || 'pv2-verify',
  /**
   * Двухэтапная кластеризация (LLM-батчи по статьям). Включить: OPENAI_ARTICLE_GROUPING=1
   * По умолчанию выкл., чтобы не умножать вызовы API без явного согласия.
   */
  openaiArticleGrouping: process.env.OPENAI_ARTICLE_GROUPING === '1',
  openaiArticleGroupBatchSize: Math.max(6, Math.min(22, Number(process.env.OPENAI_ARTICLE_GROUP_BATCH_SIZE || 10))),
  openaiArticleGroupMaxTokens: Math.min(4096, Math.max(800, Number(process.env.OPENAI_ARTICLE_GROUP_MAX_TOKENS || 3200))),
  openaiArticleGroupOverlap: Math.max(0, Math.min(8, Number(process.env.OPENAI_ARTICLE_GROUP_OVERLAP || 5))),
  /** Длина сниппета (title+desc) в промпт LLM для группировки — больше контекста = лучше склейка. */
  openaiArticleGroupSnippetChars: Math.max(
    120,
    Math.min(900, Number(process.env.OPENAI_ARTICLE_GROUP_SNIPPET_CHARS || 420)),
  ),
  /**
   * После пайплайна: склеивать пары одностатейных событий с похожими title+desc в одной фикс-теме (Jaccard).
   * Выключить: OPENAI_ARTICLE_GROUP_MERGE_SINGLETONS=0
   */
  /**
   * Один запрос LLM на весь bucket темы, если статей не больше N (0 = выкл., типично 14–18).
   * Снижает эффект «батчи режут одну историю».
   */
  openaiArticleGroupWholeBucketMax: Math.max(
    0,
    Math.min(
      22,
      Number(
        process.env.OPENAI_ARTICLE_GROUP_WHOLE_BUCKET_MAX === undefined ||
          process.env.OPENAI_ARTICLE_GROUP_WHOLE_BUCKET_MAX === ''
          ? 14
          : process.env.OPENAI_ARTICLE_GROUP_WHOLE_BUCKET_MAX,
      ),
    ),
  ),
  /**
   * Не вызывать split/peel после Union–Find: одно событие = вся UF-компонента (агрессивно, больше ложных склеек).
   * Включить: OPENAI_ARTICLE_GROUP_SKIP_POST_SPLIT=1
   */
  openaiArticleGroupSkipPostSplit: process.env.OPENAI_ARTICLE_GROUP_SKIP_POST_SPLIT === '1',
  openaiArticleGroupMergeSingletons: process.env.OPENAI_ARTICLE_GROUP_MERGE_SINGLETONS !== '0',
  openaiArticleGroupSingletonMergeHours: Math.max(
    6,
    Math.min(168, Number(process.env.OPENAI_ARTICLE_GROUP_SINGLETON_MERGE_HOURS || 72)),
  ),
  openaiArticleGroupSingletonMergeRawSim: Math.max(
    0.12,
    Math.min(0.5, Number(process.env.OPENAI_ARTICLE_GROUP_SINGLETON_MERGE_RAW_SIM || 0.17)),
  ),
  /** Мин. дискриминативный Jaccard с лидером (без массовых токенов пула). */
  openaiArticleGroupMinSimToLead: Math.max(
    0.03,
    Math.min(0.35, Number(process.env.OPENAI_ARTICLE_GROUP_MIN_SIM_TO_LEAD || 0.04)),
  ),
  /** Пара из 2 статей: держим вместе, если pair Jaccard ≥ max( floor, minSimToLead * ratio ). */
  openaiArticleGroupPairKeepFloor: Math.max(
    0.02,
    Math.min(0.12, Number(process.env.OPENAI_ARTICLE_GROUP_PAIR_KEEP_MIN || 0.038)),
  ),
  openaiArticleGroupPairKeepLeadRatio: Math.max(
    0.35,
    Math.min(0.9, Number(process.env.OPENAI_ARTICLE_GROUP_PAIR_KEEP_LEAD_RATIO || 0.52)),
  ),
  openaiArticleGroupTimeWindowMs: Math.max(
    12 * 60 * 60 * 1000,
    Math.min(
      7 * 24 * 60 * 60 * 1000,
      Number(process.env.OPENAI_ARTICLE_GROUP_TIME_WINDOW_HOURS || 72) * 60 * 60 * 1000,
    ),
  ),
  /** Окно по времени для правила «редкие сущности» на этапе 1 (шире legacy 24ч). */
  openaiArticleGroupStage1EntityWindowMs: Math.max(
    12 * 60 * 60 * 1000,
    Math.min(
      7 * 24 * 60 * 60 * 1000,
      Number(process.env.OPENAI_ARTICLE_GROUP_STAGE1_ENTITY_HOURS || 48) * 60 * 60 * 1000,
    ),
  ),
  /** После LLM: доп. склейка пар из одного кластера этапа 1, если Jaccard текстов ≥ порога (связывает разные батчи). */
  openaiArticleGroupStage1PairSim: Math.max(
    0.05,
    Math.min(0.45, Number(process.env.OPENAI_ARTICLE_GROUP_STAGE1_PAIR_SIM || 0.082)),
  ),
  /**
   * Доп. условие для моста этапа 1: обычный Jaccard по title+description (без фильтра «массовых» слов)
   * должен быть ≥ этого порога, иначе пара не склеивается — меньше ложных слияний «только по редкому токену».
   */
  openaiArticleGroupStage1RawSimFloor: Math.max(
    0.06,
    Math.min(0.35, Number(process.env.OPENAI_ARTICLE_GROUP_STAGE1_RAW_SIM_FLOOR || 0.11)),
  ),
  /**
   * Доля статей пула, в которых встречается токен, чтобы считать его «шумовым» и выкинуть из Jaccard склейки.
   * Снижает ложные 4-в-1 из-за общих слов вроде ukraine, war, trump.
   */
  clusterCommonTokenMaxRatio: Math.max(
    0.08,
    Math.min(0.55, Number(process.env.CLUSTER_COMMON_TOKEN_MAX_RATIO || 0.22)),
  ),
  /** В событии из ≥3 статей: мин. попарное «дискриминативное» сходство; ниже — выкидываем слабейшую статью. */
  openaiArticleGroupMinPairSimInEvent: Math.max(
    0.03,
    Math.min(0.35, Number(process.env.OPENAI_ARTICLE_GROUP_MIN_PAIR_SIM || 0.062)),
  ),
  /**
   * Cloudflare Turnstile: защита форм входа/регистрации от ботов (проверка на сервере).
   * TURNSTILE_SECRET_KEY — только на сервере (siteverify).
   * TURNSTILE_SITE_KEY — публичный site key; отдаётся в GET /auth/turnstile-config (виджет на сайте).
   * Дополнительно в бандле Expo: EXPO_PUBLIC_TURNSTILE_SITE_KEY или TURNSTILE_SITE_KEY в .env при сборке.
   * Пока секрет не задан, /auth/verify-challenge отвечает ok без проверки.
   * BOT_CHECK_DISABLED=1 — отключить проверку (разработка).
   */
  turnstileSecretKey: (process.env.TURNSTILE_SECRET_KEY || '').trim(),
  turnstileSiteKey: (process.env.TURNSTILE_SITE_KEY || '').trim(),
  botCheckDisabled: process.env.BOT_CHECK_DISABLED === '1',

  translation: {
    // Не требует отдельного ключа, но может быть нестабилен; при ошибках оставляем оригинал.
    googleTranslateEndpoint:
      'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ru&dt=t&q=',
  },
};

module.exports = { CONFIG };
