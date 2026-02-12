'use server';

import { createClient } from '@/lib/supabase/server';
import { requireCustomerAuth } from '@/lib/auth/b2b-guard';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { CartItem } from '@/lib/b2b/types';
import { createPickListFromOrder } from '@/server/sales/picking';
import { calculateTrolleysNeeded, type OrderLineForCalculation } from '@/lib/dispatch/trolley-calculation';
import { getTrolleyCapacityConfigs, getShelfQuantitiesForSizes } from '@/server/dispatch/trolley-capacity.server';
import { logError, logWarning } from '@/lib/log';

type CreateB2BOrderInput = {
  customerId: string;
  cart: CartItem[];
  deliveryAddressId: string;
  deliveryDate?: string;
  notes?: string;
};

export async function createB2BOrder(input: CreateB2BOrderInput) {
  const { customerId, cart, deliveryAddressId, deliveryDate, notes } = input;

  // B2B portal uses customer-level auth instead of staff auth
  // requireCustomerAuth() verifies the customer is logged in via B2B portal
  // and returns customerId, orgId, and optional addressId for store-level users
  const authContext = await requireCustomerAuth();

  if (authContext.customerId !== customerId) {
    return { error: 'Access denied' };
  }

  // Validate address restriction: store-level users can only order to their assigned store
  if (authContext.isAddressRestricted && authContext.addressId) {
    if (deliveryAddressId !== authContext.addressId) {
      return { error: 'You can only place orders for your assigned store location' };
    }
  }

  if (cart.length === 0) {
    return { error: 'Cart is empty' };
  }

  const supabase = await createClient();

  // Get customer details for order
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('org_id')
    .eq('id', customerId)
    .maybeSingle();

  if (customerError || !customer) {
    return { error: 'Customer not found' };
  }

  // Generate order number
  const orderNumber = `B2B-${Date.now()}`;

  // Prepare lines for the atomic RPC
  const rpcLines = cart.map((item) => {
    // Determine variety description
    const varietyDesc = item.requiredVarietyName || item.varietyName;
    const description = `${item.productName}${varietyDesc ? ` - ${varietyDesc}` : ''}${item.sizeName ? ` (${item.sizeName})` : ''}`;

    return {
      sku_id: item.skuId,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPriceExVat,
      vat_rate: item.vatRate,
      description,
      required_variety_id: null,
      required_batch_id: null,
      allocations: []
    };
  });

  // Create order atomically using RPC
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'create_order_with_allocations',
    {
      p_org_id: customer.org_id,
      p_customer_id: customerId,
      p_order_number: orderNumber,
      p_lines: rpcLines,
      p_requested_delivery_date: deliveryDate || null,
      p_notes: notes || null,
      p_ship_to_address_id: deliveryAddressId,
      p_status: 'confirmed',
      p_created_by_user_id: authContext.user.id,
      p_created_by_staff_id: authContext.isImpersonating ? authContext.staffUserId : null
    }
  );

  if (rpcError || !rpcResult) {
    logError('Order creation error (RPC)', { error: rpcError?.message || String(rpcError) });
    // Parse specific error messages for better UX if possible
    const errorMsg = rpcError?.message || 'Failed to create order';
    if (errorMsg.includes('Insufficient stock')) {
      return { error: 'Insufficient stock available for one or more items.' };
    }
    return { error: errorMsg };
  }

  const orderId = (rpcResult as { order_id: string }).order_id;

  // Calculate and update trolleys_estimated (Non-critical post-creation step)
  try {
    // Get capacity configs and shelf quantities
    const sizeIds = [...new Set(cart.map(item => item.sizeId).filter(Boolean))] as string[];
    const [capacityConfigs, shelfQuantityMap] = await Promise.all([
      getTrolleyCapacityConfigs(),
      getShelfQuantitiesForSizes(sizeIds),
    ]);

    // Build calculation lines
    const calcLines: OrderLineForCalculation[] = cart
      .filter(item => item.sizeId)
      .map(item => ({
        sizeId: item.sizeId!,
        family: item.family ?? null,
        quantity: item.quantity,
        shelfQuantity: shelfQuantityMap.get(item.sizeId!) ?? 1,
      }));

    if (calcLines.length > 0) {
      const trolleyResult = calculateTrolleysNeeded(calcLines, capacityConfigs);
      if (trolleyResult.totalTrolleys > 0) {
        await supabase
          .from('orders')
          .update({ trolleys_estimated: trolleyResult.totalTrolleys })
          .eq('id', orderId);
      }
    }
  } catch (err) {
    logWarning('Failed to calculate trolleys estimate', { error: err instanceof Error ? err.message : String(err) });
  }

  // Auto-create pick list for confirmed orders
  try {
    await createPickListFromOrder(orderId);
  } catch (e) {
    logError('Failed to create pick list for B2B order', { error: e instanceof Error ? e.message : String(e) });
  }

  // Revalidate paths
  revalidatePath('/b2b/orders');
  revalidatePath('/b2b/dashboard');
  revalidatePath('/dispatch/picker');

  // Server-side redirect to order detail — more reliable than client-side router.push()
  // which can hit cookie/auth timing issues after server action completion
  redirect(`/b2b/orders/${orderId}`);
}
