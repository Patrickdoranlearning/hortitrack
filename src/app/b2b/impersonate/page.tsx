import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { isInternalStaff } from '@/lib/auth/b2b-guard';
import { ImpersonateClient } from './ImpersonateClient';

export default async function ImpersonatePage() {
  // Verify user is internal staff
  const staffAccess = await isInternalStaff();
  if (!staffAccess) {
    redirect('/b2b/login');
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/b2b/login');
  }

  // Get user's org
  const { data: profile } = await supabase
    .from('profiles')
    .select('active_org_id')
    .eq('id', user.id)
    .single();

  if (!profile?.active_org_id) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>No organization found</p>
      </div>
    );
  }

  // Fetch all customers in org
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, code, email, store')
    .eq('org_id', profile.active_org_id)
    .order('name');

  // Check for active impersonation session
  const { data: activeSession } = await supabase
    .from('customer_impersonation_sessions')
    .select(`
      id,
      customer_id,
      started_at,
      notes,
      customers (
        id,
        name,
        code
      )
    `)
    .eq('staff_user_id', user.id)
    .is('ended_at', null)
    .single();

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="mx-auto max-w-2xl p-6">
        <ImpersonateClient
          customers={customers || []}
          activeSession={activeSession}
        />
      </div>
    </div>
  );
}
