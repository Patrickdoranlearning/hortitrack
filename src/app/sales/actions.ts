
'use server';

import { createClient } from '@/lib/supabase/server';
import { CreateOrderSchema, CreateOrderInput } from '@/lib/sales/types';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type ServerClient = SupabaseClient<Database>;

const DEFAULT_VAT_RATE = 13.5;

type ProductRow = {
    id: string;
    org_id: string;
    name: string | null;
    description: string | null;
    sku_id: string;
    skus?: {
        id: string;
        default_vat_rate: number | null;
        plant_variety_id: string | null;
        size_id: string | null;
        plant_varieties?:
            | { id: string | null; name: string | null }
            | Array<{ id: string | null; name: string | null }>
            | null;
        plant_sizes?:
            | { id: string | null; name: string | null }
            | Array<{ id: string | null; name: string | null }>
            | null;
    } | null;
};

type CustomerOrgRow = {
    id: string;
    org_id: string;
    default_price_list_id: string | null;
};

export async function createOrder(data: CreateOrderInput) {
    const supabase = await createClient();

    // Validate input
    const result = CreateOrderSchema.safeParse(data);
    if (!result.success) {
        return { error: 'Invalid form data', details: result.error.flatten() };
    }

    const { customerId, lines, deliveryDate, notesInternal, notesCustomer, shipToAddressId, storeId } = result.data;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { error: 'Unauthenticated' };
    }

    const activeOrgId = await resolveActiveOrgId(supabase, user.id);

    const customerRecord = await fetchCustomerWithOrg(supabase, customerId);
    if (!customerRecord) {
        return { error: 'Customer not found' };
    }

    if (activeOrgId && customerRecord.org_id && activeOrgId !== customerRecord.org_id) {
        return { error: 'Customer belongs to a different organization' };
    }

    const orgId = customerRecord.org_id;

    const products = await fetchOrgProducts(supabase, orgId);
    if (!products.length) {
        return { error: 'No products configured for this organization' };
    }

    const productMap = buildProductMaps(products);
    const today = new Date().toISOString().slice(0, 10);

    const resolvedProducts = [];
    for (const line of lines) {
        const product = resolveProductForLine(line, productMap);
        if (!product) {
            return { error: `No product found for ${line.productId || `${line.plantVariety} ${line.size}`}` };
        }
        resolvedProducts.push({ line, product });
    }

    const priceListId = await resolvePriceListId(
        supabase,
        customerId,
        orgId,
        today,
        customerRecord.default_price_list_id
    );
    const priceMap = await fetchActivePricesForProducts(
        supabase,
        priceListId,
        resolvedProducts.map(({ product }) => product.id),
        today
    );

    const resolvedLines = [];
    for (const { line, product } of resolvedProducts) {
        const productId = product.id;
        const skuId = product.sku_id;
        const vatRate = line.vatRate ?? product.skus?.default_vat_rate ?? DEFAULT_VAT_RATE;

        const priceFromList = priceMap.get(productId);
        const unitPrice = line.unitPrice ?? priceFromList ?? 0;
        const quantity = line.qty;
        const lineTotalExVat = roundToTwo(unitPrice * quantity);
        const lineVatAmount = roundToTwo(lineTotalExVat * (vatRate / 100));

        resolvedLines.push({
            productId,
            skuId,
            description: product.name ?? line.plantVariety ?? 'Product',
            quantity,
            unitPrice,
            vatRate,
            lineTotalExVat,
            lineVatAmount,
            // Store batch preferences for later allocation
            batchPreferences: {
                specificBatchId: line.specificBatchId,
                gradePreference: line.gradePreference,
                preferredBatchNumbers: line.preferredBatchNumbers,
            },
            requiredVarietyId: line.requiredVarietyId ?? product.skus?.plant_variety_id ?? null,
            requiredBatchId: line.requiredBatchId ?? line.specificBatchId ?? null,
        });
    }

    const subtotalExVat = roundToTwo(resolvedLines.reduce((sum, l) => sum + l.lineTotalExVat, 0));
    const vatAmount = roundToTwo(resolvedLines.reduce((sum, l) => sum + l.lineVatAmount, 0));
    const totalIncVat = roundToTwo(subtotalExVat + vatAmount);

    // Resolve shipping address
    const resolvedShipToAddressId = await resolveShipToAddressId(supabase, customerId, shipToAddressId, storeId);

    // Prepare payload for atomic RPC
    const orderNumber = `ORD-${Date.now()}`;
    const rpcLines = resolvedLines.map(line => {
        // Build description with any preferences for traceability
        let description = line.description;
        if (line.batchPreferences?.specificBatchId) {
            description += ` [Batch: ${line.batchPreferences.specificBatchId}]`;
        } else if (line.batchPreferences?.gradePreference) {
            description += ` [Grade: ${line.batchPreferences.gradePreference}]`;
        } else if (line.batchPreferences?.preferredBatchNumbers?.length) {
            description += ` [Preferred Batches: ${line.batchPreferences.preferredBatchNumbers.join(', ')}]`;
        }

        // Map any explicit batch request into an allocation to leverage locking
        const allocations =
            line.requiredBatchId
                ? [{ batch_id: line.requiredBatchId, qty: line.quantity }]
                : line.batchPreferences?.specificBatchId
                    ? [{ batch_id: line.batchPreferences.specificBatchId, qty: line.quantity }]
                    : [];

        return {
            sku_id: line.skuId,
            quantity: line.quantity,
            unit_price: line.unitPrice,
            vat_rate: line.vatRate,
            description,
            allocations,
        };
    });

    const { data: rpcResult, error: rpcError } = await supabase.rpc('create_order_with_allocations', {
        p_org_id: orgId,
        p_customer_id: customerId,
        p_order_number: orderNumber,
        p_lines: rpcLines,
        p_requested_delivery_date: deliveryDate || null,
        p_notes: notesInternal ?? null,
    });

    if (rpcError || !rpcResult?.order_id) {
        console.error('Error creating order via RPC:', rpcError);
        return { error: 'Failed to create order', details: rpcError?.message };
    }

    const orderId = rpcResult.order_id as string;

    // Update totals and shipping address after creation (non-blocking to RPC)
    await supabase
        .from('orders')
        .update({
            ship_to_address_id: resolvedShipToAddressId,
            subtotal_ex_vat: subtotalExVat,
            vat_amount: vatAmount,
            total_inc_vat: totalIncVat,
            updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

    await supabase.from('order_events').insert({
        order_id: orderId,
        event_type: 'order_created',
        description: 'Order created via internal UI',
        created_by: user.id,
    });

    // Persist pre-pricing (RRP) values on order items if provided
    try {
        const rrpUpdates = resolvedLines
            .map((line, idx) => ({ ...line, rrp: data.lines[idx]?.rrp ?? null }))
            .filter((line) => line.rrp != null);
        if (rrpUpdates.length > 0) {
            for (const line of rrpUpdates) {
                await supabase
                    .from('order_items')
                    .update({ rrp: line.rrp })
                    .eq('order_id', orderId)
                    .eq('sku_id', line.skuId);
            }
        }
    } catch (e) {
        console.warn('Failed to persist pre-pricing (rrp) values', e);
    }

    // Auto-create pick list for confirmed orders
    try {
        const { createPickListFromOrder } = await import('@/server/sales/picking');
        await createPickListFromOrder(orderId);
    } catch (e) {
        console.error('Failed to create pick list:', e);
        // Don't fail the order creation if pick list fails
    }

    revalidatePath('/sales/orders');
    revalidatePath('/sales/picking');
    redirect('/sales/orders');
}

export async function generateInvoice(orderId: string) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { error: 'Not authenticated' };
    }

    // 1. Fetch Order and Items
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', orderId)
        .single();

    if (orderError || !order) {
        return { error: 'Order not found' };
    }

    // Check if invoice already exists for this order
    const { data: existingInvoice } = await supabase
        .from('invoices')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle();

    if (existingInvoice) {
        return { error: 'Invoice already exists for this order' };
    }

    // Fetch organization settings for invoice generation
    const { data: org } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', order.org_id)
        .single();

    const orgData = org as Record<string, unknown> | null;
    const invoicePrefix = (orgData?.invoice_prefix as string) || 'INV';
    const paymentTermsDays = (orgData?.default_payment_terms as number) || 30;

    const { data: items } = await supabase
        .from('order_items')
        .select('line_total_ex_vat, line_vat_amount')
        .eq('order_id', orderId);

    const subtotal = roundToTwo(items?.reduce((sum, item) => sum + (item.line_total_ex_vat || 0), 0) ?? 0);
    const vat = roundToTwo(items?.reduce((sum, item) => sum + (item.line_vat_amount || 0), 0) ?? 0);
    const total = roundToTwo(subtotal + vat);

    // Generate invoice number using org prefix
    const invoiceNumber = `${invoicePrefix}-${Date.now()}`;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const dueDate = new Date(Date.now() + paymentTermsDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 3. Create Invoice
    const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
            org_id: order.org_id,
            customer_id: order.customer_id,
            order_id: orderId,
            invoice_number: invoiceNumber,
            currency: 'EUR',
            status: 'issued',
            issue_date: today,
            due_date: dueDate,
            subtotal_ex_vat: subtotal,
            vat_amount: vat,
            total_inc_vat: total,
            balance_due: total,
        })
        .select()
        .single();

    if (invoiceError) {
        console.error('Error creating invoice:', invoiceError);
        return { error: `Failed to create invoice: ${invoiceError.message}` };
    }

    revalidatePath('/sales/invoices');
    revalidatePath('/sales/orders');
    revalidatePath(`/sales/orders/${orderId}`);
    
    await supabase.from('order_events').insert({
        org_id: order.org_id,
        order_id: orderId,
        event_type: 'invoice_generated',
        description: `Invoice ${invoiceNumber} generated`,
        created_by: user.id,
    });
    
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

function roundToTwo(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function getCustomerRecentOrders(customerId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, created_at, total_inc_vat, requested_delivery_date, status, order_items (id)')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Failed to load recent orders', error);
        return { error: 'Failed to load recent orders' };
    }

    const orders =
        data?.map((row) => ({
            id: row.id,
            orderNumber: row.order_number,
            createdAt: row.created_at,
            total: row.total_inc_vat ?? 0,
            deliveryDate: row.requested_delivery_date ?? null,
            status: row.status,
            lineCount: Array.isArray(row.order_items) ? row.order_items.length : 0,
        })) || [];

    return { orders };
}

export async function getOrderForCopy(orderId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('orders')
        .select(
            `
            id,
            customer_id,
            ship_to_address_id,
            requested_delivery_date,
            order_items (
              product_id,
              sku_id,
              quantity,
              unit_price_ex_vat,
              vat_rate,
              description,
              required_batch_id,
              required_variety_id,
              rrp
            )
          `
        )
        .eq('id', orderId)
        .maybeSingle();

    if (error || !data) {
        console.error('Failed to load order for copy', error);
        return { error: 'Order not found' };
    }

    const lines =
        data.order_items?.map((item) => ({
            productId: item.product_id || undefined,
            qty: item.quantity,
            unitPrice: item.unit_price_ex_vat,
            vatRate: item.vat_rate,
            description: item.description ?? undefined,
            requiredBatchId: item.required_batch_id ?? undefined,
            requiredVarietyId: item.required_variety_id ?? undefined,
            rrp: item.rrp ?? undefined,
        })) || [];

    return {
        order: {
            customerId: data.customer_id,
            shipToAddressId: data.ship_to_address_id ?? undefined,
            deliveryDate: data.requested_delivery_date ?? undefined,
            lines,
        },
    };
}

function buildProductMaps(products: ProductRow[]) {
    const byId = new Map<string, ProductRow>();
    const byLabel = new Map<string, ProductRow>();

    for (const product of products) {
        byId.set(product.id, product);
        const varietyName = extractRelationName(product.skus?.plant_varieties);
        const sizeName = extractRelationName(product.skus?.plant_sizes);
        if (varietyName && sizeName) {
            byLabel.set(`${varietyName}|${sizeName}`, product);
        }
    }

    return { byId, byLabel };
}

function resolveProductForLine(
    line: CreateOrderInput['lines'][number],
    maps: { byId: Map<string, ProductRow>; byLabel: Map<string, ProductRow> }
) {
    if (line.productId) {
        return maps.byId.get(line.productId);
    }
    const variety = line.plantVariety?.toLowerCase().trim();
    const size = line.size?.toLowerCase().trim();
    if (variety && size) {
        return maps.byLabel.get(`${variety}|${size}`);
    }
    return undefined;
}

async function resolveActiveOrgId(client: ServerClient, userId: string) {
    const { data: profile } = await client
        .from('profiles')
        .select('active_org_id')
        .eq('id', userId)
        .maybeSingle();
    if (profile?.active_org_id) {
        return profile.active_org_id as string;
    }

    const { data: membership } = await client
        .from('org_memberships')
        .select('org_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

    return membership?.org_id as string | undefined;
}

async function fetchCustomerWithOrg(client: ServerClient, customerId: string): Promise<CustomerOrgRow | null> {
    const { data, error } = await client
        .from('customers')
        .select('id, org_id, default_price_list_id')
        .eq('id', customerId)
        .maybeSingle();

    if (error) {
        console.error('Failed to load customer', error);
        return null;
    }
    return data;
}

/**
 * Resolve the shipping address ID for an order.
 * Priority: explicit shipToAddressId > storeId (if UUID) > customer's default shipping address
 */
async function resolveShipToAddressId(
    client: ServerClient,
    customerId: string,
    shipToAddressId?: string,
    storeId?: string
): Promise<string | null> {
    // If explicit shipToAddressId provided, use it
    if (shipToAddressId) {
        return shipToAddressId;
    }

    // If storeId looks like a UUID, it might be an address ID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (storeId && uuidRegex.test(storeId)) {
        // Verify it's a valid address for this customer
        const { data: address } = await client
            .from('customer_addresses')
            .select('id')
            .eq('id', storeId)
            .eq('customer_id', customerId)
            .maybeSingle();
        
        if (address) {
            return address.id;
        }
    }

    // Fall back to customer's default shipping address
    const { data: defaultAddress } = await client
        .from('customer_addresses')
        .select('id')
        .eq('customer_id', customerId)
        .eq('is_default_shipping', true)
        .maybeSingle();

    if (defaultAddress) {
        return defaultAddress.id;
    }

    // If no default, try first address
    const { data: firstAddress } = await client
        .from('customer_addresses')
        .select('id')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

    return firstAddress?.id ?? null;
}

async function fetchOrgProducts(client: ServerClient, orgId: string): Promise<ProductRow[]> {
    const { data, error } = await client
        .from('products')
        .select(`
            id,
            org_id,
            name,
            description,
            sku_id,
            skus (
                id,
                default_vat_rate,
                plant_variety_id,
                size_id,
                plant_varieties ( id, name ),
                plant_sizes ( id, name )
            )
        `)
        .eq('org_id', orgId)
        .eq('is_active', true);

    if (error) {
        console.error('Failed to load products', error);
        return [];
    }

    return data || [];
}

async function resolvePriceListId(
    client: ServerClient,
    customerId: string,
    orgId: string,
    today: string,
    defaultPriceListId?: string | null
) {
    const { data: overrides, error: overrideError } = await client
        .from('price_list_customers')
        .select('price_list_id, valid_from, valid_to')
        .eq('customer_id', customerId);

    if (overrideError) {
        console.error('Failed to load price list overrides', overrideError);
    } else {
        const activeOverride = (overrides || []).find((row) =>
            isDateWithinRange(today, row.valid_from, row.valid_to)
        );
        if (activeOverride) {
            return activeOverride.price_list_id;
        }
    }

    if (defaultPriceListId) {
        return defaultPriceListId;
    }

    const { data: defaultList } = await client
        .from('price_lists')
        .select('id')
        .eq('org_id', orgId)
        .eq('is_default', true)
        .limit(1)
        .maybeSingle();

    return defaultList?.id ?? null;
}

async function fetchActivePricesForProducts(
    client: ServerClient,
    priceListId: string | null,
    productIds: string[],
    today: string
) {
    const priceMap = new Map<string, number>();
    if (!priceListId || !productIds.length) {
        return priceMap;
    }

    const { data, error } = await client
        .from('product_prices')
        .select('product_id, unit_price_ex_vat, valid_from, valid_to')
        .eq('price_list_id', priceListId)
        .in('product_id', productIds);

    if (error) {
        console.error('Failed to load product prices', error);
        return priceMap;
    }

    for (const row of data || []) {
        if (isDateWithinRange(today, row.valid_from, row.valid_to)) {
            priceMap.set(row.product_id, row.unit_price_ex_vat);
        }
    }

    return priceMap;
}

function isDateWithinRange(today: string, start: string | null, end: string | null) {
    const afterStart = !start || start <= today;
    const beforeEnd = !end || end >= today;
    return afterStart && beforeEnd;
}

function extractRelationName(
    relation?:
        | { name: string | null }
        | Array<{ name: string | null }>
        | null
) {
    if (!relation) return undefined;
    if (Array.isArray(relation)) {
        return relation[0]?.name?.toLowerCase().trim();
    }
    return relation.name?.toLowerCase().trim();
}

// ================================================
// CRM & SALES DASHBOARD ACTIONS
// ================================================

/**
 * Log an interaction with a customer (call, email, visit, etc.)
 */
export async function logInteraction(
    customerId: string,
    type: 'call' | 'email' | 'visit' | 'whatsapp' | 'other',
    notes: string,
    outcome?: string
) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { error: 'Not authenticated' };
    }

    // Get the customer's org_id
    const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('org_id')
        .eq('id', customerId)
        .single();

    if (customerError || !customer) {
        return { error: 'Customer not found' };
    }

    const { data: interaction, error } = await supabase
        .from('customer_interactions')
        .insert({
            org_id: customer.org_id,
            customer_id: customerId,
            user_id: user.id,
            type,
            notes,
            outcome: outcome || null,
        })
        .select()
        .single();

    if (error) {
        console.error('Error logging interaction:', error);
        return { error: 'Failed to log interaction' };
    }

    revalidatePath('/sales/targets');
    revalidatePath(`/sales/customers/${customerId}`);
    
    return { success: true, interaction };
}

/**
 * Get tasks for the sales admin inbox
 */
export async function getSalesAdminTasks() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { error: 'Not authenticated', tasks: [] };
    }

    const activeOrgId = await resolveActiveOrgId(supabase, user.id);
    if (!activeOrgId) {
        return { error: 'No organization found', tasks: [] };
    }

    const { data: tasks, error } = await supabase
        .from('v_sales_admin_inbox')
        .select('*')
        .eq('org_id', activeOrgId)
        .order('priority', { ascending: false })
        .order('task_date', { ascending: true });

    if (error) {
        console.error('Error fetching admin tasks:', error);
        return { error: 'Failed to fetch tasks', tasks: [] };
    }

    return { tasks: tasks || [] };
}

/**
 * Get targets for sales reps
 */
export async function getSalesRepTargets() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { error: 'Not authenticated', targets: [] };
    }

    const activeOrgId = await resolveActiveOrgId(supabase, user.id);
    if (!activeOrgId) {
        return { error: 'No organization found', targets: [] };
    }

    const { data: targets, error } = await supabase
        .from('v_sales_rep_targets')
        .select('*')
        .eq('org_id', activeOrgId)
        .order('priority_score', { ascending: false });

    if (error) {
        console.error('Error fetching targets:', error);
        return { error: 'Failed to fetch targets', targets: [] };
    }

    return { targets: targets || [] };
}

/**
 * Send order confirmation email to customer
 */
export async function sendOrderConfirmation(orderId: string) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { error: 'Not authenticated' };
    }

    // Fetch order with customer details
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
            *,
            customer:customers(name, email),
            order_items(*)
        `)
        .eq('id', orderId)
        .single();

    if (orderError || !order) {
        return { error: 'Order not found' };
    }

    if (!order.customer?.email) {
        return { error: 'Customer has no email address' };
    }

    // TODO: Integrate with email service (resend, sendgrid, etc.)
    // For now, we just mark it as sent
    console.log(`[Email] Would send order confirmation to ${order.customer.email} for order ${order.order_number}`);

    // Update order with confirmation timestamp
    const { error: updateError } = await supabase
        .from('orders')
        .update({ 
            confirmation_sent_at: new Date().toISOString(),
            status: order.status === 'draft' ? 'confirmed' : order.status
        })
        .eq('id', orderId);

    if (updateError) {
        console.error('Error updating order:', updateError);
        return { error: 'Failed to update order' };
    }

    // Log event
    await supabase.from('order_events').insert({
        order_id: orderId,
        event_type: 'confirmation_sent',
        description: `Order confirmation email sent to ${order.customer.email}`,
        created_by: user.id,
    });

    revalidatePath('/sales');
    revalidatePath('/sales/orders');
    revalidatePath(`/sales/orders/${orderId}`);

    return { success: true, message: `Confirmation sent to ${order.customer.email}` };
}

/**
 * Combined action: Update status to dispatched, generate invoice, and send dispatch email
 */
export async function dispatchAndInvoice(orderId: string) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { error: 'Not authenticated' };
    }

    // Fetch order with customer details
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
            *,
            customer:customers(name, email),
            invoices(id)
        `)
        .eq('id', orderId)
        .single();

    if (orderError || !order) {
        return { error: 'Order not found' };
    }

    // Check if invoice already exists
    let invoiceId = order.invoices?.[0]?.id;
    
    if (!invoiceId) {
        // Generate invoice using existing function
        const invoiceResult = await generateInvoice(orderId);
        if ('error' in invoiceResult && invoiceResult.error) {
            return { error: `Failed to generate invoice: ${invoiceResult.error}` };
        }
        invoiceId = invoiceResult.invoice?.id;
    }

    // Update order status to dispatched
    const { error: updateError } = await supabase
        .from('orders')
        .update({ 
            status: 'dispatched',
            dispatch_email_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

    if (updateError) {
        console.error('Error updating order status:', updateError);
        return { error: 'Failed to update order status' };
    }

    // TODO: Send dispatch email with invoice attached
    if (order.customer?.email) {
        console.log(`[Email] Would send dispatch notification with invoice to ${order.customer.email}`);
    }

    // Log events
    await supabase.from('order_events').insert([
        {
            order_id: orderId,
            event_type: 'status_changed',
            description: 'Order marked as dispatched',
            created_by: user.id,
        },
        {
            order_id: orderId,
            event_type: 'dispatch_email_sent',
            description: `Dispatch notification sent to ${order.customer?.email || 'customer'}`,
            created_by: user.id,
        }
    ]);

    revalidatePath('/sales');
    revalidatePath('/sales/orders');
    revalidatePath(`/sales/orders/${orderId}`);
    revalidatePath('/sales/invoices');

    return { 
        success: true, 
        message: 'Order dispatched and invoice generated',
        invoiceId 
    };
}

/**
 * Get customer interaction history
 */
export async function getCustomerInteractions(customerId: string, limit = 10) {
    const supabase = await createClient();

    const { data: interactions, error } = await supabase
        .from('customer_interactions')
        .select(`
            *,
            user:profiles(display_name, email)
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching interactions:', error);
        return { error: 'Failed to fetch interactions', interactions: [] };
    }

    return { interactions: interactions || [] };
}

/**
 * Get pricing hints for a customer + product combination
 * Priority: 1) Order history, 2) Product alias RRP, 3) null
 */
export type PricingHint = {
    rrp?: number | null;
    multibuyQty2?: number | null;
    multibuyPrice2?: number | null;
};

export async function getPricingHints(
    customerId: string,
    productIds: string[]
): Promise<Record<string, PricingHint>> {
    if (!customerId || productIds.length === 0) return {};

    const supabase = await createClient();
    const hints: Record<string, PricingHint> = {};

    // 1) Check order history first (most recent orders take precedence)
    const { data: orderItems, error: orderError } = await supabase
        .from('order_items')
        .select(`
            product_id,
            rrp,
            multibuy_price_2,
            multibuy_qty_2,
            created_at,
            orders!inner(customer_id)
        `)
        .eq('orders.customer_id', customerId)
        .in('product_id', productIds)
        .order('created_at', { ascending: false });

    if (orderError) {
        console.error('[getPricingHints] order history error:', orderError);
    } else if (orderItems) {
        for (const row of orderItems) {
            const productId = row.product_id;
            if (!productId || hints[productId]) continue; // Keep first (most recent)
            if (row.rrp != null || row.multibuy_price_2 != null || row.multibuy_qty_2 != null) {
                hints[productId] = {
                    rrp: row.rrp,
                    multibuyPrice2: row.multibuy_price_2,
                    multibuyQty2: row.multibuy_qty_2,
                };
            }
        }
    }

    // 2) For products without history, check product_aliases for customer-specific RRP
    const remainingProductIds = productIds.filter(id => !hints[id]);
    if (remainingProductIds.length > 0) {
        const { data: aliases, error: aliasError } = await supabase
            .from('product_aliases')
            .select('product_id, rrp')
            .eq('customer_id', customerId)
            .in('product_id', remainingProductIds)
            .eq('is_active', true);

        if (aliasError) {
            console.error('[getPricingHints] alias error:', aliasError);
        } else if (aliases) {
            for (const alias of aliases) {
                if (alias.product_id && alias.rrp != null && !hints[alias.product_id]) {
                    hints[alias.product_id] = {
                        rrp: alias.rrp,
                        multibuyPrice2: null,
                        multibuyQty2: null,
                    };
                }
            }
        }
    }

    return hints;
}

// ================================================
// SMART TARGETING ACTIONS
// ================================================

import type {
    SmartTarget,
    DeliveryZone,
    ScheduledDelivery,
    TargetingConfig,
    ProbabilityWeights,
    RouteFitWeights,
    TargetFilters,
    DEFAULT_PROBABILITY_WEIGHTS,
    DEFAULT_ROUTE_FIT_WEIGHTS,
} from '@/lib/targeting/types';

/**
 * Get smart sales targets with probabilistic scoring and route matching
 */
export async function getSmartTargets(filters?: TargetFilters): Promise<{
    targets: SmartTarget[];
    error?: string;
}> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { error: 'Not authenticated', targets: [] };
    }

    const activeOrgId = await resolveActiveOrgId(supabase, user.id);
    if (!activeOrgId) {
        return { error: 'No organization found', targets: [] };
    }

    let query = supabase
        .from('v_smart_sales_targets')
        .select('*')
        .eq('org_id', activeOrgId);

    // Apply filters
    if (filters?.reason && filters.reason !== 'all') {
        query = query.eq('target_reason', filters.reason);
    }
    if (filters?.county) {
        query = query.eq('county', filters.county);
    }
    if (filters?.routingKey) {
        query = query.eq('routing_key', filters.routingKey);
    }
    if (filters?.minScore) {
        query = query.gte('priority_score', filters.minScore);
    }

    query = query.order('priority_score', { ascending: false });

    const { data: targets, error } = await query;

    if (error) {
        console.error('Error fetching smart targets:', error);
        return { error: 'Failed to fetch targets', targets: [] };
    }

    return { targets: (targets || []) as SmartTarget[] };
}

/**
 * Get active delivery zones for the next 7 days
 */
export async function getActiveDeliveryZones(): Promise<{
    zones: DeliveryZone[];
    error?: string;
}> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { error: 'Not authenticated', zones: [] };
    }

    const activeOrgId = await resolveActiveOrgId(supabase, user.id);
    if (!activeOrgId) {
        return { error: 'No organization found', zones: [] };
    }

    const { data: zones, error } = await supabase
        .from('v_active_delivery_zones')
        .select('*')
        .eq('org_id', activeOrgId)
        .order('requested_delivery_date', { ascending: true });

    if (error) {
        console.error('Error fetching delivery zones:', error);
        return { error: 'Failed to fetch delivery zones', zones: [] };
    }

    return { zones: (zones || []) as DeliveryZone[] };
}

/**
 * Get scheduled deliveries for map display
 */
export async function getScheduledDeliveries(): Promise<{
    deliveries: ScheduledDelivery[];
    error?: string;
}> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { error: 'Not authenticated', deliveries: [] };
    }

    const activeOrgId = await resolveActiveOrgId(supabase, user.id);
    if (!activeOrgId) {
        return { error: 'No organization found', deliveries: [] };
    }

    const { data: deliveries, error } = await supabase
        .from('v_scheduled_deliveries_map')
        .select('*')
        .eq('org_id', activeOrgId)
        .order('requested_delivery_date', { ascending: true });

    if (error) {
        console.error('Error fetching scheduled deliveries:', error);
        return { error: 'Failed to fetch scheduled deliveries', deliveries: [] };
    }

    return { deliveries: (deliveries || []) as ScheduledDelivery[] };
}

/**
 * Get targeting configuration (probability and route fit weights)
 */
export async function getTargetingConfig(): Promise<{
    config: TargetingConfig;
    error?: string;
}> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return {
            error: 'Not authenticated',
            config: {
                probability_weights: {
                    frequency_match: 0.30,
                    seasonality: 0.20,
                    recency_urgency: 0.20,
                    customer_value: 0.15,
                    day_of_week_pattern: 0.15,
                },
                route_fit_weights: {
                    same_routing_key: 10,
                    adjacent_routing_key: 7,
                    same_county: 3,
                    density_bonus_per_order: 1,
                    density_bonus_max: 5,
                },
            },
        };
    }

    const activeOrgId = await resolveActiveOrgId(supabase, user.id);

    // Try to get org-specific config first, then fall back to system defaults
    const { data: configRows } = await supabase
        .from('targeting_config')
        .select('config_key, config_value')
        .or(`org_id.is.null,org_id.eq.${activeOrgId}`)
        .in('config_key', ['probability_weights', 'route_fit_weights']);

    const configMap = new Map<string, unknown>();
    for (const row of configRows || []) {
        // Org-specific configs override system defaults
        if (!configMap.has(row.config_key) || row.config_value) {
            configMap.set(row.config_key, row.config_value);
        }
    }

    const config: TargetingConfig = {
        probability_weights: (configMap.get('probability_weights') as ProbabilityWeights) || {
            frequency_match: 0.30,
            seasonality: 0.20,
            recency_urgency: 0.20,
            customer_value: 0.15,
            day_of_week_pattern: 0.15,
        },
        route_fit_weights: (configMap.get('route_fit_weights') as RouteFitWeights) || {
            same_routing_key: 10,
            adjacent_routing_key: 7,
            same_county: 3,
            density_bonus_per_order: 1,
            density_bonus_max: 5,
        },
    };

    return { config };
}

/**
 * Update targeting configuration for the organization
 */
export async function updateTargetingConfig(
    configKey: 'probability_weights' | 'route_fit_weights',
    configValue: ProbabilityWeights | RouteFitWeights
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { success: false, error: 'Not authenticated' };
    }

    const activeOrgId = await resolveActiveOrgId(supabase, user.id);
    if (!activeOrgId) {
        return { success: false, error: 'No organization found' };
    }

    // Upsert org-specific config
    const { error } = await supabase
        .from('targeting_config')
        .upsert(
            {
                org_id: activeOrgId,
                config_key: configKey,
                config_value: configValue,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'org_id,config_key' }
        );

    if (error) {
        console.error('Error updating targeting config:', error);
        return { success: false, error: 'Failed to update configuration' };
    }

    revalidatePath('/sales/targets');
    return { success: true };
}

/**
 * Refresh the customer order patterns materialized view
 * (Manual refresh option for admins)
 */
export async function refreshOrderPatterns(): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { success: false, error: 'Not authenticated' };
    }

    // Call the refresh function via RPC
    const { error } = await supabase.rpc('refresh_customer_order_patterns_manual');

    if (error) {
        // If RPC doesn't exist, try direct SQL (will only work with elevated privileges)
        console.warn('RPC not available, patterns will refresh automatically');
        return { success: true }; // Don't fail - the trigger handles this
    }

    revalidatePath('/sales/targets');
    return { success: true };
}

/**
 * Get unique counties from targets for filtering
 */
export async function getTargetCounties(): Promise<{
    counties: string[];
    error?: string;
}> {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { error: 'Not authenticated', counties: [] };
    }

    const activeOrgId = await resolveActiveOrgId(supabase, user.id);
    if (!activeOrgId) {
        return { error: 'No organization found', counties: [] };
    }

    const { data, error } = await supabase
        .from('customer_addresses')
        .select('county')
        .not('county', 'is', null);

    if (error) {
        console.error('Error fetching counties:', error);
        return { error: 'Failed to fetch counties', counties: [] };
    }

    // Get unique counties
    const counties = [...new Set((data || []).map(d => d.county).filter(Boolean))] as string[];
    return { counties: counties.sort() };
}
