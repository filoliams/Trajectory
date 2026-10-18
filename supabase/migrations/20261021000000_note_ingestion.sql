-- Trajectory: note ingestion (ingest-core). Run once in Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
--
-- Trajectory is not a backup service: these tables hold note metadata and the analysis, never the
-- note text. Uploaded originals live briefly in the private "notes" bucket and are deleted once read.

-- Where notes come from: this device's Files picker, or (later) a Microsoft account.
create table if not exists connections (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('server', 'device')),
  provider text not null check (provider in ('files', 'microsoft')),
  device_id text not null default '',
  status text not null default 'active' check (status in ('active', 'needs_reauth', 'blocked', 'disabled')),
  sync_cursor text,
  -- OAuth tokens live in Supabase Vault; only the secret's id is kept here.
  vault_secret_id uuid,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, provider, device_id)
);

-- One row per note file, identified within its connection by external_id (path, or Graph item id).
create table if not exists documents (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  connection_id bigint not null references connections (id) on delete cascade,
  external_id text not null,
  path text not null,
  title text not null,
  mime_type text,
  size_bytes bigint,
  source_modified_at timestamptz,
  content_hash text not null,
  -- The content_hash that was last analysed; unchanged files are skipped.
  analyzed_hash text,
  extractor_version integer,
  course_id bigint references courses (id) on delete set null,
  course_source text check (course_source in ('folder', 'ai', 'user')),
  course_confidence real,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed', 'skipped')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, external_id)
);

create index if not exists documents_user_course on documents (user_id, course_id);

-- How well one document covers each topic of its course.
create table if not exists document_topics (
  document_id bigint not null references documents (id) on delete cascade,
  topic_id bigint not null references topics (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  level text not null check (level in ('none', 'weak', 'okay', 'strong')),
  reason text not null default '',
  primary key (document_id, topic_id)
);

create index if not exists document_topics_topic on document_topics (topic_id);

-- The best level across all of a topic's documents; drives the course level and the daily plan.
alter table topics add column if not exists understanding text check (understanding in ('none', 'weak', 'okay', 'strong'));
alter table topics add column if not exists understanding_reason text;
alter table topics add column if not exists analyzed_at timestamptz;

-- One row per analysis run: progress, failures, token usage, and the daily per-user cap.
create table if not exists sync_jobs (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  connection_id bigint references connections (id) on delete cascade,
  document_id bigint references documents (id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  error text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists sync_jobs_user_created on sync_jobs (user_id, created_at);

-- Each person only sees and changes their own rows.
alter table connections enable row level security;
alter table documents enable row level security;
alter table document_topics enable row level security;
alter table sync_jobs enable row level security;

drop policy if exists "Own connections" on connections;
create policy "Own connections" on connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Own documents" on documents;
create policy "Own documents" on documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Own document topics" on document_topics;
create policy "Own document topics" on document_topics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Own sync jobs" on sync_jobs;
create policy "Own sync jobs" on sync_jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Private bucket for originals while they're being read: notes/{user_id}/{document_id}/{hash}.{ext}, 20 MB max.
insert into storage.buckets (id, name, public, file_size_limit)
values ('notes', 'notes', false, 20971520)
on conflict (id) do nothing;

drop policy if exists "Own note uploads: read" on storage.objects;
create policy "Own note uploads: read" on storage.objects
  for select to authenticated
  using (bucket_id = 'notes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Own note uploads: add" on storage.objects;
create policy "Own note uploads: add" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'notes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Own note uploads: replace" on storage.objects;
create policy "Own note uploads: replace" on storage.objects
  for update to authenticated
  using (bucket_id = 'notes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Own note uploads: remove" on storage.objects;
create policy "Own note uploads: remove" on storage.objects
  for delete to authenticated
  using (bucket_id = 'notes' and (storage.foldername(name))[1] = auth.uid()::text);
