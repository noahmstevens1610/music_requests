create table if not exists public.site_content (
  id text primary key,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;

comment on table public.site_content is
  'Editable public website content managed through the Big Iron admin editor';

insert into public.site_content (id, content)
values ('homepage', '{}'::jsonb)
on conflict (id) do nothing;
