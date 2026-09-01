-- 0001_security_lockdown.sql
-- Security remediation for the ChessBlunders Supabase project (ref qjtlzcjnylxyqpzglvfl).
--
-- Context: every table shipped with the default GRANT ALL to `anon` and
-- `authenticated`, so RLS + column grants were the only protection. That left
-- exploitable gaps:
--   F1 (CRITICAL) users could UPDATE their own profiles row's subscription
--                 columns and self-grant premium.
--   F2 (HIGH)     get_feedback_list() (SECURITY DEFINER) was EXECUTE-able by
--                 anon, dumping all feedback incl. user-entered emails.
--   F3 (HIGH)     "ChessPeckerPuzzles" had RLS disabled + full anon CRUD.
--   F4 (HIGH)     anon had EXECUTE on every SECURITY DEFINER function.
--   F5 (MEDIUM)   most functions lacked a pinned search_path.
--   F6 (LOW)      profiles INSERT policy was CHECK(true) (dead; trigger creates
--                 profiles).
--   F8 (systemic) broad default grants to anon/authenticated on every table.
--
-- Posture: full anon-lockdown. Revoke the broad defaults, grant back only the
-- minimum the apps use, and route privileged work through the existing
-- SECURITY DEFINER RPCs (called by service_role from the dashboard, or as the
-- logged-in user from the website). Rollback block at the bottom (commented).
--
-- Apply order: Block 1 alone is safe and closes the exploitable holes with zero
-- app impact. Blocks 2-4 pair with the dashboard analytics-route change
-- (anon client -> supabaseAdmin).

begin;

-- =====================================================================
-- BLOCK 1 — critical hole + PII leak + stray table (F1, F2, F3, F6)
-- =====================================================================

-- F3: unused, empty, insecure (RLS off) stray table from the ChessPecker port.
drop table if exists public."ChessPeckerPuzzles";

-- F1 + F6: profiles is read-only from clients. Subscription columns are written
-- only by the Stripe webhook (service_role); chess_username via the
-- update_chess_username() RPC. Drop the client write policies and grants.
drop policy if exists "Users can update own profile" on public.profiles;  -- F1 owner UPDATE
drop policy if exists "Allow profile creation"       on public.profiles;  -- F6 CHECK(true) INSERT
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;

-- F2: feedback contains user PII; only the dashboard (service_role) should read it.
revoke execute on function public.get_feedback_list(integer) from anon, authenticated;

-- =====================================================================
-- BLOCK 2 — anon-lockdown table grants (F8, F7)
-- =====================================================================

-- Wipe the broad default grants.
revoke all on all tables in schema public from anon, authenticated;

-- Close the search_path injection vector so pinning to `public` (Block 4) is safe:
-- non-privileged roles must not be able to create objects in schema public.
revoke create on schema public from public, anon, authenticated;

-- anon keeps ONLY anonymous pageview tracking (website/app/api/analytics/route.ts).
grant insert on public.analytics to anon;

-- authenticated: the minimal direct table access the website uses as a logged-in
-- user. Everything else it does goes through SECURITY DEFINER RPCs (Block 3).
grant select on public.profiles       to authenticated;  -- premium read, auth context, account page
grant select on public.games          to authenticated;
grant select on public.analysis       to authenticated;
grant select on public.user_progress  to authenticated;
grant insert on public.analysis       to authenticated;  -- analysis/save route
grant insert on public.feedback       to authenticated;  -- feedback route (RLS: auth.uid()=user_id)
grant insert on public.analytics      to authenticated;  -- pageviews while logged in
-- NOTE: if verification shows the website deletes games/analysis directly (re-import),
-- add: grant delete on public.games, public.analysis to authenticated;

-- =====================================================================
-- BLOCK 3 — function EXECUTE grants (F4)
-- =====================================================================
-- Revoke EXECUTE broadly; service_role keeps its own grant (not revoked here).
revoke execute on all functions in schema public from anon, authenticated, public;

-- Grant back EXECUTE to `authenticated` ONLY for the user-facing RPCs the website
-- calls as the logged-in user. All analytics/usage/admin RPCs stay service_role-only.
grant execute on function public.bulk_insert_games(jsonb)                                                              to authenticated;
grant execute on function public.get_detailed_user_stats()                                                            to authenticated;
grant execute on function public.get_user_stats()                                                                     to authenticated;
grant execute on function public.get_progress_over_time(text)                                                         to authenticated;
grant execute on function public.start_new_practice_run()                                                             to authenticated;
grant execute on function public.record_practice_attempt(uuid, integer, boolean, character varying, integer)          to authenticated;
grant execute on function public.increment_engine_usage(uuid)                                                         to authenticated;
grant execute on function public.check_engine_rate_limit(integer)                                                     to authenticated;
grant execute on function public.get_remaining_requests(integer)                                                      to authenticated;
grant execute on function public.get_attempt_history(uuid)                                                            to authenticated;
grant execute on function public.update_chess_username(text)                                                          to authenticated;
grant execute on function public.is_premium(uuid)                                                                     to authenticated;

-- =====================================================================
-- BLOCK 4 — pin search_path on every function (F5)
-- =====================================================================
-- Bodies reference public tables unqualified, so we pin to `public` (not '');
-- Block 2's REVOKE CREATE keeps that safe from object-shadowing.
alter function public.bulk_insert_games(jsonb)                                                     set search_path = public;
alter function public.check_engine_rate_limit(integer)                                             set search_path = public;
alter function public.get_analyses_over_time()                                                     set search_path = public;
alter function public.get_analytics_summary(integer)                                               set search_path = public;
alter function public.get_analytics_summary_all_time()                                             set search_path = public;
alter function public.get_attempt_history(uuid)                                                    set search_path = public;
alter function public.get_avg_analyses_per_user()                                                  set search_path = public;
alter function public.get_avg_blunders_practiced_per_user()                                        set search_path = public;
alter function public.get_avg_games_per_user()                                                     set search_path = public;
alter function public.get_blunder_count_distribution()                                             set search_path = public;
alter function public.get_blunders_practiced_over_time()                                           set search_path = public;
alter function public.get_cumulative_users_over_time()                                             set search_path = public;
alter function public.get_daily_pageviews(integer)                                                 set search_path = public;
alter function public.get_daily_pageviews_all_time()                                               set search_path = public;
alter function public.get_daily_visitors(integer)                                                  set search_path = public;
alter function public.get_detailed_user_stats()                                                    set search_path = public;
alter function public.get_engine_usage_over_time()                                                 set search_path = public;
alter function public.get_feedback_list(integer)                                                   set search_path = public;
alter function public.get_game_results_distribution()                                              set search_path = public;
alter function public.get_games_over_time()                                                        set search_path = public;
alter function public.get_pageviews_by_country(integer)                                            set search_path = public;
alter function public.get_pageviews_by_country_all_time()                                          set search_path = public;
alter function public.get_pageviews_by_path(integer)                                               set search_path = public;
alter function public.get_pageviews_by_path_all_time()                                             set search_path = public;
alter function public.get_period_comparison()                                                      set search_path = public;
alter function public.get_progress_over_time(text)                                                 set search_path = public;
alter function public.get_remaining_requests(integer)                                              set search_path = public;
alter function public.get_solve_attempts_distribution()                                            set search_path = public;
alter function public.get_usage_summary()                                                          set search_path = public;
alter function public.get_user_activity_distribution()                                             set search_path = public;
alter function public.get_user_stats()                                                             set search_path = public;
alter function public.handle_new_user()                                                            set search_path = public;
alter function public.increment_engine_usage(uuid)                                                 set search_path = public;
alter function public.is_premium(uuid)                                                             set search_path = public;
alter function public.record_practice_attempt(uuid, integer, boolean, character varying, integer)  set search_path = public;
alter function public.start_new_practice_run()                                                     set search_path = public;
alter function public.update_chess_username(text)                                                  set search_path = public;

commit;

-- =====================================================================
-- ROLLBACK (run manually only if a flow breaks and you must restore fast)
-- =====================================================================
-- begin;
--   grant all on all tables in schema public to anon, authenticated;
--   grant execute on all functions in schema public to anon, authenticated;
--   grant create on schema public to public;  -- (Supabase default; optional)
--   create policy "Users can update own profile" on public.profiles
--     for update using (auth.uid() = id) with check (auth.uid() = id);
--   create policy "Allow profile creation" on public.profiles
--     for insert with check (true);
--   -- NOTE: does NOT recreate "ChessPeckerPuzzles" (it was empty/unused).
-- commit;
