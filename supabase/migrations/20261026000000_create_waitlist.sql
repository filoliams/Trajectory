-- Waitlist sign-ups collected from the landing page.
-- Writes go through the FastAPI backend (secret key), so RLS is on with no
-- policies: the public anon key can neither read nor insert rows directly.

create extension if not exists citext with schema extensions;

create table if not exists public.waitlist (
    id          bigint generated always as identity primary key,
    email       extensions.citext not null unique,
    university  text,
    referrer    text,
    created_at  timestamptz not null default now(),
    constraint waitlist_email_format check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    constraint waitlist_email_length check (char_length(email) <= 254),
    constraint waitlist_university_length check (char_length(university) <= 120),
    constraint waitlist_referrer_length check (char_length(referrer) <= 500)
);

alter table public.waitlist enable row level security;
