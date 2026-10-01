-- Marketing emails: unsubscribe list, a log of what was sent to whom, and the
-- "inactive users" group. Only the service role (the marketing/ script and the
-- website's unsubscribe route) can touch these.

create table if not exists public.email_unsubscribes (
  email text primary key,
  source text,
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_email_sends (
  id bigserial primary key,
  email text not null,
  template_id text not null,
  resend_id text,
  sent_at timestamptz not null default now(),
  unique (email, template_id)
);

alter table public.email_unsubscribes enable row level security;
alter table public.marketing_email_sends enable row level security;
revoke all on public.email_unsubscribes, public.marketing_email_sends from anon, authenticated;
grant all on public.email_unsubscribes, public.marketing_email_sends to service_role;
grant usage on sequence public.marketing_email_sends_id_seq to service_role;

-- Confirmed users who haven't signed in for 7+ days, haven't unsubscribed, and
-- haven't already been sent this template. Most recently active first.
create or replace function public.marketing_inactive_users(p_template text, p_limit int)
returns table (id uuid, email text)
language sql
security definer
set search_path = public
as $$
  select u.id, lower(u.email)::text
    from auth.users u
   where u.email is not null
     and u.email_confirmed_at is not null
     and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '7 days'
     and not exists (select 1 from email_unsubscribes x where x.email = lower(u.email))
     and not exists (select 1 from marketing_email_sends s
                      where s.email = lower(u.email) and s.template_id = p_template)
   order by coalesce(u.last_sign_in_at, u.created_at) desc
   limit p_limit;
$$;

revoke execute on function public.marketing_inactive_users(text, int) from public, anon, authenticated;
grant execute on function public.marketing_inactive_users(text, int) to service_role;
