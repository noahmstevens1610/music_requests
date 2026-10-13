-- BIG IRON: setup for shared passwords, two Spotify accounts, analytics archive.
-- Run on the existing Supabase project's SQL editor. Take a database backup first.
-- Do not run while performing an event reset.

-- FILE: supabase/migrations/20261013_admin_access_spotify.sql
-- Run once in Supabase SQL Editor before testing the new features.
create extension if not exists pgcrypto;
create table if not exists public.admin_passwords (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 salt text not null,
 password_hash text not null,
 enabled boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.admin_sessions (
 id uuid primary key default gen_random_uuid(),
 password_id uuid references public.admin_passwords(id) on delete cascade,
 token_hash text not null unique,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create table if not exists public.spotify_accounts (
 slot integer primary key check(slot in (1,2)),
 spotify_user_id text unique not null,
 display_name text not null,
 access_token text not null,
 refresh_token text not null,
 expires_at timestamptz not null,
 active boolean not null default false,
 updated_at timestamptz not null default now()
);
create unique index if not exists spotify_single_active on public.spotify_accounts(active) where active=true;
alter table public.admin_passwords enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.spotify_accounts enable row level security;
-- Server-side service-role key only; do not add public policies.


-- FILE: supabase/migrations/20261014_request_history.sql
-- Historical snapshots survive clearing the live request queue.
create table if not exists public.request_history (
 request_id uuid primary key,
 event_id uuid not null,
 track_name text not null,
 artist_name text not null,
 request_type text not null,
 status text,
 votes integer not null default 0,
 created_at timestamptz not null,
 archived_at timestamptz not null default now()
);
alter table public.request_history enable row level security;

-- Archive and reset atomically so that failed cleanup never loses history.
create or replace function public.archive_and_reset_event_requests(p_event_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 insert into public.request_history(request_id,event_id,track_name,artist_name,request_type,status,votes,created_at)
 select id,event_id,track_name,artist_name,request_type,status,coalesce(votes,0),created_at
 from public.requests where event_id=p_event_id
 on conflict (request_id) do nothing;
 delete from public.votes where request_id in (select id from public.requests where event_id=p_event_id);
 delete from public.requests where event_id=p_event_id;
 get diagnostics n = row_count;
 return n;
end $$;
revoke all on function public.archive_and_reset_event_requests(uuid) from public,anon,authenticated;
grant execute on function public.archive_and_reset_event_requests(uuid) to service_role;


-- FILE: supabase/migrations/20261014_spotify_switch.sql
-- Atomically switch the active slot to avoid ending with no active account.
create or replace function public.activate_spotify_slot(p_slot integer)
returns void language plpgsql security definer set search_path=public as $$
begin
 if p_slot not in (1,2) or not exists(select 1 from public.spotify_accounts where slot=p_slot)
 then raise exception 'Spotify account slot is not connected';
 end if;
 -- Serialize switches and avoid transient unique-index conflicts.
 perform pg_advisory_xact_lock(9202602);
 update public.spotify_accounts set active=false where active=true;
 update public.spotify_accounts set active=true where slot=p_slot;
end $$;
revoke all on function public.activate_spotify_slot(integer) from public,anon,authenticated;
grant execute on function public.activate_spotify_slot(integer) to service_role;
