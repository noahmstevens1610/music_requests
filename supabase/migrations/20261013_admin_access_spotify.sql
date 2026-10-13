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
