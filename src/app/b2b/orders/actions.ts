'use server';

import { createClient } from '@/lib/supabase/server';
import { requireCustomerAuth } from '@/lib/auth/b2b-guard';

/**
 * Reorder from a past order
 * This prepares the cart data for the user but doesn't create a new order yet
 */
export async function reorderFromPastOrder(orderId: string) {
  const authContext = await requireCustomerAuth();
  const supabase = await createClient();

  // Verify order belongs to customer
  const { data: order } = await supabase
    .from('orders')
    .select('id, customer_id')
    .eq('id', orderId)
    .eq('customer_id', authContext.customerId)
    .single();

  if (!order) {
    return { error: 'Order not found or access denied' };
  }

  // Fetch order items
  const { data: items } = await supabase
    .from('order_items')
    .select(`
      product_id,
      sku_id,
      description,
      quantity,
      unit_price_ex_vat,
      vat_rate,
      rrp,
      multibuy_price_2,
      multibuy_qty_2
    `)
    .eq('order_id', orderId);

  if (!items || items.length === 0) {
    return { error: 'No items found in order' };
  }

  // Return cart data structure
  // Note: In a real implementation, you might store this in a session/cookie
  // or pass it via query params to the new order page
  return { success: true, items };
}
