import { requireCustomerAuth } from '@/lib/auth/b2b-guard';
import { B2BPortalLayout } from '@/components/b2b/B2BPortalLayout';
import { B2BAccountClient } from './B2BAccountClient';
import { createClient } from '@/lib/supabase/server';

export default async function B2BAccountPage() {
  const authContext = await requireCustomerAuth();
  const supabase = await createClient();

  // Fetch customer addresses
  const { data: addresses } = await supabase
    .from('customer_addresses')
    .select('*')
    .eq('customer_id', authContext.customerId)
    .order('is_default_shipping', { ascending: false });

  // Fetch customer contacts
  const { data: contacts } = await supabase
    .from('customer_contacts')
    .select('*')
    .eq('customer_id', authContext.customerId)
    .order('is_primary', { ascending: false });

  return (
    <B2BPortalLayout authContext={authContext}>
      <B2BAccountClient
        customer={authContext.customer}
        user={authContext.user}
        addresses={addresses || []}
        contacts={contacts || []}
      />
    </B2BPortalLayout>
  );
}
