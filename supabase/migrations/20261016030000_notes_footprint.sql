-- Phase 4: notes reading and Strong / Okay / Weak topic footprint.
-- The backend writes these with the secret key; the app reads its own rows.

create table if not exists public.note_pages (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  source       text not null default 'goodnotes',   -- goodnotes | obsidian | onenote
  notebook     text not null,                        -- path inside the backup folder
  page_index   int  not null,
  page_hash    text not null,                        -- changes when the page image changes
  course_code  text,
  seen_on      date not null,
  reading      jsonb not null,                       -- topics, depth, practice found on the page
  updated_at   timestamptz not null default now(),
  unique (user_id, source, notebook, page_index)
);
create index if not exists note_pages_course_idx on public.note_pages (user_id, course_code);

-- Topic list per course (from the course profile or entered by the user).
create table if not exists public.course_topics (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  course_code  text not null,
  name         text not null,
  unique (user_id, course_code, name)
);

create table if not exists public.course_footprints (
  user_id              uuid not null references auth.users(id) on delete cascade,
  course_code          text not null,
  level                text not null check (level in ('strong','okay','weak','none')),
  score                real,
  summary              text not null,
  weakness_multiplier  real not null default 1.0,
  updated_at           timestamptz not null default now(),
  primary key (user_id, course_code)
);

create table if not exists public.topic_footprints (
  user_id             uuid not null references auth.users(id) on delete cascade,
  course_code         text not null,
  topic               text not null,
  level               text not null check (level in ('strong','okay','weak','none')),
  score               real not null,
  coverage            real not null,
  depth               real not null,
  practice            real not null,
  recency             real not null,
  pages               int  not null,
  practice_attempted  int  not null,
  practice_correct    int  not null,
  practice_incorrect  int  not null,
  last_touched        date,
  evidence            text not null,
  updated_at          timestamptz not null default now(),
  primary key (user_id, course_code, topic)
);

alter table public.note_pages        enable row level security;
alter table public.course_topics     enable row level security;
alter table public.course_footprints enable row level security;
alter table public.topic_footprints  enable row level security;

create policy "own note pages"        on public.note_pages        for select using (auth.uid() = user_id);
create policy "own course topics"     on public.course_topics     for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own course footprints" on public.course_footprints for select using (auth.uid() = user_id);
create policy "own topic footprints"  on public.topic_footprints  for select using (auth.uid() = user_id);
