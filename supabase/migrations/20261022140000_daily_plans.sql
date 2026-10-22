-- AI daily study plan (ticket 07): one saved plan per student per Brisbane day, so opening Today
-- reuses it instead of calling Sonnet again. `generations` counts the day's plan plus re-plans.

create table if not exists daily_plans (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  hours smallint not null,
  blocks jsonb not null,
  model text not null,
  generations smallint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table daily_plans enable row level security;

-- shortcut: the plan-day function runs as the student, so they could reset `generations` themselves,
-- same as the sync_jobs cap; move the counter behind a security-definer function before a public launch.
drop policy if exists "Own daily plans" on daily_plans;
create policy "Own daily plans" on daily_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
