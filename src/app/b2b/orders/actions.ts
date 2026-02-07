'use server';

import { createClient } from '@/lib/supabase/server';
import { requireCustomerAuth } from '@/lib/auth/b2b-guard';
import { logError } from '@/lib/log';
import type { ActionResult } from '@/lib/errors';

// Type for order item data
interface OrderItemData {
  product_id: string | null;
  sku_id: string;
  description: string;
  quantity: number;
  unit_price_ex_vat: number;
  vat_rate: number;
  rrp: number | null;
  multibuy_price_2: number | null;
  multibuy_qty_2: number | null;
}

/**
 * Reorder from a past order
 * This prepares the cart data for the user but doesn't create a new order yet
 *
 * @param orderId - UUID of the order to reorder from
 * @returns ActionResult with order items or error
 */
export async function reorderFromPastOrder(
  orderId: string
): Promise<ActionResult<OrderItemData[]>> {
  // B2B portal uses customer-level auth instead of staff auth
  // requireCustomerAuth() verifies the customer is logged in via B2B portal
  // and returns customerId and orgId for the authenticated customer
  const authContext = await requireCustomerAuth();
  const supabase = await createClient();

  // Verify order belongs to customer
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, customer_id')
    .eq('id', orderId)
    .eq('customer_id', authContext.customerId)
    .maybeSingle();

  if (orderError || !order) {
    logError('Failed to fetch order for reorder', {
      orderId,
      customerId: authContext.customerId,
      error: orderError?.message,
    });

    return {
      success: false,
      error: 'Order not found or access denied',
      code: 'ORDER_NOT_FOUND',
    };
  }

  // Fetch order items
  const { data: items, error: itemsError } = await supabase
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

  if (itemsError) {
    logError('Failed to fetch order items for reorder', {
      orderId,
      error: itemsError.message,
    });

    return {
      success: false,
      error: 'Failed to load order items',
      code: 'ITEMS_FETCH_FAILED',
      details: process.env.NODE_ENV === 'development' ? itemsError.message : undefined,
    };
  }

  if (!items || items.length === 0) {
    return {
      success: false,
      error: 'No items found in order',
      code: 'NO_ITEMS',
    };
  }

  // Return cart data structure
  // Note: In a real implementation, you might store this in a session/cookie
  // or pass it via query params to the new order page
  return {
    success: true,
    data: items as OrderItemData[],
  };
}
