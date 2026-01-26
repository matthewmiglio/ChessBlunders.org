import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import SubscriptionManager from '@/components/SubscriptionManager';

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const isPremium = profile?.stripe_subscription_status === 'active'
    || profile?.stripe_subscription_status === 'trialing'
    || (profile?.stripe_subscription_status === 'canceled'
        && new Date(profile.subscription_period_end) > new Date());

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#f5f5f5] mb-8">Account Settings</h1>

      <SubscriptionManager
        profile={profile}
        userEmail={user.email}
        isPremium={isPremium}
      />
    </div>
  );
}
