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
