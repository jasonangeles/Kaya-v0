-- Notify the owner when a NEW user signs up.
-- Run this once in Supabase → SQL Editor.
--
-- How it works: a new row in auth.users only appears for a brand-new email
-- (returning logins don't create one). A trigger copies that into public.signups,
-- and a Database Webhook on public.signups → the notify-contact Edge Function emails you.

-- 1. Table that records new signups (nothing sensitive beyond the email).
create table if not exists public.signups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text,
  created_at timestamptz default now()
);

-- Lock it down: RLS on, with no policies, so it's writable only by the
-- trigger (security definer) and never readable/writable from the app.
alter table public.signups enable row level security;

-- 2. Trigger function: record each newly created auth user.
create or replace function public.handle_new_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.signups (user_id, email) values (new.id, new.email);
  return new;
end;
$$;

-- 3. Fire it after a new auth user is created.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_signup();
