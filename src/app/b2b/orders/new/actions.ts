'use server';

import { createClient } from '@/lib/supabase/server';
import { requireCustomerAuth } from '@/lib/auth/b2b-guard';
import { revalidatePath } from 'next/cache';
import type { CartItem } from '@/lib/b2b/types';
import { createPickListFromOrder } from '@/server/sales/picking';
import { calculateTrolleysNeeded, type OrderLineForCalculation } from '@/lib/dispatch/trolley-calculation';
import { getTrolleyCapacityConfigs, getShelfQuantitiesForSizes } from '@/server/dispatch/trolley-capacity.server';

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

  // Calculate estimated trolleys needed
  let trolleysEstimated = 0;
  try {
    // Get capacity configs and shelf quantities
    const sizeIds = [...new Set(cart.map(item => item.sizeId).filter(Boolean))] as string[];
    const [capacityConfigs, shelfQuantityMap] = await Promise.all([
      getTrolleyCapacityConfigs(),
      getShelfQuantitiesForSizes(sizeIds),
    ]);

    // Build calculation lines
    const calcLines: OrderLineForCalculation[] = cart
      .filter(item => item.sizeId) // Only items with sizeId can be calculated
      .map(item => ({
        sizeId: item.sizeId!,
        family: item.family ?? null,
        quantity: item.quantity,
        shelfQuantity: shelfQuantityMap.get(item.sizeId!) ?? 1,
      }));

    if (calcLines.length > 0) {
      const trolleyResult = calculateTrolleysNeeded(calcLines, capacityConfigs);
      trolleysEstimated = trolleyResult.totalTrolleys;
    }
  } catch (err) {
    console.warn('Failed to calculate trolleys estimate:', err);
    // Don't fail order creation if trolley calculation fails
  }

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
      trolleys_estimated: trolleysEstimated > 0 ? trolleysEstimated : null,
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

    // Determine variety description
    const varietyDesc = item.requiredVarietyName || item.varietyName;

    return {
      order_id: order.id,
      product_id: item.productId,
      sku_id: item.skuId,
      description: `${item.productName}${varietyDesc ? ` - ${varietyDesc}` : ''}${item.sizeName ? ` (${item.sizeName})` : ''}`,
      quantity: item.quantity,
      unit_price_ex_vat: item.unitPriceExVat,
      vat_rate: item.vatRate,
      line_total_ex_vat: lineTotalExVat,
      line_vat_amount: lineVatAmount,
      rrp: item.rrp || null,
      multibuy_price_2: item.multibuyPrice2 || null,
      multibuy_qty_2: item.multibuyQty2 || null,
      // Variety and batch constraints for picking validation
      required_variety_id: item.requiredVarietyId || null,
      required_batch_id: item.requiredBatchId || item.batchId || null,
    };
  });

  const { data: insertedItems, error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems)
    .select('id, product_id, sku_id');

  if (itemsError || !insertedItems) {
    console.error('Order items creation error:', itemsError);
    // Attempt to delete the order if items failed
    await supabase.from('orders').delete().eq('id', order.id);
    return { error: 'Failed to create order items' };
  }

  // Create batch allocations based on customer batch selections
  // Supports both single batch (batchId) and multiple batches (batchAllocations)
  // We need to map cart items to their created order_item_ids
  const allBatchAllocations: Array<{
    org_id: string;
    order_item_id: string;
    batch_id: string;
    quantity: number;
    status: 'allocated';
  }> = [];

  for (let i = 0; i < cart.length; i++) {
    const item = cart[i];
    const orderItem = insertedItems[i];
    
    if (!orderItem) continue;

    // Prefer multi-batch allocations if present
    if (item.batchAllocations && item.batchAllocations.length > 0) {
      for (const allocation of item.batchAllocations) {
        allBatchAllocations.push({
          org_id: customer.org_id,
          order_item_id: orderItem.id,
          batch_id: allocation.batchId,
          quantity: allocation.qty,
          status: 'allocated',
        });
      }
    } else if (item.batchId) {
      // Fall back to single batch allocation
      allBatchAllocations.push({
        org_id: customer.org_id,
        order_item_id: orderItem.id,
        batch_id: item.batchId,
        quantity: item.quantity,
        status: 'allocated',
      });
    }
  }

  if (allBatchAllocations.length > 0) {
    const { error: allocError } = await supabase.from('batch_allocations').insert(allBatchAllocations);
    if (allocError) {
      console.warn('Failed to create batch allocations:', allocError.message);
      // Don't fail the order if allocations fail
    }
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
