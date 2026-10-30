-- Quiz me (ticket 14): one row per quiz a student starts on a topic. The quiz-make function adds the row
-- when it writes the questions (so the daily limit counts what was paid for); the app fills in the score
-- when the student finishes. Only scores are kept: no question text and no note content.

create table if not exists quiz_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  topic_id bigint not null references topics (id) on delete cascade,
  total smallint not null check (total > 0),
  score smallint check (score >= 0),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  check (score is null or score <= total)
);

create index if not exists quiz_attempts_user_created on quiz_attempts (user_id, created_at);
create index if not exists quiz_attempts_topic on quiz_attempts (topic_id);

alter table quiz_attempts enable row level security;

-- shortcut: quiz-make runs as the student, so they could delete today's rows to get past the daily limit,
-- same as the sync_jobs and daily_plans caps; move counting behind a security-definer function before a public launch.
drop policy if exists "Own quiz attempts" on quiz_attempts;
create policy "Own quiz attempts" on quiz_attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
