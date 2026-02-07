'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { isInternalStaff } from '@/lib/auth/b2b-guard';

export async function startImpersonation(formData: FormData) {
  // Verify user is internal staff
  const staffAccess = await isInternalStaff();
  if (!staffAccess) {
    return { error: 'Access denied' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const customerId = formData.get('customerId') as string;
  const notes = (formData.get('notes') as string) || null;

  if (!customerId) {
    return { error: 'Customer ID is required' };
  }

  // Get user's org to verify customer belongs to same org
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('active_org_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile?.active_org_id) {
    return { error: 'No organization found' };
  }

  // Verify customer exists and belongs to org
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, org_id')
    .eq('id', customerId)
    .eq('org_id', profile.active_org_id)
    .maybeSingle();

  if (customerError || !customer) {
    return { error: 'Customer not found or access denied' };
  }

  // End any existing impersonation sessions for this user
  await supabase
    .from('customer_impersonation_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('staff_user_id', user.id)
    .is('ended_at', null);

  // Create new impersonation session
  const { error: insertError } = await supabase
    .from('customer_impersonation_sessions')
    .insert({
      org_id: profile.active_org_id,
      staff_user_id: user.id,
      customer_id: customerId,
      notes,
    });

  if (insertError) {
    return { error: insertError.message };
  }

  // Redirect to customer portal dashboard
  redirect('/b2b/dashboard');
}

export async function endImpersonation() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  // End active impersonation session
  await supabase
    .from('customer_impersonation_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('staff_user_id', user.id)
    .is('ended_at', null);

  // Redirect back to impersonation page
  redirect('/b2b/impersonate');
}
