const crypto = require('crypto');
const { CONFIG } = require('./config');

const RU_STOP_WORDS = new Set([
  'и',
  'в',
  'на',
  'с',
  'по',
  'для',
  'что',
  'это',
  'как',
  'или',
  'из',
  'к',
  'о',
  'об',
  'за',
  'от',
  'после',
  'до',
  'при',
  'под',
  'над',
  'the',
  'a',
  'an',
  'to',
  'of',
  'in',
  'on',
  'with',
]);

const FIXED_TOPICS = [
  {
    id: 'iran-war',
    title: 'Война в Иране',
    category: 'politics',
    keywords: [
      'iran',
      'tehran',
      'iaea',
      'nuclear',
      'middle east',
      // RU
      'иран',
      'тегеран',
      'мага',
      'магатэ',
      'ядерн',
      'ближн',
      'восток',
    ],
  },
  {
    id: 'ukraine-operation',
    title: 'Военная операция на Украине',
    category: 'politics',
    keywords: [
      'ukraine',
      'kyiv',
      'kiev',
      'russia',
      'moscow',
      'donbas',
      'zelensky',
      'kremlin',
      // RU
      'украин',
      'киев',
      'росси',
      'москв',
      'донбас',
      'зеленск',
      'кремл',
      'харьков',
      'одесс',
    ],
  },
  {
    id: 'israel-gaza-lebanon',
    title: 'Война Израиля в Газе и Ливане',
    category: 'politics',
    keywords: [
      'israel',
      'israeli',
      'gaza',
      'hamas',
      'palestinian',
      'rafah',
      'lebanon',
      'hezbollah',
      'idf',
      'netanyahu',
      'beirut',
      // RU
      'израил',
      'газа',
      'хамас',
      'палестин',
      'рафах',
      'ливан',
      'хезболл',
      'цахал',
      'нетаньяху',
      'бейрут',
    ],
  },
];

function slugify(input) {
  return (input || '')
    .toLowerCase()
    .replace(/[^a-zа-я0-9\s-]/gi, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

function tokenize(input) {
  return (input || '')
    .toLowerCase()
    .replace(/[^a-zа-я0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !RU_STOP_WORDS.has(word));
}

function similarity(a, b) {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (!setA.size || !setB.size) return 0;
  const intersection = [...setA].filter((word) => setB.has(word)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

function pickTopWords(text, count = 3) {
  const frequencies = new Map();
  tokenize(text).forEach((word) => {
    frequencies.set(word, (frequencies.get(word) || 0) + 1);
  });
  return [...frequencies.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([word]) => word);
}

function buildTopicTitleFromEvents(events) {
  const combined = events.map((event) => event.title).join(' ');
  const topWords = pickTopWords(combined, 3);
  if (!topWords.length) return 'Политическая тема';
  return topWords
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function relativeTime(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'недавно';
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));
  if (diffHours < 24) return `${diffHours} ч назад`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} д назад`;
}

function normalizeText(input) {
  return (input || '').toLowerCase();
}

function detectFixedTopic(event) {
  const text = normalizeText(`${event.title} ${event.summary}`);
  for (const topic of FIXED_TOPICS) {
    if (topic.keywords.some((keyword) => text.includes(keyword))) {
      return topic;
    }
  }
  return null;
}

function eventFromArticle(article) {
  const sourceName = article.source?.name || 'Unknown';
  const title = article.title || 'Без заголовка';
  const description = article.description || article.content || title;

  return {
    id: `ev-${crypto.createHash('md5').update(article.url).digest('hex').slice(0, 12)}`,
    title,
    summary: description,
    keyFacts: [
      `Источник: ${sourceName}`,
      `Опубликовано: ${new Date(article.publishedAt).toLocaleString('ru-RU')}`,
      article.author ? `Автор: ${article.author}` : 'Автор не указан',
    ],
    timestamp: relativeTime(article.publishedAt),
    publishedAt: article.publishedAt,
    isBreaking: Date.now() - new Date(article.publishedAt).getTime() < 1000 * 60 * 60 * 6,
    sources: [
      {
        id: slugify(sourceName) || 'unknown',
        name: sourceName,
        country: 'Unknown',
        reliability: 'high',
        politicalLeaning: 'center',
      },
    ],
    opinions: [
      {
        sourceId: slugify(sourceName) || 'unknown',
        sourceName,
        stance: 'neutral',
        summary: description,
        keyPoints: pickTopWords(`${title} ${description}`, 3),
        articleUrl: article.url,
      },
    ],
  };
}

function clusterArticlesIntoEvents(articles) {
  const clusters = [];

  for (const article of articles) {
    const articleText = `${article.title || ''} ${article.description || ''}`;
    let targetCluster = null;

    for (const cluster of clusters) {
      const score = similarity(cluster.signature, articleText);
      if (score >= 0.28) {
        targetCluster = cluster;
        break;
      }
    }

    if (!targetCluster) {
      targetCluster = { signature: articleText, items: [] };
      clusters.push(targetCluster);
    }

    targetCluster.items.push(article);
  }

  const events = clusters.map((cluster) => {
    const items = cluster.items.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
    const lead = items[0];
    const baseEvent = eventFromArticle(lead);

    const sourceToLatestArticle = new Map();
    items.forEach((item) => {
      const sourceName = item.source?.name || 'Unknown';
      const sourceId = slugify(sourceName) || 'unknown';
      const prev = sourceToLatestArticle.get(sourceId);
      if (!prev || new Date(item.publishedAt).getTime() > new Date(prev.publishedAt).getTime()) {
        sourceToLatestArticle.set(sourceId, item);
      }
    });

    const sources = [...sourceToLatestArticle.entries()].map(([sourceId, item]) => ({
      id: sourceId,
      name: item.source?.name || 'Unknown',
      country: 'Unknown',
      reliability: 'high',
      politicalLeaning: 'center',
    }));

    const opinions = [...sourceToLatestArticle.entries()].map(([sourceId, item]) => ({
      sourceId,
      sourceName: item.source?.name || 'Unknown',
      stance: 'neutral',
      summary: item.description || item.content || item.title || '',
      keyPoints: pickTopWords(`${item.title || ''} ${item.description || ''}`, 3),
      articleUrl: item.url,
    }));

    return {
      ...baseEvent,
      summary: lead.description || lead.content || lead.title || '',
      keyFacts: [
        `Упоминаний в источниках: ${items.length}`,
        `Последнее обновление: ${new Date(lead.publishedAt).toLocaleString('ru-RU')}`,
        `Источник-лидер: ${lead.source?.name || 'Unknown'}`,
      ],
      sources,
      opinions: opinions.slice(0, CONFIG.sourceIds.length),
      mentionsCount: items.length,
    };
  });

  return events.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

function groupEventsIntoTopics(events) {
  // LLM-режим: для главного экрана MVP показываем только фикс-темы (3 штуки).
  // Это соответствует UX-требованию "всегда 3 конфликта на главном".
  if (CONFIG.openaiApiKey) {
    const fixedBuckets = new Map();
    FIXED_TOPICS.forEach((topic) => {
      fixedBuckets.set(topic.id, { topic, events: [] });
    });

    for (const event of events) {
      const fixed = detectFixedTopic(event);
      if (fixed) {
        fixedBuckets.get(fixed.id).events.push(event);
      }
    }

    // Фильтр нерелевантных событий: если LLM проставила низкую релевантность к теме — выбрасываем из выдачи.
    // Это защищает от "случайных" матчей по ключевым словам и шумных статей.
    for (const [topicId, bucket] of fixedBuckets.entries()) {
      bucket.events = (bucket.events || []).filter((e) => {
        if (typeof e?.llmTopicRelevance === 'number') {
          return e.llmTopicRelevance >= CONFIG.openaiMinTopicRelevance;
        }
        return true;
      });
      fixedBuckets.set(topicId, bucket);
    }

    function toTopicObject(id, title, category, bucketEvents) {
      const sortedEvents = bucketEvents.sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      );
      const mentionsCount = sortedEvents.reduce((acc, ev) => acc + (ev.mentionsCount || 1), 0);
      return {
        id,
        title,
        category,
        eventsCount: Math.min(sortedEvents.length, CONFIG.maxEventsPerTopic),
        lastUpdate: sortedEvents[0] ? relativeTime(sortedEvents[0].publishedAt) : 'недавно',
        trending: mentionsCount >= 3,
        mentionsCount,
        events: sortedEvents.slice(0, CONFIG.maxEventsPerTopic).map((event) => ({
          ...event,
          topicId: id,
        })),
      };
    }

    const fixedTopics = FIXED_TOPICS.map((topic) => {
      const bucketEvents = fixedBuckets.get(topic.id)?.events || [];
      return toTopicObject(`topic-fixed-${topic.id}`, topic.title, topic.category, bucketEvents);
    });
    return fixedTopics;
  }

  const fixedBuckets = new Map();
  FIXED_TOPICS.forEach((topic) => {
    fixedBuckets.set(topic.id, { topic, events: [] });
  });

  const dynamicBuckets = [];
  for (const event of events) {
    const fixedTopic = detectFixedTopic(event);
    if (fixedTopic) {
      fixedBuckets.get(fixedTopic.id).events.push(event);
      continue;
    }

    let target = null;
    for (const bucket of dynamicBuckets) {
      const score = similarity(bucket.signature, `${event.title} ${event.summary}`);
      if (score >= 0.22) {
        target = bucket;
        break;
      }
    }

    if (!target) {
      target = { signature: `${event.title} ${event.summary}`, events: [] };
      dynamicBuckets.push(target);
    }

    target.events.push(event);
  }

  const fixedTopics = [...fixedBuckets.values()].map(({ topic, events: bucketEvents }) => {
    const sortedEvents = bucketEvents.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
    const mentionsCount = sortedEvents.reduce((acc, ev) => acc + (ev.mentionsCount || 1), 0);
    return {
      id: `topic-fixed-${topic.id}`,
      title: topic.title,
      category: topic.category,
      eventsCount: Math.min(sortedEvents.length, CONFIG.maxEventsPerTopic),
      lastUpdate: sortedEvents[0] ? relativeTime(sortedEvents[0].publishedAt) : 'недавно',
      trending: mentionsCount >= 3,
      mentionsCount,
      events: sortedEvents.slice(0, CONFIG.maxEventsPerTopic).map((event) => ({
        ...event,
        topicId: `topic-fixed-${topic.id}`,
      })),
    };
  });

  const dynamicTopics = dynamicBuckets
    .map((bucket, index) => {
      const sortedEvents = bucket.events.sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      );
      const topicId = `topic-${index + 1}-${slugify(buildTopicTitleFromEvents(sortedEvents))}`;
      const mentionsCount = sortedEvents.reduce((acc, ev) => acc + (ev.mentionsCount || 1), 0);
      return {
        id: topicId,
        title: buildTopicTitleFromEvents(sortedEvents),
        category: 'politics',
        eventsCount: Math.min(sortedEvents.length, CONFIG.maxEventsPerTopic),
        lastUpdate: relativeTime(sortedEvents[0]?.publishedAt),
        trending: mentionsCount >= 3,
        mentionsCount,
        events: sortedEvents.slice(0, CONFIG.maxEventsPerTopic).map((event) => ({
          ...event,
          topicId,
        })),
      };
    })
    .sort((a, b) => b.mentionsCount - a.mentionsCount);

  const nonEmptyFixed = fixedTopics.filter((topic) => topic.eventsCount > 0);
  const remainingSlots = Math.max(0, CONFIG.maxTopics - nonEmptyFixed.length);
  const topics = [
    ...nonEmptyFixed,
    ...dynamicTopics.filter((topic) => topic.eventsCount > 0).slice(0, remainingSlots),
  ];

  return topics;
}

module.exports = {
  clusterArticlesIntoEvents,
  groupEventsIntoTopics,
};
