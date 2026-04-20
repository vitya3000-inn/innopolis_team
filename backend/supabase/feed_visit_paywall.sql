-- Учёт уникальных дней с успешной загрузкой актуальной ленты + флаг подписки.
-- Выполните в SQL Editor Supabase один раз (после schema.sql / независимо).

-- Права на подписку: клиент только читает; выставлять subscription_active = true может только service_role (SQL/вебхук оплаты).
create table if not exists public.user_entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  subscription_active boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.feed_visit_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  visit_ymd date not null,
  created_at timestamptz not null default now(),
  unique (user_id, visit_ymd)
);

create index if not exists feed_visit_days_user_id_idx on public.feed_visit_days (user_id);

alter table public.user_entitlements enable row level security;
alter table public.feed_visit_days enable row level security;

-- entitlements: первая строка создаётся самим пользователем при первом визите ленты
create policy "user_entitlements_select_own"
  on public.user_entitlements for select to authenticated
  using (user_id = auth.uid());

create policy "user_entitlements_insert_own"
  on public.user_entitlements for insert to authenticated
  with check (user_id = auth.uid());

-- обновление подписки только с сервера (service_role обходит RLS)

create policy "feed_visit_days_select_own"
  on public.feed_visit_days for select to authenticated
  using (user_id = auth.uid());

create policy "feed_visit_days_insert_own"
  on public.feed_visit_days for insert to authenticated
  with check (user_id = auth.uid());

create policy "feed_visit_days_update_own"
  on public.feed_visit_days for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "feed_visit_days_delete_own"
  on public.feed_visit_days for delete to authenticated
  using (user_id = auth.uid());

-- Тест: выдать подписку вручную (SQL Editor, service_role не нужен если выполняете как postgres):
-- update public.user_entitlements set subscription_active = true, updated_at = now() where user_id = '...uuid...';
