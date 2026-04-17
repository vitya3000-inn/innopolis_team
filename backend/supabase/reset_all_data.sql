-- Полная очистка данных ingestion (статьи, события, связи, прогоны).
-- Выполнить в Supabase: SQL Editor → New query → вставить и Run.
-- Схема таблиц не трогается. RLS/политики не меняются.

-- Вариант A (предпочтительно): одна команда, быстро на больших объёмах.
-- CASCADE подхватывает зависимые таблицы по FK.
truncate table
  public.event_articles,
  public.events,
  public.ingestion_runs,
  public.articles
restart identity cascade;

-- Вариант B (эквивалент через DELETE, если TRUNCATE недоступен):
-- Сначала удаляются runs → каскадом events и event_articles (см. schema.sql).
-- delete from public.ingestion_runs;
-- delete from public.articles;
