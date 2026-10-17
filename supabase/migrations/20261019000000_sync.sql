-- Trajectory: sync across devices and offline edits. Run once in Supabase → SQL Editor → New query → Run.
-- Safe to run more than once. Run 20261018000000_topics.sql first.

-- When each row was last edited. The app sends its own edit time with every change,
-- so an edit made offline doesn't overwrite a newer edit from another device.
alter table courses add column if not exists updated_at timestamptz not null default now();
alter table assessments add column if not exists updated_at timestamptz not null default now();
alter table topics add column if not exists updated_at timestamptz not null default now();

-- Edits that don't set updated_at themselves (imports, the SQL editor) get the current time.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists courses_touch on courses;
create trigger courses_touch before update on courses for each row execute function public.touch_updated_at();
drop trigger if exists assessments_touch on assessments;
create trigger assessments_touch before update on assessments for each row execute function public.touch_updated_at();
drop trigger if exists topics_touch on topics;
create trigger topics_touch before update on topics for each row execute function public.touch_updated_at();

-- Study-timer totals: milliseconds studied per assessment per (Brisbane) day.
create table if not exists study_time (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  assessment_id bigint not null references assessments (id) on delete cascade,
  ms bigint not null default 0 check (ms >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, day, assessment_id)
);

alter table study_time enable row level security;

drop policy if exists "Own study time" on study_time;
create policy "Own study time" on study_time
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Add study time. Adding is order-independent, so two devices (or a replayed offline queue) just sum.
create or replace function public.add_study_time(p_day date, p_assessment bigint, p_ms bigint)
returns void
language sql
security invoker
as $$
  insert into study_time (user_id, day, assessment_id, ms)
  values (auth.uid(), p_day, p_assessment, greatest(p_ms, 0))
  on conflict (user_id, day, assessment_id)
  do update set ms = study_time.ms + excluded.ms, updated_at = now();
$$;

-- Live updates: send changes on these tables to the user's other signed-in devices.
do $$
declare t text;
begin
  foreach t in array array['profiles', 'courses', 'assessments', 'topics', 'study_time'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
