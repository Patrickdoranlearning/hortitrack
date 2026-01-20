import { requireCustomerAuth } from '@/lib/auth/b2b-guard';
import { B2BPortalLayout } from '@/components/b2b/B2BPortalLayout';
import { B2BOrdersClient } from './B2BOrdersClient';
import { createClient } from '@/lib/supabase/server';

export default async function B2BOrdersPage() {
  const authContext = await requireCustomerAuth();
  const supabase = await createClient();

  // Build base query for customer's orders
  let ordersQuery = supabase
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

  // Apply store-level filtering: users only see orders they created for their store
  if (authContext.isAddressRestricted && authContext.addressId) {
    ordersQuery = ordersQuery
      .eq('ship_to_address_id', authContext.addressId)
      .eq('created_by_user_id', authContext.user.id);
  }

  const { data: orders } = await ordersQuery;

  return (
    <B2BPortalLayout authContext={authContext}>
      <B2BOrdersClient orders={orders || []} customerId={authContext.customerId} />
    </B2BPortalLayout>
  );
}
