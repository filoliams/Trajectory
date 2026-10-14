-- Course profiles imported from course-profiles.uq.edu.au and their assessments.
-- One row per course offering (e.g. MECH2210, Semester 2 2026, St Lucia).

create table if not exists public.course_profiles (
    id          bigint generated always as identity primary key,
    course_code text        not null,
    offering    text        not null default '',
    location    text        not null default '',
    mode        text        not null default '',
    profile_url text        not null unique,
    fetched_at  timestamptz not null default now()
);

create index if not exists course_profiles_course_code_idx
    on public.course_profiles (course_code);

create table if not exists public.assessments (
    id         bigint generated always as identity primary key,
    profile_id bigint  not null references public.course_profiles (id) on delete cascade,
    name       text    not null,
    category   text,
    weight     numeric(5, 2),          -- percent; null for pass/fail
    weight_raw text    not null default '',
    due_raw    text    not null default '', -- exactly as written in the profile
    due_at     timestamptz,             -- null when the profile gives no exact date
    position   integer not null default 0
);

create index if not exists assessments_profile_id_idx
    on public.assessments (profile_id);

-- Course profiles are public information: anyone signed in can read them.
-- Writes only happen from the backend, which uses the secret key and
-- bypasses RLS.
alter table public.course_profiles enable row level security;
alter table public.assessments     enable row level security;

create policy "course_profiles readable"
    on public.course_profiles for select
    to anon, authenticated
    using (true);

create policy "assessments readable"
    on public.assessments for select
    to anon, authenticated
    using (true);
