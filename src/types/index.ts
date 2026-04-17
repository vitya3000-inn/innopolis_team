// Тема (крупная категория новостей)
export interface Topic {
  id: string;
  title: string;
  category: Category;
  eventsCount: number;
  lastUpdate: string;
  trending: boolean;
  mentionsCount: number;
  previewImage?: string;
}

// Событие внутри темы
export interface Event {
  id: string;
  topicId: string;
  title: string;
  summary: string;
  keyFacts: string[];
  timestamp: string;
  /** ISO-дата публикации с backend; используется для сортировки по новизне */
  publishedAt?: string;
  sources: Source[];
  opinions: Opinion[];
  isBreaking: boolean;
}

// Источник новостей (СМИ)
export interface Source {
  id: string;
  name: string;
  country: string;
  logo?: string;
  reliability: 'high' | 'medium' | 'low';
  politicalLeaning: 'left' | 'center-left' | 'center' | 'center-right' | 'right';
}

// Мнение источника о событии
export interface Opinion {
  sourceId: string;
  sourceName: string;
  stance: 'positive' | 'neutral' | 'negative' | 'critical';
  summary: string;
  keyPoints: string[];
  articleUrl: string;
}

// Категории новостей
export type Category = 
  | 'politics'
  | 'economics'
  | 'technology'
  | 'society'
  | 'environment'
  | 'health'
  | 'world';

// Фильтры для ленты
export interface FeedFilters {
  categories: Category[];
  onlyBreaking: boolean;
  onlyTrending: boolean;
}
