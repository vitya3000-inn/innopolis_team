-- Supabase (Postgres): статьи, события, связи, история прогонов ingestion.
-- Выполните весь файл в SQL Editor проекта Supabase (один раз).

create table if not exists public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  article_count int,
  event_count int,
  meta jsonb not null default '{}'::jsonb
);

create table if not exists public.articles (
  stable_id text primary key,
  url text not null unique,
  source_api_id text,
  source_name text,
  title text,
  description text,
  published_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists articles_published_at_idx on public.articles (published_at desc);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ingestion_runs (id) on delete cascade,
  client_event_id text not null,
  topic_id text,
  published_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  unique (run_id, client_event_id)
);

create index if not exists events_run_id_idx on public.events (run_id);
create index if not exists events_published_at_idx on public.events (published_at desc);

create table if not exists public.event_articles (
  event_uuid uuid not null references public.events (id) on delete cascade,
  article_stable_id text not null references public.articles (stable_id) on delete cascade,
  sort_order int not null default 0,
  primary key (event_uuid, article_stable_id)
);

create index if not exists event_articles_article_idx on public.event_articles (article_stable_id);

alter table public.ingestion_runs enable row level security;
alter table public.articles enable row level security;
alter table public.events enable row level security;
alter table public.event_articles enable row level security;

-- Бэкенд ходит с service_role — RLS обходится. Для anon без политик доступа нет.
-- При необходимости чтения с клиента по anon key добавьте отдельные SELECT-политики.
