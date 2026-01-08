import { requireCustomerAuth } from '@/lib/auth/b2b-guard';
import { B2BPortalLayout } from '@/components/b2b/B2BPortalLayout';
import { B2BOrdersClient } from './B2BOrdersClient';
import { createClient } from '@/lib/supabase/server';

export default async function B2BOrdersPage() {
  const authContext = await requireCustomerAuth();
  const supabase = await createClient();

  // Fetch customer's orders
  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      status,
      subtotal_ex_vat,
      vat_amount,
      total_inc_vat,
      requested_delivery_date,
      notes,
      created_at,
      updated_at,
      customer_addresses (
        label,
        store_name,
        line1,
        city
      )
    `)
    .eq('customer_id', authContext.customerId)
    .order('created_at', { ascending: false });

  return (
    <B2BPortalLayout authContext={authContext}>
      <B2BOrdersClient orders={orders || []} customerId={authContext.customerId} />
    </B2BPortalLayout>
  );
}
