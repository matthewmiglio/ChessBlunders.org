import { createClient } from '@/lib/supabase-server';

export async function checkPremiumAccess(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_subscription_status, subscription_period_end')
    .eq('id', user.id)
    .single();

  if (!profile) return false;

  const status = profile.stripe_subscription_status;
  const periodEnd = profile.subscription_period_end;

  return (
    status === 'active' ||
    status === 'trialing' ||
    (status === 'canceled' && periodEnd && new Date(periodEnd) > new Date())
  );
}
