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
