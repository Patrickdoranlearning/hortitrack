
'use server';

import { createClient } from '@/lib/supabase/server';
import { CreateOrderSchema, CreateOrderInput } from '@/lib/sales/types';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createOrder(data: CreateOrderInput) {
    const supabase = await createClient();

    // Validate input
    const result = CreateOrderSchema.safeParse(data);
    if (!result.success) {
        return { error: 'Invalid form data', details: result.error.flatten() };
    }

    const { customerId, lines, deliveryDate, notesInternal, notesCustomer } = result.data;

    // 1. Create Order
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
            org_id: 'org1', // TODO: Get from session/context
            customer_id: customerId,
            order_number: `ORD-${Date.now()}`, // Simple generation for now
            status: 'confirmed',
            subtotal_ex_vat: 0, // Calculate from lines
            vat_amount: 0,
            total_inc_vat: 0,
            requested_delivery_date: deliveryDate || null,
            notes: notesInternal,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (orderError) {
        console.error('Error creating order:', orderError);
        return { error: 'Failed to create order' };
    }

    // 2. Create Order Items
    const orderItems = lines.map(line => ({
        order_id: order.id,
        // For MVP, we might need to resolve batch_id or just store product info
        // Assuming line.plantVariety is the product ID or name for now
        // We need to map this correctly to the DB schema
        quantity: line.qty,
        unit_price: line.unitPrice || 0,
        total_price: (line.unitPrice || 0) * line.qty,
    }));

    const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

    if (itemsError) {
        console.error('Error creating order items:', itemsError);
        // Ideally we should rollback the order here
        return { error: 'Failed to create order items' };
    }

    revalidatePath('/sales/orders');
    redirect('/sales/orders');
}

export async function generateInvoice(orderId: string) {
    const supabase = await createClient();

    // 1. Fetch Order and Items
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', orderId)
        .single();

    if (orderError || !order) {
        return { error: 'Order not found' };
    }

    // 2. Calculate Totals
    // For now, assuming order totals are correct, but ideally we recalculate from items
    // Let's just use the order totals for simplicity in this phase
    const subtotal = order.subtotal_ex_vat;
    const vat = order.vat_amount;
    const total = order.total_inc_vat;

    // 3. Create Invoice
    const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
            org_id: order.org_id,
            customer_id: order.customer_id,
            invoice_number: `INV-${Date.now()}`,
            status: 'issued',
            issue_date: new Date().toISOString(),
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days due
            subtotal_ex_vat: subtotal,
            vat_amount: vat,
            total_inc_vat: total,
        })
        .select()
        .single();

    if (invoiceError) {
        console.error('Error creating invoice:', invoiceError);
        return { error: 'Failed to create invoice' };
    }

    revalidatePath('/sales/invoices');
    revalidatePath('/sales/orders');
    return { success: true, invoice };
}

export async function getOrderDetails(orderId: string) {
    const supabase = await createClient();

    const { data: order, error } = await supabase
        .from('orders')
        .select(`
            *,
            order_items (*),
            invoices (*),
            pick_orders (*),
            sales_qc (*)
        `)
        .eq('id', orderId)
        .single();

    if (error) {
        console.error('Error fetching order details:', error);
        return { error: 'Failed to fetch order details' };
    }

    return { order };
}
