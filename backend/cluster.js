const crypto = require('crypto');
const { CONFIG } = require('./config');
const { stripNewsApiTruncationMeta, trimBodyToLastCompleteSentence } = require('./newsTextCleanup');

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
      // Geography
      'iran',
      'tehran',
      'isfahan',
      'tabriz',
      'mashhad',
      'khuzestan',
      'hormuz',
      'strait of hormuz',
      'persian gulf',
      // Actors & programs
      'iaea',
      'nuclear',
      'uranium',
      'enrichment',
      'centrifuge',
      'khamenei',
      'raisi',
      'pezeshkian',
      'irgc',
      'revolutionary guard',
      'rouhani',
      // Conflict / diplomacy
      'middle east',
      'airstrikes iran',
      'iran sanctions',
      'iran deal',
      'jcpoa',
      'iran missile',
      'iran drone',
      'iran attack',
      'iran nuclear',
      'iran war',
      // RU
      'иран',
      'тегеран',
      'исфахан',
      'тебриз',
      'мага',
      'магатэ',
      'ядерн',
      'уран',
      'обогащ',
      'хаменеи',
      'раиси',
      'ирг',
      'хормуз',
      'ближн',
      'восток',
      'санкции иран',
      'иранск',
    ],
  },
  {
    id: 'ukraine-operation',
    title: 'Военная операция на Украине',
    category: 'politics',
    keywords: [
      // Geography — Ukraine specific
      'ukraine',
      'ukrainian',
      'kyiv',
      'kiev',
      'kharkiv',
      'odesa',
      'odessa',
      'mariupol',
      'zaporizhzhia',
      'zaporizhia',
      'kherson',
      'donetsk',
      'luhansk',
      'bakhmut',
      'avdiivka',
      'crimea',
      'donbas',
      'donbass',
      // Actors
      'zelensky',
      'zelenskyy',
      'zaluzhny',
      'nato ukraine',
      'ukrainian army',
      'ukrainian forces',
      'ukrainian troops',
      // Russia in war context
      'russian invasion',
      'russian troops',
      'russian forces',
      'russian army',
      'russian missile',
      'russian drone',
      'russian attack',
      'russian airstrike',
      'russian offensive',
      'russian withdrawal',
      'russia ukraine',
      'kremlin ukraine',
      'putin ukraine',
      // Conflict terms
      'frontline ukraine',
      'ceasefire ukraine',
      'peace talks ukraine',
      'war in ukraine',
      'conflict ukraine',
      'aid to ukraine',
      'weapons ukraine',
      'ukraine aid',
      // RU
      'украин',
      'киев',
      'харьков',
      'одесс',
      'мариуполь',
      'запорожь',
      'херсон',
      'донецк',
      'луганск',
      'бахмут',
      'авдеевк',
      'крым',
      'донбас',
      'зеленск',
      'залужн',
      'фронт украин',
      'война украин',
      'российск войск',
      'россия украина',
      'нато украина',
      'перемирие украин',
      'мирные переговор',
      'поставки оружия',
    ],
  },
  {
    id: 'israel-gaza-lebanon',
    title: 'Война Израиля в Газе и Ливане',
    category: 'politics',
    keywords: [
      // Geography
      'israel',
      'israeli',
      'gaza',
      'west bank',
      'rafah',
      'khan younis',
      'jenin',
      'ramallah',
      'tel aviv',
      'jerusalem',
      'lebanon',
      'beirut',
      'south lebanon',
      'golan',
      // Actors
      'hamas',
      'hezbollah',
      'idf',
      'netanyahu',
      'sinwar',
      'nasrallah',
      'fatah',
      'plo',
      'unrwa',
      'Palestinian authority',
      // Conflict terms
      'palestinian',
      'airstrikes israel',
      'israel airstrike',
      'israel attack',
      'israel offensive',
      'israel ground',
      'israel invasion',
      'hostages israel',
      'ceasefire gaza',
      'ceasefire israel',
      'humanitarian corridor',
      'siege of gaza',
      'iron dome',
      'october 7',
      // RU
      'израил',
      'газа',
      'западн берег',
      'тель-авив',
      'иерусалим',
      'хамас',
      'палестин',
      'рафах',
      'хан-юнис',
      'дженин',
      'ливан',
      'хезболл',
      'цахал',
      'нетаньяху',
      'синвар',
      'бейрут',
      'юнрва',
      'перемирие газа',
      'перемирие израиль',
      'вторжение израил',
      'война израил',
      'заложники израил',
      'гуманитарн коридор',
      'железный купол',
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

// Временное окно для матча по редким именованным сущностям
const CLUSTER_ENTITY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 ч

// Порог встречаемости: сущность, появляющаяся в >8% статей,
// слишком общая (Trump, Iran, war) и не помогает различать события.
const RARE_ENTITY_MAX_RATIO = 0.08;

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

/**
 * Document frequency: токен встречается в > ratio доли статей — «массовый», мешает склейке разных историй.
 */
function buildCommonTokenFilter(articles, maxRatio) {
  const ratio =
    maxRatio != null ? maxRatio : CONFIG.clusterCommonTokenMaxRatio ?? 0.22;
  const n = articles.length || 1;
  const docFreq = new Map();
  articles.forEach((a) => {
    const bag = new Set(tokenize(`${a.title || ''} ${a.description || ''}`));
    bag.forEach((w) => docFreq.set(w, (docFreq.get(w) || 0) + 1));
  });
  return (word) => (docFreq.get(word) || 0) / n > ratio;
}

/** Jaccard по токенам без массовых для данного пула статей. */
function similarityDiscriminativeWithFilter(textA, textB, isCommonToken) {
  const setA = new Set(tokenize(textA).filter((w) => !isCommonToken(w)));
  const setB = new Set(tokenize(textB).filter((w) => !isCommonToken(w)));
  const raw = similarity(textA, textB);
  if (!setA.size && !setB.size) {
    return raw * 0.22;
  }
  if (!setA.size || !setB.size) {
    return Math.max(raw * 0.35, 0);
  }
  const intersection = [...setA].filter((word) => setB.has(word)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

/**
 * Извлекает именованные сущности (заглавные слова и биграммы) из середины предложений.
 * Пример: "Trump considers leaving NATO" → {trump, nato, trump nato}
 */
function extractEntities(text) {
  const entities = new Set();
  const words = (text || '').replace(/[,;:!?"'()]/g, ' ').split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    const raw = words[i];
    const prev = words[i - 1] || '';
    const clean = raw.replace(/[^a-zA-ZА-Яа-я]/g, '');
    if (clean.length < 2) continue;
    // Пропускаем начало нового предложения
    if (/[.!?]$/.test(prev)) continue;
    if (/^[A-ZА-Я]/.test(clean)) {
      const lower = clean.toLowerCase();
      entities.add(lower);
      // Биграмма: "United States", "West Bank", "Luhanskaya oblast"
      if (i + 1 < words.length) {
        const next = words[i + 1].replace(/[^a-zA-ZА-Яа-я]/g, '');
        if (/^[A-ZА-Я]/.test(next) && next.length > 1) {
          entities.add(lower + ' ' + next.toLowerCase());
        }
      }
    }
  }
  return entities;
}

function countEntityOverlap(setA, setB) {
  return [...setA].filter((e) => setB.has(e)).length;
}

function jaccardOnTokenSets(setA, setB) {
  if (!setA.size || !setB.size) return 0;
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

/**
 * Подсчитывает глобальную частоту именованных сущностей по всем статьям.
 * Возвращает функцию isRare(entity): true, если сущность встречается редко
 * (≤ RARE_ENTITY_MAX_RATIO от всего пула) — значит, она специфична для события.
 */
function buildEntityRarityFilter(articles) {
  const counts = new Map();
  const n = articles.length || 1;
  articles.forEach((a) => {
    extractEntities(`${a.title || ''} ${a.description || ''}`).forEach((e) => {
      counts.set(e, (counts.get(e) || 0) + 1);
    });
  });
  return (entity) => (counts.get(entity) || 0) / n <= RARE_ENTITY_MAX_RATIO;
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

/** Секция приложения: сначала якорь статьи (fixedTopicId), иначе текст после LLM. */
function resolveFixedTopic(event) {
  return (
    (event.fixedTopicId && FIXED_TOPICS.find((t) => t.id === event.fixedTopicId)) ||
    detectFixedTopic(event) ||
    null
  );
}

/** Фикс-тема по сырому тексту статьи (до сборки события). */
function detectFixedTopicForArticle(article) {
  const text = normalizeText(
    `${article.title || ''} ${article.description || ''} ${article.content || ''}`,
  );
  for (const topic of FIXED_TOPICS) {
    if (topic.keywords.some((keyword) => text.includes(keyword))) {
      return topic;
    }
  }
  return null;
}

/** Стабильный id статьи для LLM-батчей (совпадает с префиксом хеша URL). */
function articleStableId(article) {
  const url = article.url || `${article.title || ''}|${article.publishedAt || ''}`;
  return `a-${crypto.createHash('md5').update(url).digest('hex').slice(0, 12)}`;
}

function stripNewsApiMetaTail(text) {
  return stripNewsApiTruncationMeta(text);
}

/**
 * Текст для блока «Позиции СМИ»: заголовок + описание + осмысленный кусок content,
 * без обрыва на «…» от NewsAPI; обрезка только по последнему полному предложению.
 */
function formatArticleExcerptForUi(article) {
  const title = stripNewsApiMetaTail(article.title || '').trim();
  let desc = stripNewsApiMetaTail(article.description || '').trim();
  desc = desc.replace(/…\s*$/u, '').replace(/\.\.\.\s*$/, '').trim();
  let content = String(article.content || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  content = stripNewsApiMetaTail(content);

  const parts = [];
  if (title) parts.push(title);
  if (desc) parts.push(desc);

  const descLower = desc.replace(/\s+/g, ' ').toLowerCase();
  const contentLower = content.toLowerCase();
  const prefixLen = Math.min(100, descLower.length);
  const redundant =
    descLower.length > 50 &&
    prefixLen > 0 &&
    contentLower.startsWith(descLower.slice(0, prefixLen));

  const maxBodyChars = 2400;
  if (content.length > 120 && !redundant) {
    let body = content.length > maxBodyChars ? content.slice(0, maxBodyChars) : content;
    const lastDot = body.lastIndexOf('. ');
    if (lastDot >= 280) body = body.slice(0, lastDot + 1);
    body = trimBodyToLastCompleteSentence(body, 90);
    parts.push(body.trim());
  }

  return parts.filter(Boolean).join('\n\n');
}

function buildMergedEventFromArticles(items) {
  const sortedItems = [...items].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
  const oldestFirst = [...items].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(),
  );
  const anchor = oldestFirst[0];
  const fixedTopicId = detectFixedTopicForArticle(anchor)?.id ?? null;
  const lead = sortedItems[0];
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
    summary: formatArticleExcerptForUi(item),
    keyPoints: pickTopWords(`${item.title || ''} ${item.description || ''}`, 3),
    articleUrl: item.url,
  }));

  return {
    ...baseEvent,
    fixedTopicId,
    summary: formatArticleExcerptForUi(lead),
    keyFacts: [
      `Упоминаний в источниках: ${items.length}`,
      `Последнее обновление: ${new Date(lead.publishedAt).toLocaleString('ru-RU')}`,
      `Источник-лидер: ${lead.source?.name || 'Unknown'}`,
    ],
    sources,
    opinions: opinions.slice(0, CONFIG.sourceIds.length),
    mentionsCount: items.length,
  };
}

function eventFromArticle(article) {
  const sourceName = article.source?.name || 'Unknown';
  const title = article.title || 'Без заголовка';
  const description = formatArticleExcerptForUi(article) || article.description || article.content || title;

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
        keyPoints: pickTopWords(`${title} ${article.description || ''}`, 3),
        articleUrl: article.url,
      },
    ],
  };
}

function clusterArticlesIntoEvents(articles) {
  // Предварительно вычисляем редкость сущностей по всему пулу статей.
  // Редкие сущности (≤8% встречаемости) специфичны для конкретного события
  // и служат надёжным сигналом совпадения: «Luhansk», «Isfahan», «Kittleson».
  // Частые («Trump», «Iran», «war») игнорируем — они в каждой статье.
  const isRare = buildEntityRarityFilter(articles);

  // Сортируем хронологически: кластеры формируются последовательно
  // и статьи матчатся с хронологически близкими событиями.
  const sorted = [...articles].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(),
  );

  const clusters = [];

  for (const article of sorted) {
    const articleText = `${article.title || ''} ${article.description || ''}`;
    // Редкие именованные сущности этой статьи
    const articleRareEntities = new Set(
      [...extractEntities(articleText)].filter(isRare),
    );
    const articleTime = new Date(article.publishedAt).getTime();

    let targetCluster = null;
    let bestScore = 0;

    for (const cluster of clusters) {
      const timeDiff = Math.abs(articleTime - cluster.latestTime);

      // Правило 1: лексическое сходство (оригинальный Jaccard) без ограничений по времени.
      // Ловит дубли и live-update статьи от одного издания.
      const jScore = similarity(cluster.signature, articleText);

      // Правило 2: ≥2 редких именованных сущностей + окно по времени.
      const rareOverlap = countEntityOverlap(cluster.rareEntities, articleRareEntities);

      let score = 0;
      if (jScore >= 0.28) {
        score = jScore;
      } else if (rareOverlap >= 2 && timeDiff <= CLUSTER_ENTITY_WINDOW_MS) {
        score = 0.05 + rareOverlap * 0.04;
      }

      if (score > bestScore) {
        bestScore = score;
        targetCluster = cluster;
      }
    }

    if (!targetCluster) {
      targetCluster = {
        signature: articleText,
        rareEntities: new Set(articleRareEntities),
        latestTime: articleTime,
        items: [],
      };
      clusters.push(targetCluster);
    } else {
      // Добавляем редкие сущности новой статьи в кластер.
      // Signature НЕ обновляем — это предотвращает «дрейф» и мега-кластеры.
      articleRareEntities.forEach((e) => targetCluster.rareEntities.add(e));
      targetCluster.latestTime = Math.max(targetCluster.latestTime, articleTime);
    }

    targetCluster.items.push(article);
  }

  const events = clusters.map((cluster) => buildMergedEventFromArticles(cluster.items));

  return events.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

/**
 * Этап 1 (без LLM): как clusterArticlesIntoEvents, но кластеры не смешивают разные фикс-темы;
 * окно по редким сущностям задаётся конфигом (обычно шире 24ч).
 */
function clusterArticlesStageOneTopicAware(articles) {
  const isRare = buildEntityRarityFilter(articles);
  const entityWindowMs = CONFIG.openaiArticleGroupStage1EntityWindowMs || CLUSTER_ENTITY_WINDOW_MS;
  const isCommonToken = buildCommonTokenFilter(articles);

  const sorted = [...articles].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(),
  );

  const clusters = [];

  for (const article of sorted) {
    const articleText = `${article.title || ''} ${article.description || ''}`;
    const articleRareEntities = new Set([...extractEntities(articleText)].filter(isRare));
    const articleTime = new Date(article.publishedAt).getTime();
    const fixedKey = detectFixedTopicForArticle(article)?.id ?? '__misc__';

    let targetCluster = null;
    let bestScore = 0;

    for (const cluster of clusters) {
      if (cluster.fixedKey !== fixedKey) continue;

      const timeDiff = Math.abs(articleTime - cluster.latestTime);
      const jScore = similarityDiscriminativeWithFilter(cluster.signature, articleText, isCommonToken);
      const rareOverlap = countEntityOverlap(cluster.rareEntities, articleRareEntities);

      let score = 0;
      if (jScore >= 0.14) {
        score = jScore;
      } else if (rareOverlap >= 2 && timeDiff <= entityWindowMs) {
        score = 0.05 + rareOverlap * 0.04;
      } else if (rareOverlap >= 1 && jScore >= 0.06 && timeDiff <= entityWindowMs) {
        score = 0.08 + jScore * 0.85;
      }

      if (score > bestScore) {
        bestScore = score;
        targetCluster = cluster;
      }
    }

    if (!targetCluster) {
      targetCluster = {
        fixedKey,
        signature: articleText,
        rareEntities: new Set(articleRareEntities),
        latestTime: articleTime,
        items: [],
      };
      clusters.push(targetCluster);
    } else {
      articleRareEntities.forEach((e) => targetCluster.rareEntities.add(e));
      targetCluster.latestTime = Math.max(targetCluster.latestTime, articleTime);
    }

    targetCluster.items.push(article);
  }

  return clusters.map((c) => ({ fixedKey: c.fixedKey, items: [...c.items] }));
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
      const fixed = resolveFixedTopic(event);
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
    const fixedTopic = resolveFixedTopic(event);
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

/** Три фикс-темы без событий — чтобы GET /topics всегда отдавал темы при пустом store. */
function getFixedTopicShellsForApi() {
  return FIXED_TOPICS.map((topic) => ({
    id: `topic-fixed-${topic.id}`,
    title: topic.title,
    category: topic.category,
    eventsCount: 0,
    lastUpdate: 'недавно',
    trending: false,
    mentionsCount: 0,
  }));
}

module.exports = {
  FIXED_TOPICS,
  clusterArticlesIntoEvents,
  clusterArticlesStageOneTopicAware,
  groupEventsIntoTopics,
  detectFixedTopic,
  detectFixedTopicForArticle,
  resolveFixedTopic,
  articleStableId,
  buildMergedEventFromArticles,
  similarity,
  buildCommonTokenFilter,
  similarityDiscriminativeWithFilter,
  getFixedTopicShellsForApi,
};
