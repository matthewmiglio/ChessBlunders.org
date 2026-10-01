-- Enforce the free-tier monthly analysis limit in the database, not just in
-- POST /api/analysis/save. The "Users can insert own analysis" RLS policy only
-- checks user_id, so without this a signed-in user could insert analysis rows
-- straight through the Supabase REST API and skip the limit.
-- Keep FREE_MONTHLY_ANALYSES in website/lib/limits.ts and the 200 below in sync.

create or replace function public.enforce_free_monthly_analyses()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_period_end timestamptz;
  v_count integer;
begin
  select stripe_subscription_status, subscription_period_end
    into v_status, v_period_end
    from profiles where id = new.user_id;

  -- Same rule as website/lib/premium.ts checkPremiumAccess()
  if v_status in ('active', 'trialing')
     or (v_status = 'canceled' and v_period_end > now()) then
    return new;
  end if;

  select count(*) into v_count
    from analysis
   where user_id = new.user_id
     and analyzed_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';

  if v_count >= 200 then
    raise exception 'Monthly analysis limit reached';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_free_monthly_analyses() from public, anon, authenticated;

drop trigger if exists enforce_free_monthly_analyses on public.analysis;
create trigger enforce_free_monthly_analyses
  before insert on public.analysis
  for each row execute function public.enforce_free_monthly_analyses();

-- Makes the "analyses this month" count cheap.
create index if not exists idx_analysis_user_analyzed_at on public.analysis (user_id, analyzed_at);
