import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Database } from '@/types/supabase';
import { logError } from '@/lib/log';

type Customer = Database['public']['Tables']['customers']['Row'];
type CustomerAddress = Database['public']['Tables']['customer_addresses']['Row'];

// Helper to extract customer from Supabase join result (may be array or object)
function extractCustomer(customers: unknown): Customer | null {
  if (!customers) return null;
  if (Array.isArray(customers)) {
    return customers[0] as Customer ?? null;
  }
  return customers as Customer;
}

// Helper to extract address from Supabase join result (may be array or object)
function extractAddress(addresses: unknown): CustomerAddress | null {
  if (!addresses) return null;
  if (Array.isArray(addresses)) {
    return addresses[0] as CustomerAddress ?? null;
  }
  return addresses as CustomerAddress;
}

export type B2BAuthContext = {
  user: {
    id: string;
    email?: string;
  };
  customerId: string;
  customer: Customer;
  isImpersonating: boolean;
  staffUserId?: string; // Only populated when impersonating
  // Store-level access fields
  addressId: string | null; // null = head office (all addresses)
  address: CustomerAddress | null; // The specific address if restricted
  isAddressRestricted: boolean; // Helper flag for store-level users
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
    .maybeSingle();

  const impersonatedCustomer = extractCustomer(impersonation?.customers);
  if (impersonation && impersonatedCustomer) {
    // Staff impersonating customers always have full access (no address restriction)
    return {
      user: {
        id: user.id,
        email: user.email,
      },
      customerId: impersonation.customer_id,
      customer: impersonatedCustomer,
      isImpersonating: true,
      staffUserId: user.id,
      addressId: null,
      address: null,
      isAddressRestricted: false,
    };
  }

  // PRIORITY 2: Check if user is a customer portal user
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      customer_id,
      portal_role,
      customer_address_id,
      customers (*),
      customer_addresses (*)
    `)
    .eq('id', user.id)
    .maybeSingle();

  const profileCustomer = extractCustomer(profile?.customers);
  const profileAddress = extractAddress(profile?.customer_addresses);

  // Validate address belongs to customer if set (extra safety check)
  if (profile?.customer_address_id && profileAddress) {
    if (profileAddress.customer_id !== profile.customer_id) {
      logError('Profile address does not belong to customer', {
        userId: user.id,
        customerId: profile.customer_id,
        addressId: profile.customer_address_id,
      });
      redirect('/b2b/login');
    }
  }

  if (
    profile?.portal_role === 'customer' &&
    profile.customer_id &&
    profileCustomer
  ) {
    return {
      user: {
        id: user.id,
        email: user.email,
      },
      customerId: profile.customer_id,
      customer: profileCustomer,
      isImpersonating: false,
      addressId: profile.customer_address_id || null,
      address: profileAddress || null,
      isAddressRestricted: Boolean(profile.customer_address_id),
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
