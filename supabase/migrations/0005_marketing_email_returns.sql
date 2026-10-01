-- Dashboard figures: per marketing email, how many were sent, how many of those
-- people came back (signed in, imported, analyzed, or practiced after the send),
-- and how many unsubscribed. Sign-in alone misses people whose session never
-- expired, hence the activity checks.

create or replace function public.get_marketing_email_returns()
returns table (template_id text, emailed bigint, returned bigint, unsubscribed bigint)
language sql
security definer
set search_path = public
as $$
  with sent as (
    select s.template_id, s.email, s.sent_at, u.id as user_id, u.last_sign_in_at
      from marketing_email_sends s
      left join auth.users u on lower(u.email) = s.email
     where s.resend_id is not null
  )
  select template_id,
         count(*),
         count(*) filter (where last_sign_in_at > sent_at
           or exists (select 1 from games g where g.user_id = sent.user_id and g.created_at > sent_at)
           or exists (select 1 from analysis a where a.user_id = sent.user_id and a.analyzed_at > sent_at)
           or exists (select 1 from practice_attempts p where p.user_id = sent.user_id and p.created_at > sent_at)),
         count(*) filter (where exists (select 1 from email_unsubscribes x where x.email = sent.email))
    from sent
   group by template_id
   order by template_id;
$$;

revoke execute on function public.get_marketing_email_returns() from public, anon, authenticated;
grant execute on function public.get_marketing_email_returns() to service_role;
