-- supabase/migrations/<timestamp>_create_ai_usage.sql
-- Logs every Claude call so you can see real cost per user.

create table public.ai_usage (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  function_name text not null,
  model         text not null,
  input_tokens  integer not null,
  output_tokens integer not null,
  created_at    timestamptz not null default now()
);

alter table public.ai_usage enable row level security;

-- Users can log and read only their own usage rows
create policy "insert own usage" on public.ai_usage
  for insert to authenticated with check (auth.uid() = user_id);

create policy "read own usage" on public.ai_usage
  for select to authenticated using (auth.uid() = user_id);

create index ai_usage_user_month on public.ai_usage (user_id, created_at);