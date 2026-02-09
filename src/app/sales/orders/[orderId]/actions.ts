'use server';

import { createClient } from '@/lib/supabase/server';
import { getUserAndOrg } from '@/server/auth/org';
import { revalidatePath } from 'next/cache';
import { createPickListFromOrder, getPickListForOrder } from '@/server/sales/picking';
import { logError } from '@/lib/log';
import { roundToTwo } from '@/lib/utils';
import { formatCurrency, type CurrencyCode } from '@/lib/format-currency';

// ================================================
// ORDER STATUS ACTIONS
// ================================================

export async function updateOrderStatus(orderId: string, newStatus: string) {
  let user, orgId, supabase;
  try {
    const auth = await getUserAndOrg();
    user = auth.user;
    orgId = auth.orgId;
    supabase = auth.supabase;
  } catch {
    return { error: 'Not authenticated' };
  }

  // Get current order
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('status, org_id')
    .eq('id', orderId)
    .single();

  if (fetchError || !order) {
    return { error: 'Order not found' };
  }

  // Verify order belongs to user's organization
  if (order.org_id !== orgId) {
    return { error: 'Not authorized to modify this order' };
  }

  // Validate status transition
  // Order status enum: draft, confirmed, picking, ready, packed, dispatched, delivered, cancelled, void
  const validTransitions: Record<string, string[]> = {
    draft: ['confirmed', 'void'],
    confirmed: ['picking', 'void'],
    picking: ['packed', 'void'],
    ready: ['dispatched', 'void'], // legacy status - still allow transition
    packed: ['dispatched', 'void'],
    dispatched: ['delivered'],
    delivered: [],
    cancelled: [],
    void: [],
  };

  if (!validTransitions[order.status]?.includes(newStatus)) {
    return { error: `Cannot transition from ${order.status} to ${newStatus}` };
  }

  // Check pick list status for certain transitions
  // Cannot move to 'dispatched' unless pick list is completed
  if (newStatus === 'dispatched') {
    const { data: pickList } = await supabase
      .from('pick_lists')
      .select('id, status')
      .eq('order_id', orderId)
      .maybeSingle();

    if (pickList && pickList.status !== 'completed') {
      return { error: 'Cannot dispatch order - picking has not been completed. Complete the pick list first.' };
    }
  }

  // Cannot move to 'packed' manually - this should only happen when pick list is completed
  // Allow it if no pick list exists (manual workflow) or if pick list is completed
  if (newStatus === 'packed' && order.status === 'picking') {
    const { data: pickList } = await supabase
      .from('pick_lists')
      .select('id, status')
      .eq('order_id', orderId)
      .maybeSingle();

    if (pickList && pickList.status !== 'completed') {
      return { error: 'Cannot mark as ready - picking has not been completed. Complete the pick list first.' };
    }
  }

  // Update status
  const { error: updateError } = await supabase
    .from('orders')
    .update({ 
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (updateError) {
    logError('Error updating order status', { error: updateError?.message || String(updateError) });
    return { error: 'Failed to update order status' };
  }

  // Log event
  await supabase.from('order_events').insert({
    org_id: order.org_id,
    order_id: orderId,
    event_type: 'status_changed',
    description: `Status changed from ${order.status} to ${newStatus}`,
    created_by: user.id,
  });

  // When order is confirmed, auto-create a pick list if one doesn't exist
  if (newStatus === 'confirmed') {
    try {
      const existingPickList = await getPickListForOrder(orderId);
      if (!existingPickList) {
        await createPickListFromOrder(orderId);
      }
    } catch (e) {
      logError('Failed to create pick list on order confirmation', { error: e instanceof Error ? e.message : String(e) });
      // Don't fail the status update if pick list creation fails
    }
  }

  revalidatePath(`/sales/orders/${orderId}`);
  revalidatePath('/sales/orders');
  revalidatePath('/dispatch/picker');
  return {
    success: true,
    _mutated: {
      resource: 'orders' as const,
      action: 'update' as const,
      id: orderId,
    },
  };
}

export async function voidOrder(orderId: string) {
  let user, orgId, supabase;
  try {
    const auth = await getUserAndOrg();
    user = auth.user;
    orgId = auth.orgId;
    supabase = auth.supabase;
  } catch {
    return { error: 'Not authenticated' };
  }

  // Use atomic RPC to void order and release allocations in single transaction
  // This prevents orphaned allocations that block stock
  const { data: rpcResult, error: rpcError } = await supabase.rpc("void_order_with_allocations", {
    p_org_id: orgId,
    p_order_id: orderId,
    p_user_id: user.id,
  });

  if (rpcError) {
    logError('Error in void_order_with_allocations', { error: rpcError?.message || String(rpcError) });
    return { error: rpcError.message || 'Failed to void order' };
  }

  if (!rpcResult?.success) {
    logError('void_order_with_allocations failed', { error: rpcResult?.error || 'Unknown error' });
    return { error: rpcResult?.error || 'Failed to void order' };
  }

  revalidatePath(`/sales/orders/${orderId}`);
  revalidatePath('/sales/orders');
  revalidatePath('/dispatch/picker');

  return {
    success: true,
    allocationsReleased: rpcResult.allocationsReleased,
    _mutated: {
      resource: 'orders' as const,
      action: 'update' as const,
      id: orderId,
    },
  };
}

// ================================================
// ORDER ITEM ACTIONS
// ================================================

export async function updateOrderItem(
  itemId: string,
  updates: { quantity?: number; unit_price_ex_vat?: number }
) {
  let user, orgId, supabase;
  try {
    const auth = await getUserAndOrg();
    user = auth.user;
    orgId = auth.orgId;
    supabase = auth.supabase;
  } catch {
    return { error: 'Not authenticated' };
  }

  // Get current item and order
  const { data: item, error: fetchError } = await supabase
    .from('order_items')
    .select('*, orders(status, org_id)')
    .eq('id', itemId)
    .single();

  if (fetchError || !item) {
    return { error: 'Order item not found' };
  }

  // Verify order belongs to user's organization
  if (item.orders.org_id !== orgId) {
    return { error: 'Not authorized to modify this order' };
  }

  // Check if order can be edited
  // Allow editing in draft, confirmed, and picking statuses
  // This enables adjustments when customers call to change quantities
  if (!['draft', 'confirmed', 'picking'].includes(item.orders.status)) {
    return { error: 'Order cannot be edited in current status' };
  }

  // Calculate new line totals
  const quantity = updates.quantity ?? item.quantity;
  const unitPrice = updates.unit_price_ex_vat ?? item.unit_price_ex_vat;
  const lineTotalExVat = roundToTwo(quantity * unitPrice);
  const lineVatAmount = roundToTwo(lineTotalExVat * (item.vat_rate / 100));

  // Update item
  const { error: updateError } = await supabase
    .from('order_items')
    .update({
      quantity,
      unit_price_ex_vat: unitPrice,
      line_total_ex_vat: lineTotalExVat,
      line_vat_amount: lineVatAmount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  if (updateError) {
    logError('Error updating order item', { error: updateError?.message || String(updateError) });
    return { error: 'Failed to update order item' };
  }

  // If quantity was reduced, check if allocations exceed new quantity and release excess
  if (updates.quantity !== undefined && updates.quantity < item.quantity) {
    const { data: allocations } = await supabase
      .from('batch_allocations')
      .select('id, quantity, status')
      .eq('order_item_id', itemId)
      .in('status', ['reserved', 'allocated'])
      .order('created_at', { ascending: false });

    if (allocations && allocations.length > 0) {
      const totalAllocated = allocations.reduce((sum, a) => sum + a.quantity, 0);
      if (totalAllocated > quantity) {
        let excess = totalAllocated - quantity;
        for (const alloc of allocations) {
          if (excess <= 0) break;
          const { error: cancelError } = await supabase.rpc('fn_cancel_allocation', {
            p_allocation_id: alloc.id,
            p_reason: `Order item quantity reduced from ${item.quantity} to ${quantity}`,
            p_actor_id: user.id,
          });
          if (cancelError) {
            logError('Error cancelling excess allocation', { error: cancelError.message, allocationId: alloc.id, itemId });
          }
          excess -= alloc.quantity;
        }
      }
    }
  }

  // Recalculate order totals
  await recalculateOrderTotals(item.order_id);

  // Log event
  await supabase.from('order_events').insert({
    org_id: item.orders.org_id,
    order_id: item.order_id,
    event_type: 'item_updated',
    description: `Item updated: qty ${quantity}, price ${formatCurrency(unitPrice)}`,
    metadata: { itemId, quantity, unitPrice },
    created_by: user.id,
  });

  revalidatePath(`/sales/orders/${item.order_id}`);
  return {
    success: true,
    _mutated: {
      resource: 'orders' as const,
      action: 'update' as const,
      id: item.order_id,
    },
  };
}

export async function deleteOrderItem(itemId: string) {
  let user, orgId, supabase;
  try {
    const auth = await getUserAndOrg();
    user = auth.user;
    orgId = auth.orgId;
    supabase = auth.supabase;
  } catch {
    return { error: 'Not authenticated' };
  }

  // Get current item and order
  const { data: item, error: fetchError } = await supabase
    .from('order_items')
    .select('*, orders(status, org_id)')
    .eq('id', itemId)
    .single();

  if (fetchError || !item) {
    return { error: 'Order item not found' };
  }

  // Verify order belongs to user's organization
  if (item.orders.org_id !== orgId) {
    return { error: 'Not authorized to modify this order' };
  }

  // Check if order can be edited
  // Allow editing in draft, confirmed, and picking statuses
  // This enables adjustments when customers call to change quantities
  if (!['draft', 'confirmed', 'picking'].includes(item.orders.status)) {
    return { error: 'Order cannot be edited in current status' };
  }

  // Release any allocations for this item before deleting
  const { data: allocations } = await supabase
    .from('batch_allocations')
    .select('id, quantity, status')
    .eq('order_item_id', itemId)
    .in('status', ['reserved', 'allocated']);

  if (allocations && allocations.length > 0) {
    for (const alloc of allocations) {
      const { error: cancelError } = await supabase.rpc('fn_cancel_allocation', {
        p_allocation_id: alloc.id,
        p_reason: 'Order item deleted',
        p_actor_id: user.id,
      });
      if (cancelError) {
        logError('Error cancelling allocation on item delete', { error: cancelError.message, allocationId: alloc.id, itemId });
      }
    }
  }

  // Delete item
  const { error: deleteError } = await supabase
    .from('order_items')
    .delete()
    .eq('id', itemId);

  if (deleteError) {
    logError('Error deleting order item', { error: deleteError?.message || String(deleteError) });
    return { error: 'Failed to delete order item' };
  }

  // Recalculate order totals
  await recalculateOrderTotals(item.order_id);

  // Log event
  await supabase.from('order_events').insert({
    org_id: item.orders.org_id,
    order_id: item.order_id,
    event_type: 'item_deleted',
    description: `Item removed from order`,
    metadata: { itemId, description: item.description },
    created_by: user.id,
  });

  revalidatePath(`/sales/orders/${item.order_id}`);
  return {
    success: true,
    _mutated: {
      resource: 'orders' as const,
      action: 'update' as const,
      id: item.order_id,
    },
  };
}

// ================================================
// QC ACTIONS
// ================================================

export async function addQCNote(
  orderId: string,
  data: { issue_type: string; description: string; severity: string }
) {
  let user, orgId, supabase;
  try {
    const auth = await getUserAndOrg();
    user = auth.user;
    orgId = auth.orgId;
    supabase = auth.supabase;
  } catch {
    return { error: 'Not authenticated' };
  }

  // Get order org_id
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('org_id')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    return { error: 'Order not found' };
  }

  // Verify order belongs to user's organization
  if (order.org_id !== orgId) {
    return { error: 'Not authorized to modify this order' };
  }

  // Log QC event
  await supabase.from('order_events').insert({
    org_id: order.org_id,
    order_id: orderId,
    event_type: 'qc_note_added',
    description: `QC ${data.severity}: ${data.issue_type} - ${data.description}`,
    metadata: data,
    created_by: user.id,
  });

  revalidatePath(`/sales/orders/${orderId}`);
  return {
    success: true,
    _mutated: {
      resource: 'orders' as const,
      action: 'update' as const,
      id: orderId,
    },
  };
}

// ================================================
// CREDIT NOTE ACTIONS
// ================================================

export async function createCreditNote(
  orderId: string,
  data: {
    reason: string;
    items: Array<{
      orderItemId: string;
      quantity: number;
      amount: number;
    }>;
  }
) {
  let user, orgId, supabase;
  try {
    const auth = await getUserAndOrg();
    user = auth.user;
    orgId = auth.orgId;
    supabase = auth.supabase;
  } catch {
    return { error: 'Not authenticated' };
  }

  // Get order and invoice
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*, invoices(*)')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    return { error: 'Order not found' };
  }

  // Verify order belongs to user's organization
  if (order.org_id !== orgId) {
    return { error: 'Not authorized to modify this order' };
  }

  if (!order.invoices || order.invoices.length === 0) {
    return { error: 'No invoice found for this order' };
  }

  const invoice = order.invoices[0];
  const totalCreditAmount = data.items.reduce((sum, item) => sum + item.amount, 0);

  // For now, we'll log the credit note as an event since there's no credit_notes table
  // In a full implementation, you would create a credit_notes table and insert there
  await supabase.from('order_events').insert({
    org_id: order.org_id,
    order_id: orderId,
    event_type: 'credit_note_created',
    description: `Credit note created for ${formatCurrency(totalCreditAmount)}: ${data.reason}`,
    metadata: {
      invoiceId: invoice.id,
      reason: data.reason,
      items: data.items,
      totalAmount: totalCreditAmount,
    },
    created_by: user.id,
  });

  // Update invoice balance
  const newAmountCredited = (invoice.amount_credited || 0) + totalCreditAmount;
  const newBalanceDue = invoice.total_inc_vat - newAmountCredited;

  await supabase
    .from('invoices')
    .update({
      amount_credited: newAmountCredited,
      balance_due: newBalanceDue,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoice.id);

  revalidatePath(`/sales/orders/${orderId}`);
  revalidatePath('/sales/invoices');
  return {
    success: true,
    _mutated: {
      resource: 'orders' as const,
      action: 'update' as const,
      id: orderId,
      relatedResources: ['invoices' as const],
    },
  };
}

// ================================================
// HELPERS
// ================================================

async function recalculateOrderTotals(orderId: string) {
  const { supabase } = await getUserAndOrg();

  // Get all items for this order
  const { data: items } = await supabase
    .from('order_items')
    .select('line_total_ex_vat, line_vat_amount')
    .eq('order_id', orderId);

  if (!items) return;

  const subtotalExVat = roundToTwo(items.reduce((sum, item) => sum + (item.line_total_ex_vat || 0), 0));
  const vatAmount = roundToTwo(items.reduce((sum, item) => sum + (item.line_vat_amount || 0), 0));
  const totalIncVat = roundToTwo(subtotalExVat + vatAmount);

  await supabase
    .from('orders')
    .update({
      subtotal_ex_vat: subtotalExVat,
      vat_amount: vatAmount,
      total_inc_vat: totalIncVat,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);
}


