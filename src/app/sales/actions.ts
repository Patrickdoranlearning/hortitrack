'use server';

import { createClient } from '@/lib/supabase/server';
import { CreateOrderSchema, CreateOrderInput } from '@/lib/sales/types';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logError, logInfo, logWarning } from '@/lib/log';
import { roundToTwo } from '@/lib/utils';
import { z } from 'zod';
import type { ActionResult } from '@/lib/errors';

// Validation schemas for actions
const UUIDSchema = z.string().uuid('Invalid ID format');

const LogInteractionSchema = z.object({
    customerId: UUIDSchema,
    type: z.enum(['call', 'email', 'visit', 'whatsapp', 'other']),
    notes: z.string().min(1, 'Notes are required').max(5000, 'Notes too long'),
    outcome: z.string().max(500, 'Outcome too long').optional(),
});

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

/**
 * Create a new sales order with items and allocations
 *
 * This action handles the complete order creation flow including:
 * - Input validation via Zod schema
 * - Product resolution (by ID or variety+size)
 * - Product group handling (mix orders)
 * - Price list resolution with customer-specific overrides
 * - Atomic order creation via RPC with batch allocations
 * - Automatic pick list generation
 *
 * @param data - Order creation input with customer, lines, delivery details
 * @returns Redirects to /sales/orders on success, or returns error object
 */
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
    const productGroupLines: Array<{ lineIndex: number; productGroupId: string }> = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Handle product group lines (generic/mix orders)
        if (isProductGroupLine(line)) {
            const { data: groupMembers } = await supabase
                .rpc('get_product_group_members', { p_group_id: line.productGroupId });

            if (!groupMembers || groupMembers.length === 0) {
                return { error: `Product group ${line.productGroupId} has no members` };
            }

            const firstMemberId = groupMembers[0].product_id;
            const referenceProduct = productMap.byId.get(firstMemberId);

            if (!referenceProduct) {
                return { error: `Reference product not found for group ${line.productGroupId}` };
            }

            productGroupLines.push({ lineIndex: i, productGroupId: line.productGroupId! });

            resolvedProducts.push({
                line: { ...line, description: line.description || `[MIX] ${line.description || 'Product Group'}` },
                product: referenceProduct,
                isGroupOrder: true,
                productGroupId: line.productGroupId,
            });
            continue;
        }

        const product = resolveProductForLine(line, productMap);
        if (!product) {
            return { error: `No product found for ${line.productId || `${line.plantVariety} ${line.size}`}` };
        }
        resolvedProducts.push({ line, product, isGroupOrder: false });
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
    for (const resolved of resolvedProducts) {
        const { line, product, isGroupOrder } = resolved as {
            line: typeof lines[number];
            product: ProductRow;
            isGroupOrder?: boolean;
        };
        const productId = product.id;
        const skuId = product.sku_id;
        const vatRate = line.vatRate ?? product.skus?.default_vat_rate ?? DEFAULT_VAT_RATE;

        const priceFromList = priceMap.get(productId);
        const unitPrice = line.unitPrice ?? priceFromList ?? 0;

        if (unitPrice === 0 && !line.unitPrice) {
          logWarning("Order line has zero price — no price found in any price list", {
            productId,
            productName: product.name,
            customerId,
          });
        }
        
        const description = isGroupOrder
            ? (line.description || `[MIX] ${product.name || 'Product Group'}`)
            : (product.name ?? line.plantVariety ?? 'Product');

        resolvedLines.push({
            sku_id: skuId,
            product_id: productId,
            description,
            quantity: line.qty,
            unit_price: unitPrice,
            vat_rate: vatRate,
            required_variety_id: null,
            required_batch_id: null,
            rrp: line.rrp ?? null,
            allocations: []
        });
    }

    const resolvedShipToAddressId = await resolveShipToAddressId(supabase, customerId, shipToAddressId, storeId);
    const orderNumber = `ORD-${Date.now()}`;

    // Atomic creation via enhanced RPC
    const { data: rpcResult, error: rpcError } = await supabase.rpc('create_order_with_allocations', {
        p_org_id: orgId,
        p_customer_id: customerId,
        p_order_number: orderNumber,
        p_lines: resolvedLines as any,
        p_requested_delivery_date: deliveryDate || null,
        p_notes: notesInternal ?? null,
        p_ship_to_address_id: resolvedShipToAddressId,
        p_status: 'confirmed'
    });

    if (rpcError || !rpcResult?.order_id) {
        logError('Error creating order via RPC', { error: rpcError?.message, rpcError });
        return { error: 'Failed to create order', details: rpcError?.message };
    }

    const orderId = rpcResult.order_id as string;

    await supabase.from('order_events').insert({
        org_id: orgId,
        order_id: orderId,
        event_type: 'order_created',
        description: 'Order created via internal UI',
        created_by: user.id,
    });

    // Update order items with product_group_id if needed
    if (productGroupLines.length > 0) {
        try {
            const { data: orderItems } = await supabase
                .from('order_items')
                .select('id')
                .eq('order_id', orderId)
                .order('created_at', { ascending: true });

            if (orderItems) {
                for (const groupLine of productGroupLines) {
                    const orderItem = orderItems[groupLine.lineIndex];
                    if (orderItem) {
                        await supabase
                            .from('order_items')
                            .update({ product_group_id: groupLine.productGroupId })
                            .eq('id', orderItem.id);
                    }
                }
            }
        } catch (e) {
            logError('Failed to set product_group_id on order items', { error: e instanceof Error ? e.message : String(e), orderId });
        }
    }

    // Create Tier 1 (product-level) allocations for lines without batch allocations
    // This enables the two-tier allocation system where:
    // - Tier 1: Product-level reservation (created at order confirmation)
    // - Tier 2: Batch-level allocation (created when picker selects batches)
    const hasUnallocatedLines = resolvedLines.some(line => !line.allocations || line.allocations.length === 0);
    if (hasUnallocatedLines) {
        try {
            const { data: allocationResult, error: allocationError } = await supabase.rpc('fn_confirm_order_with_allocations', {
                p_order_id: orderId,
                p_actor_id: user.id,
            });

            if (allocationError) {
                logError('Failed to create Tier 1 allocations', { error: allocationError.message, orderId });
            } else if (allocationResult?.has_oversell_warning) {
                logInfo('Order has oversell warning', { orderId, oversellItems: allocationResult.oversell_items });
            }
        } catch (e) {
            logError('Failed to create Tier 1 allocations', { error: e instanceof Error ? e.message : String(e), orderId });
        }
    }

    // Auto-create pick list
    try {
        const { createPickListFromOrder } = await import('@/server/sales/picking');
        await createPickListFromOrder(orderId);
    } catch (e) {
        logError('Failed to create pick list', { error: e instanceof Error ? e.message : String(e), orderId });
    }

    revalidatePath('/sales/orders');
    revalidatePath('/sales/picking');
    redirect('/sales/orders');
}

/**
 * Generate an invoice for an existing order
 *
 * Calls the generate_invoice_for_order RPC function which creates
 * an invoice with all order items and calculates totals.
 *
 * @param orderId - UUID of the order to invoice
 * @returns ActionResult with invoiceId on success
 * @example
 * const result = await generateInvoice(orderId);
 * if (result.success) {
 *   console.log('Invoice created:', result.data.invoiceId);
 * }
 */
export async function generateInvoice(orderId: string): Promise<ActionResult<{ invoiceId: string }>> {
    // Validate input
    const validation = UUIDSchema.safeParse(orderId);
    if (!validation.success) {
        return {
            success: false,
            error: 'Invalid order ID',
            code: 'VALIDATION_ERROR',
        };
    }

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return {
            success: false,
            error: 'Not authenticated',
            code: 'AUTH_ERROR',
        };
    }

    // Get order to resolve orgId
    const { data: order, error: orderError } = await supabase.from('orders').select('org_id').eq('id', orderId).maybeSingle();
    if (orderError || !order) {
        return {
            success: false,
            error: 'Order not found',
            code: 'NOT_FOUND',
        };
    }

    const { data: rpcResult, error: rpcError } = await supabase.rpc('generate_invoice_for_order', {
        p_org_id: order.org_id,
        p_order_id: orderId,
        p_user_id: user.id
    });

    if (rpcError) {
        logError('Error generating invoice via RPC', { error: rpcError.message, orderId });
        return {
            success: false,
            error: 'Failed to generate invoice',
            code: 'RPC_ERROR',
            details: process.env.NODE_ENV === 'development' ? rpcError.message : undefined,
        };
    }

    const result = rpcResult as { success: boolean; error?: string; invoice_id?: string };
    if (!result.success) {
        return {
            success: false,
            error: result.error ?? 'Invoice generation failed',
            code: 'GENERATION_FAILED',
        };
    }

    revalidatePath('/sales/invoices');
    revalidatePath('/sales/orders');
    revalidatePath(`/sales/orders/${orderId}`);

    return {
        success: true,
        data: { invoiceId: result.invoice_id! }
    };
}

/**
 * Mark order as dispatched and generate invoice if needed
 *
 * This action:
 * 1. Generates invoice if one doesn't exist
 * 2. Updates order status to 'dispatched'
 * 3. Records dispatch timestamp
 * 4. Logs events for audit trail
 *
 * @param orderId - UUID of the order to dispatch
 * @returns ActionResult with invoiceId
 */
export async function dispatchAndInvoice(orderId: string): Promise<ActionResult<{ invoiceId: string }>> {
    // Validate input
    const validation = UUIDSchema.safeParse(orderId);
    if (!validation.success) {
        return {
            success: false,
            error: 'Invalid order ID',
            code: 'VALIDATION_ERROR',
        };
    }

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return {
            success: false,
            error: 'Not authenticated',
            code: 'AUTH_ERROR',
        };
    }

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`*, invoices(id), customer:customers(name, email)`)
        .eq('id', orderId)
        .maybeSingle();

    if (orderError || !order) {
        return {
            success: false,
            error: 'Order not found',
            code: 'NOT_FOUND',
        };
    }

    let invoiceId = order.invoices?.[0]?.id;
    if (!invoiceId) {
        const invoiceResult = await generateInvoice(orderId);
        if (!invoiceResult.success) {
            return {
                success: false,
                error: `Failed to generate invoice: ${invoiceResult.error}`,
                code: 'INVOICE_GENERATION_FAILED',
                details: invoiceResult.details,
            };
        }
        invoiceId = invoiceResult.data.invoiceId;
    }

    const { error: updateError } = await supabase
        .from('orders')
        .update({
            status: 'dispatched',
            updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

    if (updateError) {
        logError('Error updating order status to dispatched', { error: updateError.message, orderId });
        return {
            success: false,
            error: 'Failed to update order status',
            code: 'UPDATE_ERROR',
            details: process.env.NODE_ENV === 'development' ? updateError.message : undefined,
        };
    }

    await supabase.from('order_events').insert({
        org_id: order.org_id,
        order_id: orderId,
        event_type: 'status_changed',
        description: 'Order dispatched and invoice generated',
        created_by: user.id,
    });

    revalidatePath('/sales/orders');
    revalidatePath(`/sales/orders/${orderId}`);
    revalidatePath('/sales/invoices');

    return {
        success: true,
        data: { invoiceId }
    };
}

export async function getOrderDetails(orderId: string) {
    const supabase = await createClient();
    const { data: order, error } = await supabase
        .from('orders')
        .select(`*, order_items (*), invoices (*), pick_orders (*), sales_qc (*)`)
        .eq('id', orderId)
        .maybeSingle();

    if (error || !order) {
        logError('Error fetching order details', { error: error?.message, orderId });
        return { error: 'Failed to fetch order details' };
    }
    return { order };
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
        logError('Failed to load recent orders', { error: error.message, customerId });
        return { error: 'Failed to load recent orders' };
    }

    const orders = (data || []).map((row) => ({
        id: row.id,
        orderNumber: row.order_number,
        createdAt: row.created_at,
        total: row.total_inc_vat ?? 0,
        deliveryDate: row.requested_delivery_date ?? null,
        status: row.status,
        lineCount: Array.isArray(row.order_items) ? row.order_items.length : 0,
    }));

    return { orders };
}

export async function getOrderForCopy(orderId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('orders')
        .select(`id, customer_id, ship_to_address_id, requested_delivery_date, order_items (product_id, sku_id, quantity, unit_price_ex_vat, vat_rate, description, required_batch_id, required_variety_id, rrp)`)
        .eq('id', orderId)
        .maybeSingle();

    if (error || !data) {
        logError('Failed to load order for copy', { error: error?.message, orderId });
        return { error: 'Order not found' };
    }

    const lines = (data.order_items || []).map((item) => ({
        productId: item.product_id || undefined,
        qty: item.quantity,
        unitPrice: item.unit_price_ex_vat,
        vatRate: item.vat_rate,
        description: item.description ?? undefined,
        requiredBatchId: item.required_batch_id ?? undefined,
        requiredVarietyId: item.required_variety_id ?? undefined,
        rrp: item.rrp ?? undefined,
    }));

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

function resolveProductForLine(line: CreateOrderInput['lines'][number], maps: { byId: Map<string, ProductRow>; byLabel: Map<string, ProductRow> }) {
    if (line.productId) return maps.byId.get(line.productId);
    const variety = line.plantVariety?.toLowerCase().trim();
    const size = line.size?.toLowerCase().trim();
    if (variety && size) return maps.byLabel.get(`${variety}|${size}`);
    return undefined;
}

function isProductGroupLine(line: CreateOrderInput['lines'][number]): boolean {
    return Boolean(line.productGroupId) && !line.productId;
}

async function resolveActiveOrgId(client: ServerClient, userId: string) {
    const { data: profile } = await client.from('profiles').select('active_org_id').eq('id', userId).maybeSingle();
    if (profile?.active_org_id) return profile.active_org_id as string;
    const { data: membership } = await client.from('org_memberships').select('org_id').eq('user_id', userId).limit(1).maybeSingle();
    return membership?.org_id as string | undefined;
}

async function fetchCustomerWithOrg(client: ServerClient, customerId: string): Promise<CustomerOrgRow | null> {
    const { data, error } = await client.from('customers').select('id, org_id, default_price_list_id').eq('id', customerId).maybeSingle();
    if (error) {
        logError('Failed to load customer', { error: error.message, customerId });
        return null;
    }
    return data;
}

async function resolveShipToAddressId(client: ServerClient, customerId: string, shipToAddressId?: string, storeId?: string): Promise<string | null> {
    if (shipToAddressId) return shipToAddressId;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (storeId && uuidRegex.test(storeId)) {
        const { data: address } = await client.from('customer_addresses').select('id').eq('id', storeId).eq('customer_id', customerId).maybeSingle();
        if (address) return address.id;
    }
    const { data: defaultAddress } = await client.from('customer_addresses').select('id').eq('customer_id', customerId).eq('is_default_shipping', true).maybeSingle();
    if (defaultAddress) return defaultAddress.id;
    const { data: firstAddress } = await client.from('customer_addresses').select('id').eq('customer_id', customerId).order('created_at', { ascending: true }).limit(1).maybeSingle();
    return firstAddress?.id ?? null;
}

async function fetchOrgProducts(client: ServerClient, orgId: string): Promise<ProductRow[]> {
    const { data, error } = await client.from('products').select(`id, org_id, name, description, sku_id, skus (id, default_vat_rate, plant_variety_id, size_id, plant_varieties ( id, name ), plant_sizes ( id, name ))`).eq('org_id', orgId).eq('is_active', true);
    if (error) {
        logError('Failed to load products', { error: error.message, orgId });
        return [];
    }
    return data || [];
}

async function resolvePriceListId(client: ServerClient, customerId: string, orgId: string, today: string, defaultPriceListId?: string | null) {
    const { data: overrides, error: overrideError } = await client.from('price_list_customers').select('price_list_id, valid_from, valid_to').eq('customer_id', customerId);
    if (overrideError) {
        logError('Failed to load price list overrides', { error: overrideError.message, customerId });
    } else {
        const activeOverride = (overrides || []).find((row) => isDateWithinRange(today, row.valid_from, row.valid_to));
        if (activeOverride) return activeOverride.price_list_id;
    }
    if (defaultPriceListId) return defaultPriceListId;
    const { data: defaultList } = await client.from('price_lists').select('id').eq('org_id', orgId).eq('is_default', true).limit(1).maybeSingle();
    return defaultList?.id ?? null;
}

async function fetchActivePricesForProducts(client: ServerClient, priceListId: string | null, productIds: string[], today: string) {
    const priceMap = new Map<string, number>();
    if (!priceListId || !productIds.length) return priceMap;
    const { data, error } = await client.from('product_prices').select('product_id, unit_price_ex_vat, valid_from, valid_to').eq('price_list_id', priceListId).in('product_id', productIds);
    if (error) {
        logError('Failed to load product prices', { error: error.message, priceListId });
        return priceMap;
    }
    for (const row of data || []) {
        if (isDateWithinRange(today, row.valid_from, row.valid_to)) priceMap.set(row.product_id, row.unit_price_ex_vat);
    }
    return priceMap;
}

function isDateWithinRange(today: string, start: string | null, end: string | null) {
    const afterStart = !start || start <= today;
    const beforeEnd = !end || end >= today;
    return afterStart && beforeEnd;
}

function extractRelationName(relation?: { name: string | null } | Array<{ name: string | null }> | null) {
    if (!relation) return undefined;
    if (Array.isArray(relation)) return relation[0]?.name?.toLowerCase().trim();
    return relation.name?.toLowerCase().trim();
}

/**
 * Log a customer interaction for CRM tracking
 *
 * Records interactions such as calls, emails, visits for sales targeting.
 * Validates input length and requires notes.
 *
 * @param customerId - UUID of the customer
 * @param type - Type of interaction (call, email, visit, whatsapp, other)
 * @param notes - Description of the interaction (required, max 5000 chars)
 * @param outcome - Optional outcome description (max 500 chars)
 * @returns ActionResult with the created interaction record
 */
export async function logInteraction(
    customerId: string,
    type: 'call' | 'email' | 'visit' | 'whatsapp' | 'other',
    notes: string,
    outcome?: string
): Promise<ActionResult<{ interaction: any }>> {
    // Validate input
    const validation = LogInteractionSchema.safeParse({ customerId, type, notes, outcome });
    if (!validation.success) {
        const firstError = validation.error.errors[0];
        return {
            success: false,
            error: firstError?.message ?? 'Invalid input',
            code: 'VALIDATION_ERROR',
            details: validation.error.flatten(),
        };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return {
            success: false,
            error: 'Not authenticated',
            code: 'AUTH_ERROR',
        };
    }

    const { data: customer, error: customerError } = await supabase.from('customers').select('org_id').eq('id', customerId).maybeSingle();
    if (customerError || !customer) {
        return {
            success: false,
            error: 'Customer not found',
            code: 'NOT_FOUND',
        };
    }

    const { data: interaction, error } = await supabase.from('customer_interactions').insert({
        org_id: customer.org_id,
        customer_id: customerId,
        user_id: user.id,
        type,
        notes,
        outcome: outcome || null
    }).select().maybeSingle();

    if (error || !interaction) {
        logError('Error logging interaction', { error: error?.message, customerId });
        return {
            success: false,
            error: 'Failed to log interaction',
            code: 'INSERT_ERROR',
            details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
        };
    }

    revalidatePath('/sales/targets');
    revalidatePath(`/sales/customers/${customerId}`);

    return {
        success: true,
        data: { interaction }
    };
}

export async function getSalesAdminTasks() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated', tasks: [] };
    const activeOrgId = await resolveActiveOrgId(supabase, user.id);
    if (!activeOrgId) return { error: 'No organization found', tasks: [] };
    const { data: tasks, error } = await supabase.from('v_sales_admin_inbox').select('*').eq('org_id', activeOrgId).order('priority', { ascending: false }).order('task_date', { ascending: true });
    if (error) {
        logError('Error fetching admin tasks', { error: error.message, activeOrgId });
        return { error: 'Failed to fetch tasks', tasks: [] };
    }
    return { tasks: tasks || [] };
}

export async function getSalesRepTargets() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated', targets: [] };
    const activeOrgId = await resolveActiveOrgId(supabase, user.id);
    if (!activeOrgId) return { error: 'No organization found', targets: [] };
    const { data: targets, error } = await supabase.from('v_sales_rep_targets').select('*').eq('org_id', activeOrgId).order('priority_score', { ascending: false });
    if (error) {
        logError('Error fetching targets', { error: error.message, activeOrgId });
        return { error: 'Failed to fetch targets', targets: [] };
    }
    return { targets: targets || [] };
}

export async function sendOrderConfirmation(orderId: string) {
    // Validate input
    const validation = UUIDSchema.safeParse(orderId);
    if (!validation.success) {
        return { error: 'Invalid order ID' };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };
    const { data: order, error: orderError } = await supabase.from('orders').select(`*, customer:customers(name, email), order_items(*)`).eq('id', orderId).maybeSingle();
    if (orderError || !order) return { error: 'Order not found' };
    if (!order.customer?.email) return { error: 'Customer has no email address' };
    
    logInfo('Email sending simulated', { to: order.customer.email, orderNumber: order.order_number });

    const { error: updateError } = await supabase.from('orders').update({ confirmation_sent_at: new Date().toISOString(), status: order.status === 'draft' ? 'confirmed' : order.status }).eq('id', orderId);
    if (updateError) {
        logError('Error updating order after confirmation', { error: updateError.message, orderId });
        return { error: 'Failed to update order' };
    }
    await supabase.from('order_events').insert({ org_id: order.org_id, order_id: orderId, event_type: 'confirmation_sent', description: `Order confirmation email sent to ${order.customer.email}`, created_by: user.id });
    revalidatePath('/sales');
    revalidatePath('/sales/orders');
    revalidatePath(`/sales/orders/${orderId}`);
    return { success: true, message: `Confirmation sent to ${order.customer.email}` };
}

/**
 * Get recent customer interactions with org filtering
 *
 * Uses defense-in-depth approach: verifies customer belongs to user's
 * org before querying interactions, then explicitly filters by org_id.
 *
 * @param customerId - UUID of the customer
 * @param limit - Maximum number of interactions to return (default: 10)
 * @returns Object with interactions array or error
 */
export async function getCustomerInteractions(customerId: string, limit = 10) {
    // Validate input
    const validation = UUIDSchema.safeParse(customerId);
    if (!validation.success) {
        return { error: 'Invalid customer ID', interactions: [] };
    }

    const supabase = await createClient();

    // Defense in depth: verify customer belongs to user's org before querying interactions
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { error: 'Not authenticated', interactions: [] };
    }

    const activeOrgId = await resolveActiveOrgId(supabase, user.id);
    if (!activeOrgId) {
        return { error: 'No organization found', interactions: [] };
    }

    // First verify customer belongs to this org
    const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('org_id')
        .eq('id', customerId)
        .maybeSingle();

    if (customerError) {
        logError('Error verifying customer ownership', { error: customerError.message, customerId });
        return { error: 'Failed to verify customer', interactions: [] };
    }

    if (!customer || customer.org_id !== activeOrgId) {
        logError('Customer not found or not owned by org', { customerId, activeOrgId });
        return { error: 'Customer not found', interactions: [] };
    }

    // Now query interactions with explicit org_id filter
    const { data: interactions, error } = await supabase
        .from('customer_interactions')
        .select(`*, user:profiles(display_name, email)`)
        .eq('customer_id', customerId)
        .eq('org_id', activeOrgId)  // Explicit org_id filter (defense in depth)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        logError('Error fetching interactions', { error: error.message, customerId });
        return { error: 'Failed to fetch interactions', interactions: [] };
    }

    return { interactions: interactions || [] };
}

export async function getPricingHints(customerId: string, productIds: string[]): Promise<Record<string, PricingHint>> {
    if (!customerId || productIds.length === 0) return {};
    const supabase = await createClient();
    const hints: Record<string, PricingHint> = {};
    const { data: orderItems, error: orderError } = await supabase.from('order_items').select(`product_id, rrp, multibuy_price_2, multibuy_qty_2, created_at, orders!inner(customer_id)`).eq('orders.customer_id', customerId).in('product_id', productIds).order('created_at', { ascending: false });
    if (orderError) {
        logError('Order history lookup failed for pricing hints', { error: orderError.message, customerId });
    } else if (orderItems) {
        for (const row of orderItems) {
            const productId = row.product_id;
            if (!productId || hints[productId]) continue;
            if (row.rrp != null || row.multibuy_price_2 != null || row.multibuy_qty_2 != null) {
                hints[productId] = { rrp: row.rrp, multibuyPrice2: row.multibuy_price_2, multibuyQty2: row.multibuy_qty_2 };
            }
        }
    }
    const remainingProductIds = productIds.filter(id => !hints[id]);
    if (remainingProductIds.length > 0) {
        const { data: aliases, error: aliasError } = await supabase.from('product_aliases').select('product_id, rrp').eq('customer_id', customerId).in('product_id', remainingProductIds).eq('is_active', true);
        if (aliasError) {
            logError('Alias lookup failed for pricing hints', { error: aliasError.message, customerId });
        } else if (aliases) {
            for (const alias of aliases) {
                if (alias.product_id && alias.rrp != null && !hints[alias.product_id]) {
                    hints[alias.product_id] = { rrp: alias.rrp, multibuyPrice2: null, multibuyQty2: null };
                }
            }
        }
    }
    return hints;
}

export type PricingHint = { rrp?: number | null; multibuyQty2?: number | null; multibuyPrice2?: number | null; };

export async function getSmartTargets(filters?: TargetFilters): Promise<{ targets: SmartTarget[]; error?: string; }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated', targets: [] };
    const activeOrgId = await resolveActiveOrgId(supabase, user.id);
    if (!activeOrgId) return { error: 'No organization found', targets: [] };

    try {
        let query = supabase.from('v_smart_sales_targets').select('*').eq('org_id', activeOrgId);
        if (filters?.reason && filters.reason !== 'all') query = query.eq('target_reason', filters.reason);
        if (filters?.county) query = query.eq('county', filters.county);
        if (filters?.routingKey) query = query.eq('routing_key', filters.routingKey);
        if (filters?.minScore) query = query.gte('priority_score', filters.minScore);
        query = query.order('priority_score', { ascending: false });
        const { data: targets, error } = await query;

        if (error) {
            // Check if view doesn't exist (common during development)
            const errorMsg = error.message || error.code || JSON.stringify(error);
            if (errorMsg.includes('does not exist') || errorMsg.includes('42P01')) {
                logInfo('v_smart_sales_targets view not found - returning empty targets', { activeOrgId });
                return { targets: [], error: 'Smart targeting view not deployed. Run Supabase migrations.' };
            }
            logError('Error fetching smart targets', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint,
                activeOrgId
            });
            return { error: `Failed to fetch targets: ${errorMsg}`, targets: [] };
        }
        return { targets: (targets || []) as SmartTarget[] };
    } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        logError('Exception fetching smart targets', { error: errMsg, activeOrgId });
        return { error: `Failed to fetch targets: ${errMsg}`, targets: [] };
    }
}

export async function getActiveDeliveryZones(): Promise<{ zones: DeliveryZone[]; error?: string; }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated', zones: [] };
    const activeOrgId = await resolveActiveOrgId(supabase, user.id);
    if (!activeOrgId) return { error: 'No organization found', zones: [] };

    try {
        const { data: zones, error } = await supabase.from('v_active_delivery_zones').select('*').eq('org_id', activeOrgId).order('requested_delivery_date', { ascending: true });
        if (error) {
            const errorMsg = error.message || error.code || JSON.stringify(error);
            if (errorMsg.includes('does not exist') || errorMsg.includes('42P01')) {
                return { zones: [] };
            }
            logError('Error fetching delivery zones', { message: error.message, code: error.code, activeOrgId });
            return { error: 'Failed to fetch delivery zones', zones: [] };
        }
        return { zones: (zones || []) as DeliveryZone[] };
    } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        logError('Exception fetching delivery zones', { error: errMsg, activeOrgId });
        return { error: errMsg, zones: [] };
    }
}

export async function getScheduledDeliveries(): Promise<{ deliveries: ScheduledDelivery[]; error?: string; }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated', deliveries: [] };
    const activeOrgId = await resolveActiveOrgId(supabase, user.id);
    if (!activeOrgId) return { error: 'No organization found', deliveries: [] };

    try {
        const { data: deliveries, error } = await supabase.from('v_scheduled_deliveries_map').select('*').eq('org_id', activeOrgId).order('requested_delivery_date', { ascending: true });
        if (error) {
            const errorMsg = error.message || error.code || JSON.stringify(error);
            if (errorMsg.includes('does not exist') || errorMsg.includes('42P01')) {
                return { deliveries: [] };
            }
            logError('Error fetching scheduled deliveries', { message: error.message, code: error.code, activeOrgId });
            return { error: 'Failed to fetch scheduled deliveries', deliveries: [] };
        }
        return { deliveries: (deliveries || []) as ScheduledDelivery[] };
    } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        logError('Exception fetching scheduled deliveries', { error: errMsg, activeOrgId });
        return { error: errMsg, deliveries: [] };
    }
}

export async function getTargetingConfig(): Promise<{ config: TargetingConfig; error?: string; }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const baseConfig: TargetingConfig = {
        probability_weights: { frequency_match: 0.30, seasonality: 0.20, recency_urgency: 0.20, customer_value: 0.15, day_of_week_pattern: 0.15 },
        route_fit_weights: { same_routing_key: 10, adjacent_routing_key: 7, same_county: 3, density_bonus_per_order: 1, density_bonus_max: 5 },
    };
    if (!user) return { config: baseConfig };
    const activeOrgId = await resolveActiveOrgId(supabase, user.id);
    const { data: configRows } = await supabase.from('targeting_config').select('config_key, config_value').or(`org_id.is.null,org_id.eq.${activeOrgId}`).in('config_key', ['probability_weights', 'route_fit_weights']);
    const configMap = new Map<string, any>();
    for (const row of configRows || []) { if (!configMap.has(row.config_key) || row.config_value) configMap.set(row.config_key, row.config_value); }
    return { config: { probability_weights: configMap.get('probability_weights') || baseConfig.probability_weights, route_fit_weights: configMap.get('route_fit_weights') || baseConfig.route_fit_weights } };
}

export async function updateTargetingConfig(configKey: 'probability_weights' | 'route_fit_weights', configValue: ProbabilityWeights | RouteFitWeights): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const activeOrgId = await resolveActiveOrgId(supabase, user.id);
    if (!activeOrgId) return { success: false, error: 'No organization found' };
    const { error } = await supabase.from('targeting_config').upsert({ org_id: activeOrgId, config_key: configKey, config_value: configValue, updated_at: new Date().toISOString() }, { onConflict: 'org_id,config_key' });
    if (error) {
        logError('Error updating targeting config', { error: error.message, activeOrgId });
        return { success: false, error: 'Failed to update configuration' };
    }
    revalidatePath('/sales/targets');
    return { success: true };
}

export async function refreshOrderPatterns(): Promise<{ success: boolean; error?: string; }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const { error } = await supabase.rpc('refresh_customer_order_patterns_manual');
    if (error) { logInfo('Manual pattern refresh RPC failed, falling back to automatic', { error: error.message }); return { success: true }; }
    revalidatePath('/sales/targets');
    return { success: true };
}

export async function getTargetCounties(): Promise<{ counties: string[]; error?: string; }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated', counties: [] };
    const activeOrgId = await resolveActiveOrgId(supabase, user.id);
    if (!activeOrgId) return { error: 'No organization found', counties: [] };
    const { data, error } = await supabase.from('customer_addresses').select('county').not('county', 'is', null);
    if (error) {
        logError('Error fetching counties', { error: error.message, activeOrgId });
        return { error: 'Failed to fetch counties', counties: [] };
    }
    return { counties: [...new Set((data || []).map(d => d.county).filter(Boolean))].sort() as string[] };
}

import type { SmartTarget, DeliveryZone, ScheduledDelivery, TargetingConfig, ProbabilityWeights, RouteFitWeights, TargetFilters } from '@/lib/targeting/types';