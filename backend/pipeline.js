const { fetchTopPoliticalArticles } = require('./newsApi');
const { translateEnToRu } = require('./translate');
const { clusterArticlesIntoEvents, groupEventsIntoTopics } = require('./cluster');
const { enrichEventsWithLLM } = require('./llmOpenAI');
const { writeState } = require('./store');
const { CONFIG } = require('./config');

async function translateArticlesToRu(articles) {
  const translated = [];
  for (const article of articles) {
    const titleRu = await translateEnToRu(article.title || '');
    const descriptionRu = await translateEnToRu(article.description || article.content || '');
    translated.push({
      ...article,
      title: titleRu || article.title,
      description: descriptionRu || article.description || article.content || '',
    });
  }
  return translated;
}

async function refreshFromSources(options = {}) {
  const fetched = await fetchTopPoliticalArticles(options);
  const preparedArticles =
    CONFIG.targetLanguage === 'ru' ? await translateArticlesToRu(fetched) : fetched;
  const events = clusterArticlesIntoEvents(preparedArticles);
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
      },
    },
    topics,
    eventsByTopic,
    eventsById,
  };

  writeState(state);
  return state;
}

module.exports = { refreshFromSources };
