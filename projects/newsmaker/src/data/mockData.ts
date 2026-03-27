import { Topic, Event, Source, Opinion } from '../types';

// Источники новостей
export const mockSources: Source[] = [
  {
    id: 'bbc',
    name: 'BBC News',
    country: 'UK',
    reliability: 'high',
    politicalLeaning: 'center',
  },
  {
    id: 'cnn',
    name: 'CNN',
    country: 'USA',
    reliability: 'high',
    politicalLeaning: 'center-left',
  },
  {
    id: 'reuters',
    name: 'Reuters',
    country: 'UK',
    reliability: 'high',
    politicalLeaning: 'center',
  },
  {
    id: 'fox',
    name: 'Fox News',
    country: 'USA',
    reliability: 'medium',
    politicalLeaning: 'right',
  },
  {
    id: 'guardian',
    name: 'The Guardian',
    country: 'UK',
    reliability: 'high',
    politicalLeaning: 'center-left',
  },
  {
    id: 'aljazeera',
    name: 'Al Jazeera',
    country: 'Qatar',
    reliability: 'high',
    politicalLeaning: 'center',
  },
  {
    id: 'dw',
    name: 'Deutsche Welle',
    country: 'Germany',
    reliability: 'high',
    politicalLeaning: 'center',
  },
  {
    id: 'nyt',
    name: 'New York Times',
    country: 'USA',
    reliability: 'high',
    politicalLeaning: 'center-left',
  },
];

// Темы
export const mockTopics: Topic[] = [
  {
    id: 'us-elections-2026',
    title: 'Выборы в США 2026',
    category: 'politics',
    eventsCount: 12,
    lastUpdate: '2 часа назад',
    trending: true,
    mentionsCount: 4523,
  },
  {
    id: 'iran-conflict',
    title: 'Ситуация в Иране',
    category: 'world',
    eventsCount: 8,
    lastUpdate: '1 час назад',
    trending: true,
    mentionsCount: 3891,
  },
  {
    id: 'eu-ai-act',
    title: 'AI Act в Евросоюзе',
    category: 'technology',
    eventsCount: 5,
    lastUpdate: '4 часа назад',
    trending: false,
    mentionsCount: 2156,
  },
  {
    id: 'climate-summit',
    title: 'Климатический саммит 2026',
    category: 'environment',
    eventsCount: 6,
    lastUpdate: '30 минут назад',
    trending: true,
    mentionsCount: 1987,
  },
  {
    id: 'global-economy',
    title: 'Мировая экономика',
    category: 'economics',
    eventsCount: 15,
    lastUpdate: '1 час назад',
    trending: false,
    mentionsCount: 3421,
  },
  {
    id: 'health-crisis',
    title: 'Здравоохранение в кризисе',
    category: 'health',
    eventsCount: 4,
    lastUpdate: '3 часа назад',
    trending: false,
    mentionsCount: 1243,
  },
];

// События для темы "Выборы в США"
export const mockEventsUSElections: Event[] = [
  {
    id: 'us-elect-1',
    topicId: 'us-elections-2026',
    title: 'Дебаты кандидатов: ключевые моменты',
    summary: 'Первые теледебаты между основными кандидатами прошли в напряжённой атмосфере. Обсуждались вопросы экономики, иммиграции и внешней политики.',
    keyFacts: [
      'Дебаты длились 2 часа 15 минут',
      'Более 65 миллионов зрителей',
      'Главная тема — экономическая политика',
      'Оба кандидата критиковали позиции друг друга',
    ],
    timestamp: '2 часа назад',
    isBreaking: true,
    sources: mockSources.slice(0, 5),
    opinions: [
      {
        sourceId: 'bbc',
        sourceName: 'BBC News',
        stance: 'neutral',
        summary: 'Дебаты показали глубокий раскол в американском обществе по ключевым вопросам.',
        keyPoints: ['Объективный анализ', 'Акцент на фактах', 'Без явных предпочтений'],
        articleUrl: 'https://bbc.com/news/...',
      },
      {
        sourceId: 'cnn',
        sourceName: 'CNN',
        stance: 'positive',
        summary: 'Демократический кандидат показал уверенное выступление и доминировал в обсуждении.',
        keyPoints: ['Поддержка демократов', 'Критика республиканцев', 'Акцент на социальных вопросах'],
        articleUrl: 'https://cnn.com/...',
      },
      {
        sourceId: 'fox',
        sourceName: 'Fox News',
        stance: 'critical',
        summary: 'Республиканский кандидат убедительно отстаивал консервативные ценности.',
        keyPoints: ['Поддержка республиканцев', 'Критика демократов', 'Акцент на экономике'],
        articleUrl: 'https://foxnews.com/...',
      },
      {
        sourceId: 'reuters',
        sourceName: 'Reuters',
        stance: 'neutral',
        summary: 'Оба кандидата избегали конкретных ответов на сложные вопросы.',
        keyPoints: ['Фактологический подход', 'Без оценочных суждений'],
        articleUrl: 'https://reuters.com/...',
      },
    ],
  },
  {
    id: 'us-elect-2',
    topicId: 'us-elections-2026',
    title: 'Новые опросы: рейтинги кандидатов',
    summary: 'Свежие социологические данные показывают минимальный разрыв между кандидатами в ключевых штатах.',
    keyFacts: [
      'Разрыв в пределах статистической погрешности',
      'Пенсильвания и Мичиган — ключевые штаты',
      'Рост поддержки среди молодёжи',
    ],
    timestamp: '5 часов назад',
    isBreaking: false,
    sources: mockSources.slice(0, 4),
    opinions: [
      {
        sourceId: 'nyt',
        sourceName: 'New York Times',
        stance: 'neutral',
        summary: 'Гонка остаётся непредсказуемой, результат решат колеблющиеся штаты.',
        keyPoints: ['Глубокий анализ данных', 'Исторические параллели'],
        articleUrl: 'https://nytimes.com/...',
      },
      {
        sourceId: 'guardian',
        sourceName: 'The Guardian',
        stance: 'positive',
        summary: 'Демократы набирают momentum в финальные недели кампании.',
        keyPoints: ['Оптимистичный прогноз для демократов'],
        articleUrl: 'https://theguardian.com/...',
      },
    ],
  },
  {
    id: 'us-elect-3',
    topicId: 'us-elections-2026',
    title: 'Скандал с финансированием кампании',
    summary: 'Расследование выявило потенциальные нарушения в финансировании предвыборной кампании одного из кандидатов.',
    keyFacts: [
      'Начато официальное расследование',
      'Сумма подозрительных транзакций — $2.3 млн',
      'Кандидат отрицает обвинения',
    ],
    timestamp: '8 часов назад',
    isBreaking: false,
    sources: mockSources.slice(0, 6),
    opinions: [
      {
        sourceId: 'cnn',
        sourceName: 'CNN',
        stance: 'critical',
        summary: 'Серьёзные обвинения требуют тщательного расследования.',
        keyPoints: ['Требование прозрачности', 'Критика кандидата'],
        articleUrl: 'https://cnn.com/...',
      },
      {
        sourceId: 'fox',
        sourceName: 'Fox News',
        stance: 'negative',
        summary: 'Обвинения политически мотивированы и не имеют под собой оснований.',
        keyPoints: ['Защита кандидата', 'Обвинения в предвзятости СМИ'],
        articleUrl: 'https://foxnews.com/...',
      },
    ],
  },
];

// События для темы "Ситуация в Иране"
export const mockEventsIran: Event[] = [
  {
    id: 'iran-1',
    topicId: 'iran-conflict',
    title: 'Переговоры в Женеве: прогресс или тупик?',
    summary: 'Многосторонние переговоры по иранской ядерной программе завершились без конкретных договорённостей.',
    keyFacts: [
      'Участвовали представители 6 стран',
      'Переговоры длились 3 дня',
      'Следующий раунд запланирован на апрель',
      'Иран настаивает на снятии санкций',
    ],
    timestamp: '1 час назад',
    isBreaking: true,
    sources: mockSources,
    opinions: [
      {
        sourceId: 'aljazeera',
        sourceName: 'Al Jazeera',
        stance: 'neutral',
        summary: 'Переговоры показали готовность сторон к диалогу, но разногласия остаются существенными.',
        keyPoints: ['Региональная перспектива', 'Баланс интересов'],
        articleUrl: 'https://aljazeera.com/...',
      },
      {
        sourceId: 'bbc',
        sourceName: 'BBC News',
        stance: 'neutral',
        summary: 'Дипломатический процесс продвигается медленно, но прекращение переговоров исключено.',
        keyPoints: ['Объективный анализ', 'Исторический контекст'],
        articleUrl: 'https://bbc.com/...',
      },
      {
        sourceId: 'dw',
        sourceName: 'Deutsche Welle',
        stance: 'positive',
        summary: 'Европейские посредники отмечают конструктивную атмосферу переговоров.',
        keyPoints: ['Европейская позиция', 'Оптимизм'],
        articleUrl: 'https://dw.com/...',
      },
    ],
  },
  {
    id: 'iran-2',
    topicId: 'iran-conflict',
    title: 'Новые санкции США против Ирана',
    summary: 'Администрация США объявила о введении дополнительных санкций против иранских компаний.',
    keyFacts: [
      'Санкции затронут 15 компаний',
      'Основание — поддержка ядерной программы',
      'Иран назвал санкции "актом агрессии"',
    ],
    timestamp: '6 часов назад',
    isBreaking: false,
    sources: mockSources.slice(0, 5),
    opinions: [
      {
        sourceId: 'fox',
        sourceName: 'Fox News',
        stance: 'positive',
        summary: 'Жёсткая позиция США необходима для сдерживания иранской угрозы.',
        keyPoints: ['Поддержка санкций', 'Акцент на безопасности'],
        articleUrl: 'https://foxnews.com/...',
      },
      {
        sourceId: 'guardian',
        sourceName: 'The Guardian',
        stance: 'critical',
        summary: 'Санкции могут подорвать дипломатический процесс и ухудшить гуманитарную ситуацию.',
        keyPoints: ['Критика санкций', 'Гуманитарные последствия'],
        articleUrl: 'https://theguardian.com/...',
      },
    ],
  },
];

// События для темы "AI Act"
export const mockEventsAIAct: Event[] = [
  {
    id: 'ai-1',
    topicId: 'eu-ai-act',
    title: 'AI Act вступает в силу: что изменится',
    summary: 'Европейский закон об искусственном интеллекте начинает действовать. Компании готовятся к новым требованиям.',
    keyFacts: [
      'Закон распространяется на все AI-системы в ЕС',
      'Штрафы до 7% от мирового оборота',
      'Переходный период — 2 года',
      'Обязательная маркировка AI-контента',
    ],
    timestamp: '4 часа назад',
    isBreaking: false,
    sources: mockSources.slice(0, 4),
    opinions: [
      {
        sourceId: 'reuters',
        sourceName: 'Reuters',
        stance: 'neutral',
        summary: 'Закон устанавливает глобальный стандарт регулирования AI, но его эффективность ещё предстоит оценить.',
        keyPoints: ['Фактический анализ', 'Глобальное влияние'],
        articleUrl: 'https://reuters.com/...',
      },
      {
        sourceId: 'dw',
        sourceName: 'Deutsche Welle',
        stance: 'positive',
        summary: 'ЕС становится лидером в защите прав граждан в эпоху искусственного интеллекта.',
        keyPoints: ['Европейское лидерство', 'Защита прав'],
        articleUrl: 'https://dw.com/...',
      },
    ],
  },
];

// Функция получения событий по ID темы
export function getEventsByTopicId(topicId: string): Event[] {
  switch (topicId) {
    case 'us-elections-2026':
      return mockEventsUSElections;
    case 'iran-conflict':
      return mockEventsIran;
    case 'eu-ai-act':
      return mockEventsAIAct;
    default:
      return [];
  }
}

// Функция получения события по ID
export function getEventById(eventId: string): Event | undefined {
  const allEvents = [
    ...mockEventsUSElections,
    ...mockEventsIran,
    ...mockEventsAIAct,
  ];
  return allEvents.find(event => event.id === eventId);
}

// Функция получения темы по ID
export function getTopicById(topicId: string): Topic | undefined {
  return mockTopics.find(topic => topic.id === topicId);
}
