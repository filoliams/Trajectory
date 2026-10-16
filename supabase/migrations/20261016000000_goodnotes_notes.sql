-- Notes reader: GoodNotes notebooks, their pages, and AI analyses of them.

create table if not exists public.note_documents (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid references auth.users (id) on delete cascade,
    source          text not null default 'goodnotes',      -- goodnotes | obsidian | onenote (later)
    relative_path   text not null,                          -- path inside the backup folder
    title           text not null,
    folder          text,
    course_code     text,                                   -- from folder name, or the AI's guess
    file_hash       text not null,
    file_size       bigint,
    file_modified   timestamptz,
    page_count      integer,
    status          text not null default 'pending'
                    check (status in ('pending', 'processing', 'ready', 'error', 'missing')),
    error           text,
    last_synced_at  timestamptz,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique nulls not distinct (user_id, source, relative_path)
);

create index if not exists note_documents_course_idx on public.note_documents (user_id, course_code);

-- One row per page, so unchanged pages are never sent to the AI twice.
create table if not exists public.note_pages (
    document_id     uuid not null references public.note_documents (id) on delete cascade,
    page_number     integer not null,
    fingerprint     text not null,
    text_layer      text not null default '',
    handwriting     text,                                   -- null = not transcribed (typed-only page)
    needs_vision    boolean not null default false,
    transcribed_at  timestamptz,
    primary key (document_id, page_number)
);

-- Every analysis is kept, so progress per course can be charted over time.
create table if not exists public.note_analyses (
    id                  uuid primary key default gen_random_uuid(),
    document_id         uuid not null references public.note_documents (id) on delete cascade,
    file_hash           text not null,
    model               text not null,
    course_code         text,
    summary             text,
    note_type           text,
    overall_confidence  integer check (overall_confidence between 0 and 100),
    certainty           text,
    completeness        text,
    analysis            jsonb not null,                     -- full structured output (topics, gaps, ...)
    created_at          timestamptz not null default now()
);

create index if not exists note_analyses_doc_idx on public.note_analyses (document_id, created_at desc);

-- Latest topic-level confidence per notebook: what the study planner reads.
create or replace view public.note_topic_confidence
with (security_invoker = true) as
select
    d.user_id,
    d.id                               as document_id,
    d.title,
    coalesce(d.course_code, a.course_code) as course_code,
    t ->> 'name'                       as topic,
    t ->> 'depth'                      as depth,
    (t ->> 'confidence')::int          as confidence,
    t ->> 'evidence'                   as evidence,
    a.certainty,
    a.created_at                       as analysed_at
from public.note_documents d
join lateral (
    select * from public.note_analyses x
    where x.document_id = d.id
    order by x.created_at desc
    limit 1
) a on true
cross join lateral jsonb_array_elements(a.analysis -> 'topics') t
where d.status = 'ready';

-- Row level security: users only ever see their own notes.
-- (The backend uses the secret key, which bypasses RLS.)
alter table public.note_documents enable row level security;
alter table public.note_pages     enable row level security;
alter table public.note_analyses  enable row level security;

create policy "own documents" on public.note_documents
    for select using (auth.uid() = user_id);

create policy "own pages" on public.note_pages
    for select using (exists (
        select 1 from public.note_documents d where d.id = document_id and d.user_id = auth.uid()
    ));

create policy "own analyses" on public.note_analyses
    for select using (exists (
        select 1 from public.note_documents d where d.id = document_id and d.user_id = auth.uid()
    ));
