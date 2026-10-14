-- Trajectory Phase 1: run this once in Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.

-- Profiles: remember the chosen semester and whether onboarding is done.
alter table profiles add column if not exists semester text default '2026 S2';
alter table profiles add column if not exists onboarded boolean default false;

-- Create a profile row automatically for every new account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Courses: one row per course per semester per user.
alter table courses add column if not exists semester_start date;
create unique index if not exists courses_user_code_semester
  on courses (user_id, code, semester);

-- Assessments: flag items the importer wasn't sure about.
alter table assessments add column if not exists needs_review boolean default false;
alter table assessments add column if not exists note text;

alter table assessments drop constraint if exists assessments_status_check;
alter table assessments add constraint assessments_status_check
  check (status in ('not_started', 'in_progress', 'done'));

create index if not exists assessments_user_due on assessments (user_id, due_date);
