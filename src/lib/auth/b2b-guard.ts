import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Database } from '@/types/supabase';

type Customer = Database['public']['Tables']['customers']['Row'];

export type B2BAuthContext = {
  user: {
    id: string;
    email?: string;
  };
  customerId: string;
  customer: Customer;
  isImpersonating: boolean;
  staffUserId?: string; // Only populated when impersonating
};

/**
 * Server-side authentication guard for B2B customer portal routes
 * Validates user has customer portal access OR is impersonating a customer
 * @returns Customer authentication context
 * @throws Redirects to /b2b/login if not authenticated
 */
export async function requireCustomerAuth(): Promise<B2BAuthContext> {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/b2b/login');
  }

  // PRIORITY 1: Check if user is internal staff with active impersonation
  const { data: impersonation } = await supabase
    .from('customer_impersonation_sessions')
    .select(`
      customer_id,
      customers (*)
    `)
    .eq('staff_user_id', user.id)
    .is('ended_at', null)
    .single();

  if (impersonation && impersonation.customers) {
    return {
      user: {
        id: user.id,
        email: user.email,
      },
      customerId: impersonation.customer_id,
      customer: impersonation.customers as Customer,
      isImpersonating: true,
      staffUserId: user.id,
    };
  }

  // PRIORITY 2: Check if user is a customer portal user
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      customer_id,
      portal_role,
      customers (*)
    `)
    .eq('id', user.id)
    .single();

  if (
    profile?.portal_role === 'customer' &&
    profile.customer_id &&
    profile.customers
  ) {
    return {
      user: {
        id: user.id,
        email: user.email,
      },
      customerId: profile.customer_id,
      customer: profile.customers as Customer,
      isImpersonating: false,
    };
  }

  // No valid customer access found
  redirect('/b2b/login');
}

/**
 * Check if current user is internal staff (for impersonation page access)
 * Allows any authenticated user who is NOT a customer portal user.
 * Customer portal users have portal_role='customer', everyone else is considered staff.
 */
export async function isInternalStaff(): Promise<boolean> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('portal_role')
    .eq('id', user.id)
    .maybeSingle();

  // If portal_role is explicitly 'customer', they're not staff
  if (profile?.portal_role === 'customer') {
    return false;
  }

  // Any other authenticated user (internal, null, or no profile) is considered staff
  return true;
}
