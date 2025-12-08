'use server';

import { createClient } from '@/lib/supabase/server';
import { requireCustomerAuth } from '@/lib/auth/b2b-guard';
import { revalidatePath } from 'next/cache';
import type { CartItem } from '@/lib/b2b/types';
import { createPickListFromOrder } from '@/server/sales/picking';

type CreateB2BOrderInput = {
  customerId: string;
  cart: CartItem[];
  deliveryAddressId: string;
  deliveryDate?: string;
  notes?: string;
};

export async function createB2BOrder(input: CreateB2BOrderInput) {
  const { customerId, cart, deliveryAddressId, deliveryDate, notes } = input;

  // Validate auth
  const authContext = await requireCustomerAuth();

  if (authContext.customerId !== customerId) {
    return { error: 'Access denied' };
  }

  if (cart.length === 0) {
    return { error: 'Cart is empty' };
  }

  const supabase = await createClient();

  // Get customer details for order
  const { data: customer } = await supabase
    .from('customers')
    .select('org_id')
    .eq('id', customerId)
    .single();

  if (!customer) {
    return { error: 'Customer not found' };
  }

  // Calculate totals
  const subtotalExVat = cart.reduce((sum, item) => sum + item.quantity * item.unitPriceExVat, 0);
  const vatAmount = cart.reduce((sum, item) => {
    const lineTotal = item.quantity * item.unitPriceExVat;
    return sum + (lineTotal * (item.vatRate / 100));
  }, 0);
  const totalIncVat = subtotalExVat + vatAmount;

  // Generate order number (simple timestamp-based, you may want to use a sequence)
  const orderNumber = `B2B-${Date.now()}`;

  // Create order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      org_id: customer.org_id,
      customer_id: customerId,
      order_number: orderNumber,
      status: 'confirmed', // Auto-confirm B2B orders
      ship_to_address_id: deliveryAddressId,
      requested_delivery_date: deliveryDate || null,
      notes: notes || null,
      subtotal_ex_vat: subtotalExVat,
      vat_amount: vatAmount,
      total_inc_vat: totalIncVat,
      created_by_staff_id: authContext.isImpersonating ? authContext.staffUserId : null,
    })
    .select()
    .single();

  if (orderError || !order) {
    console.error('Order creation error:', orderError);
    return { error: 'Failed to create order' };
  }

  // Create order items
  const orderItems = cart.map((item) => {
    const lineTotalExVat = item.quantity * item.unitPriceExVat;
    const lineVatAmount = lineTotalExVat * (item.vatRate / 100);

    return {
      order_id: order.id,
      product_id: item.productId,
      sku_id: item.skuId,
      description: `${item.productName}${item.varietyName ? ` - ${item.varietyName}` : ''}${item.sizeName ? ` (${item.sizeName})` : ''}`,
      quantity: item.quantity,
      unit_price_ex_vat: item.unitPriceExVat,
      vat_rate: item.vatRate,
      line_total_ex_vat: lineTotalExVat,
      line_vat_amount: lineVatAmount,
      rrp: item.rrp || null,
      multibuy_price_2: item.multibuyPrice2 || null,
      multibuy_qty_2: item.multibuyQty2 || null,
    };
  });

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems);

  if (itemsError) {
    console.error('Order items creation error:', itemsError);
    // Attempt to delete the order if items failed
    await supabase.from('orders').delete().eq('id', order.id);
    return { error: 'Failed to create order items' };
  }

  // Optionally create batch allocations based on customer batch selections
  // This is a preference hint, not a strict allocation
  const batchAllocations = cart
    .filter((item) => item.batchId)
    .map((item) => ({
      order_id: order.id,
      batch_id: item.batchId!,
      quantity_allocated: item.quantity,
    }));

  if (batchAllocations.length > 0) {
    // Note: This assumes you have an order_allocations table
    // If not, you can skip this step
    await supabase.from('order_allocations').insert(batchAllocations);
  }

  // Auto-create pick list for confirmed orders (so they appear in dispatch/picking queue)
  try {
    await createPickListFromOrder(order.id);
  } catch (e) {
    console.error('Failed to create pick list for B2B order:', e);
    // Don't fail the order creation if pick list fails
  }

  // Revalidate paths
  revalidatePath('/b2b/orders');
  revalidatePath('/b2b/dashboard');
  revalidatePath('/dispatch/picking');

  return { orderId: order.id };
}
