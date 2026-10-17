-- Trajectory: course topics. Run once in Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.

-- One row per topic per course. Topics come from the course profile's
-- "Learning activities" table, or the student adds them. has_notes says
-- whether the student has notes for the topic.
create table if not exists topics (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id bigint not null references courses (id) on delete cascade,
  name text not null,
  week text,
  position integer not null default 0,
  has_notes boolean not null default false,
  source text not null default 'manual' check (source in ('imported', 'manual')),
  created_at timestamptz not null default now()
);

create index if not exists topics_course on topics (course_id, position);

-- Each person only sees and changes their own topics.
alter table topics enable row level security;

drop policy if exists "Own topics" on topics;
create policy "Own topics" on topics
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
