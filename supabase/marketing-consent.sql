-- Marketing email consent (GDPR / CASL) for Kaya.
-- Run this once in Supabase → SQL Editor → New query → paste → Run.
-- Safe to run again (it only creates or replaces).
--
-- Where consent lives: each user's account (auth.users.raw_user_meta_data), written by the app:
--   marketing_opt_in, marketing_consent_at, marketing_consent_source, marketing_consent_text,
--   marketing_withdrawn_at, marketing_prompt_dismissed_at, marketing_asked_at
--
-- This script adds:
--   1. marketing_consent_log : a history of every opt-in / opt-out with a SERVER timestamp.
--      This is your proof of consent. Nobody can read or edit it from the app.
--   2. marketing_export      : a private view for downloading your Brevo list as CSV.

-- 1. Consent history -----------------------------------------------------------
create table if not exists public.marketing_consent_log (
  id            bigint generated always as identity primary key,
  user_id       uuid not null,
  email         text,
  opted_in      boolean not null,
  source        text,           -- signup_form | in_app_prompt | settings
  consent_text  text,           -- exact wording shown
  recorded_at   timestamptz not null default now()
);
-- RLS on with no policies = no access from the app (only the trigger and you, in the dashboard).
alter table public.marketing_consent_log enable row level security;

create or replace function public.log_marketing_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_opt boolean := coalesce((new.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false);
  old_opt boolean := case when tg_op = 'UPDATE'
                          then coalesce((old.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false)
                          else false end;
begin
  -- Only record real changes (opting in, or opting out after being in)
  if new_opt is distinct from old_opt then
    insert into public.marketing_consent_log (user_id, email, opted_in, source, consent_text)
    values (
      new.id,
      new.email,
      new_opt,
      case when new_opt then new.raw_user_meta_data ->> 'marketing_consent_source' else 'settings' end,
      case when new_opt then new.raw_user_meta_data ->> 'marketing_consent_text' else null end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_marketing_consent_change on auth.users;
create trigger on_marketing_consent_change
  after insert or update of raw_user_meta_data on auth.users
  for each row execute function public.log_marketing_consent();

-- 2. Brevo export ----------------------------------------------------------------
-- first_name comes from the display name people set in the app (Settings → Display name).
create or replace view public.marketing_export
with (security_invoker = true) as
select
  u.email,
  nullif(split_part(trim(coalesce(k.data -> 'settings' ->> 'displayName', '')), ' ', 1), '') as first_name,
  coalesce((u.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false)                  as marketing_opt_in,
  (u.raw_user_meta_data ->> 'marketing_consent_at')::timestamptz                            as marketing_consent_at
from auth.users u
left join public.kaya_data k on k.user_id = u.id
where u.email is not null
order by u.created_at;

-- Lock the view away from the app: only you (dashboard / service role) can read it.
revoke all on public.marketing_export from anon, authenticated;

-- HOW TO EXPORT FOR BREVO
--   Supabase → SQL Editor → run:
--     select * from public.marketing_export where marketing_opt_in;
--   then click "Download CSV" (above the results) and import the file into Brevo.
