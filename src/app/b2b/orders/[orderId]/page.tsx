import { requireCustomerAuth } from '@/lib/auth/b2b-guard';
import { B2BPortalLayout } from '@/components/b2b/B2BPortalLayout';
import { B2BOrderDetailClient } from './B2BOrderDetailClient';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { logError } from '@/lib/log';

type PageProps = {
  params: Promise<{ orderId: string }>;
};

export default async function B2BOrderDetailPage({ params }: PageProps) {
  const { orderId } = await params;
  const authContext = await requireCustomerAuth();
  const supabase = await createClient();

  // Fetch order with items and pick list info for trolley reconciliation
  const { data: order, error: orderError } = await supabase
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
      trolleys_estimated,
      ship_to_address_id,
      created_by_user_id,
      customer_addresses (
        label,
        store_name,
        line1,
        line2,
        city,
        county,
        eircode,
        country_code
      ),
      pick_lists (
        id,
        trolleys_used
      )
    `)
    .eq('id', orderId)
    .eq('customer_id', authContext.customerId)
    .single();

  if (orderError) {
    logError('B2B order detail query failed', {
      orderId,
      customerId: authContext.customerId,
      isImpersonating: authContext.isImpersonating,
      error: orderError.message,
      code: orderError.code,
    });
  }

  if (!order) {
    notFound();
  }

  // Verify store-level users can only view their own orders for their store
  if (authContext.isAddressRestricted && authContext.addressId) {
    const isOwnOrder = order.created_by_user_id === authContext.user.id;
    const isOwnStore = order.ship_to_address_id === authContext.addressId;
    if (!isOwnOrder || !isOwnStore) {
      notFound();
    }
  }

  // Fetch order items
  const { data: items } = await supabase
    .from('order_items')
    .select(`
      id,
      product_id,
      sku_id,
      description,
      quantity,
      unit_price_ex_vat,
      vat_rate,
      line_total_ex_vat,
      line_vat_amount,
      rrp,
      multibuy_price_2,
      multibuy_qty_2,
      multibuy_price_3,
      multibuy_qty_3
    `)
    .eq('order_id', orderId)
    .order('created_at');

  // Check if order can be edited
  const canEdit = order.status === 'draft' || order.status === 'confirmed';

  return (
    <B2BPortalLayout authContext={authContext}>
      <B2BOrderDetailClient
        order={order}
        items={items || []}
        canEdit={canEdit}
      />
    </B2BPortalLayout>
  );
}
