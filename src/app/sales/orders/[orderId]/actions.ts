'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { createPickListFromOrder, getPickListForOrder } from '@/server/sales/picking';

// ================================================
// ORDER STATUS ACTIONS
// ================================================

export async function updateOrderStatus(orderId: string, newStatus: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
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

  // Validate status transition
  const validTransitions: Record<string, string[]> = {
    draft: ['confirmed', 'void'],
    confirmed: ['picking', 'void'],
    picking: ['ready', 'void'],
    ready: ['dispatched', 'void'],
    dispatched: ['delivered'],
    delivered: [],
    void: [],
  };

  if (!validTransitions[order.status]?.includes(newStatus)) {
    return { error: `Cannot transition from ${order.status} to ${newStatus}` };
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
    console.error('Error updating order status:', updateError);
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
      console.error('Failed to create pick list on order confirmation:', e);
      // Don't fail the status update if pick list creation fails
    }
  }

  revalidatePath(`/sales/orders/${orderId}`);
  revalidatePath('/sales/orders');
  revalidatePath('/dispatch/picking');
  return { success: true };
}

export async function voidOrder(orderId: string) {
  return updateOrderStatus(orderId, 'void');
}

// ================================================
// ORDER ITEM ACTIONS
// ================================================

export async function updateOrderItem(
  itemId: string, 
  updates: { quantity?: number; unit_price_ex_vat?: number }
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
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

  // Check if order can be edited
  if (!['draft', 'confirmed'].includes(item.orders.status)) {
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
    console.error('Error updating order item:', updateError);
    return { error: 'Failed to update order item' };
  }

  // Recalculate order totals
  await recalculateOrderTotals(item.order_id);

  // Log event
  await supabase.from('order_events').insert({
    org_id: item.orders.org_id,
    order_id: item.order_id,
    event_type: 'item_updated',
    description: `Item updated: qty ${quantity}, price €${unitPrice.toFixed(2)}`,
    metadata: { itemId, quantity, unitPrice },
    created_by: user.id,
  });

  revalidatePath(`/sales/orders/${item.order_id}`);
  return { success: true };
}

export async function deleteOrderItem(itemId: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
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

  // Check if order can be edited
  if (!['draft', 'confirmed'].includes(item.orders.status)) {
    return { error: 'Order cannot be edited in current status' };
  }

  // Delete item
  const { error: deleteError } = await supabase
    .from('order_items')
    .delete()
    .eq('id', itemId);

  if (deleteError) {
    console.error('Error deleting order item:', deleteError);
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
  return { success: true };
}

// ================================================
// QC ACTIONS
// ================================================

export async function addQCNote(
  orderId: string, 
  data: { issue_type: string; description: string; severity: string }
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
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
  return { success: true };
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
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
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
    description: `Credit note created for €${totalCreditAmount.toFixed(2)}: ${data.reason}`,
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
  return { success: true };
}

// ================================================
// HELPERS
// ================================================

async function recalculateOrderTotals(orderId: string) {
  const supabase = await createClient();

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

function roundToTwo(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

