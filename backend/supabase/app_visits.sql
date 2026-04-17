-- Посещения приложения (запись с клиента через anon/authenticated, чтение агрегатов — backend service_role).
-- Выполните в SQL Editor Supabase один раз.

create table if not exists public.app_visits (
  id uuid primary key default gen_random_uuid(),
  visited_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  platform text
);

create index if not exists app_visits_visited_at_idx on public.app_visits (visited_at desc);
create index if not exists app_visits_user_id_idx on public.app_visits (user_id);

alter table public.app_visits enable row level security;

-- Вставка: гость (anon) — только user_id IS NULL; пользователь — только своя строка.
create policy "app_visits_insert_anon_null_user"
  on public.app_visits for insert to anon
  with check (user_id is null);

create policy "app_visits_insert_auth_self"
  on public.app_visits for insert to authenticated
  with check (user_id = auth.uid());

-- Чтение из клиента не нужно (статистика только через backend).
