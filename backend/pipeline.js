const { fetchTopPoliticalArticles } = require('./newsApi');
const { translateEnToRu } = require('./translate');
const {
  clusterArticlesIntoEvents,
  groupEventsIntoTopics,
  articleStableId,
} = require('./cluster');
const { clusterArticlesWithLlmGrouping } = require('./articleLlmGroup');
const { enrichEventsWithLLM } = require('./llmOpenAI');
const { writeState } = require('./store');
const { CONFIG } = require('./config');
const { persistIngestionToSupabase } = require('./supabasePersist');
const { plainTextFromHtml, stripNewsApiTruncationMeta } = require('./newsTextCleanup');

/** Google Translate по URL ограничен длиной — режем body для перевода. */
const CONTENT_TRANSLATE_MAX_CHARS = 2200;

async function translateArticlesToRu(articles) {
  const translated = [];
  for (const article of articles) {
    const titleRu = await translateEnToRu(stripNewsApiTruncationMeta(article.title || ''));
    const descriptionRu = await translateEnToRu(
      stripNewsApiTruncationMeta(article.description || article.content || ''),
    );

    const rawContent = plainTextFromHtml(article.content);
    let contentRu = rawContent;
    if (rawContent.length > 40) {
      const chunk =
        rawContent.length > CONTENT_TRANSLATE_MAX_CHARS
          ? rawContent.slice(0, CONTENT_TRANSLATE_MAX_CHARS)
          : rawContent;
      const tr = await translateEnToRu(chunk);
      if (tr && tr.length > 0) contentRu = tr;
    }

    translated.push({
      ...article,
      title: titleRu || article.title,
      description: descriptionRu || article.description || article.content || '',
      content: contentRu || article.content,
    });
  }
  return translated;
}

async function refreshFromSources(options = {}) {
  const fetched = await fetchTopPoliticalArticles(options);
  const preparedArticles =
    CONFIG.targetLanguage === 'ru' ? await translateArticlesToRu(fetched) : fetched;

  let events;
  if (CONFIG.openaiApiKey && CONFIG.openaiArticleGrouping) {
    try {
      events = await clusterArticlesWithLlmGrouping(preparedArticles);
    } catch (err) {
      console.warn('[pipeline] LLM article grouping failed, legacy cluster:', err.message);
      events = clusterArticlesIntoEvents(preparedArticles);
    }
  } else {
    events = clusterArticlesIntoEvents(preparedArticles);
  }
  const eventsForTopics = await enrichEventsWithLLM(events);
  const topicsWithEvents = groupEventsIntoTopics(eventsForTopics);

  const topics = topicsWithEvents.map(({ events: _events, ...topic }) => topic);
  const eventsByTopic = {};
  const eventsById = {};

  topicsWithEvents.forEach((topic) => {
    eventsByTopic[topic.id] = topic.events;
    topic.events.forEach((event) => {
      eventsById[event.id] = event;
    });
  });

  /** Как в UI: только события внутри тем после фильтров (релевантность, top-N). */
  const eventsVisibleInApp = topicsWithEvents.flatMap((topic) => topic.events);
  const stableIdsInVisibleEvents = new Set();
  for (const ev of eventsVisibleInApp) {
    for (const op of ev.opinions || []) {
      if (op?.articleUrl && typeof op.articleUrl === 'string') {
        stableIdsInVisibleEvents.add(articleStableId({ url: op.articleUrl }));
      }
    }
  }
  const articlesVisibleInApp = (preparedArticles || []).filter((a) =>
    stableIdsInVisibleEvents.has(articleStableId(a)),
  );

  const state = {
    metaBySource: fetched.reduce((acc, article) => {
      const sourceId = article.source?.id || 'unknown';
      acc[sourceId] = (acc[sourceId] || 0) + 1;
      return acc;
    }, {}),
    meta: {
      updatedAt: new Date().toISOString(),
      source: 'newsapi',
      language: CONFIG.targetLanguage,
      sourceIds: CONFIG.sourceIds,
      totalArticlesFetched: fetched.length,
      llm: {
        enabled: Boolean(CONFIG.openaiApiKey),
        model: CONFIG.openaiApiKey ? CONFIG.openaiModel : null,
        eventsEnrichedCap: CONFIG.openaiMaxEventsPerRefresh,
        articleGrouping:
          Boolean(CONFIG.openaiApiKey && CONFIG.openaiArticleGrouping),
      },
    },
    topics,
    eventsByTopic,
    eventsById,
  };

  writeState(state);
  await persistIngestionToSupabase(articlesVisibleInApp, eventsVisibleInApp, state.meta);
  return state;
}

module.exports = { refreshFromSources };
