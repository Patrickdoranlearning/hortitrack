import { requireCustomerAuth } from '@/lib/auth/b2b-guard';
import { B2BPortalLayout } from '@/components/b2b/B2BPortalLayout';
import { B2BDashboardClient } from './B2BDashboardClient';
import { createClient } from '@/lib/supabase/server';

export default async function B2BDashboardPage() {
  const authContext = await requireCustomerAuth();
  const supabase = await createClient();

  // Build base query for recent orders
  let recentOrdersQuery = supabase
    .from('orders')
    .select(`
      id,
      order_number,
      status,
      total_inc_vat,
      requested_delivery_date,
      created_at,
      customer_addresses (
        label,
        store_name
      )
    `)
    .eq('customer_id', authContext.customerId)
    .order('created_at', { ascending: false })
    .limit(5);

  // Apply store-level filtering: users only see orders they created for their store
  if (authContext.isAddressRestricted && authContext.addressId) {
    recentOrdersQuery = recentOrdersQuery
      .eq('ship_to_address_id', authContext.addressId)
      .eq('created_by_user_id', authContext.user.id);
  }

  const { data: recentOrders } = await recentOrdersQuery;

  // Fetch favorite products
  const { data: favorites } = await supabase
    .from('customer_favorite_products')
    .select(`
      id,
      product_id,
      sort_order,
      products (
        id,
        name,
        hero_image_url,
        skus (
          code,
          plant_varieties ( name ),
          plant_sizes ( name )
        )
      )
    `)
    .eq('customer_id', authContext.customerId)
    .order('sort_order');

  return (
    <B2BPortalLayout authContext={authContext}>
      <B2BDashboardClient
        customer={authContext.customer}
        recentOrders={recentOrders || []}
        favorites={favorites || []}
      />
    </B2BPortalLayout>
  );
}
