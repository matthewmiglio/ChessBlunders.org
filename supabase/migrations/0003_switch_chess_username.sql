-- Change the Chess.com account games are imported from, optionally deleting
-- every imported game first. Deleting games cascades to analysis,
-- user_progress, and practice_attempts. Done in one function so the delete
-- and the username change succeed or fail together (authenticated has no
-- DELETE grant on games).

create or replace function public.switch_chess_username(p_chess_username text, p_delete_games boolean)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_delete_games then
    delete from games where user_id = auth.uid();
    get diagnostics v_deleted = row_count;
  end if;

  update profiles
     set chess_username = p_chess_username, updated_at = now()
   where id = auth.uid();

  return v_deleted;
end;
$$;

revoke execute on function public.switch_chess_username(text, boolean) from public, anon;
grant execute on function public.switch_chess_username(text, boolean) to authenticated;
