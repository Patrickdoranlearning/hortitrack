
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

    const nowIso = new Date().toISOString();
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
            org_id: orgId,
            customer_id: customerId,
            ship_to_address_id: resolvedShipToAddressId,
            order_number: `ORD-${Date.now()}`,
            status: 'confirmed',
            subtotal_ex_vat: subtotalExVat,
            vat_amount: vatAmount,
            total_inc_vat: totalIncVat,
            requested_delivery_date: deliveryDate || null,
            notes: notesInternal ?? null,
            created_at: nowIso,
            updated_at: nowIso,
        })
        .select()
        .single();

    if (orderError || !order) {
        console.error('Error creating order:', orderError);
        return { error: 'Failed to create order' };
    }

    const orderItemsPayload = resolvedLines.map(line => {
        // Create description that includes batch preferences if specified
        let description = line.description;
        if (line.batchPreferences?.specificBatchId) {
            description += ` [Batch: ${line.batchPreferences.specificBatchId}]`;
        } else if (line.batchPreferences?.gradePreference) {
            description += ` [Grade: ${line.batchPreferences.gradePreference}]`;
        } else if (line.batchPreferences?.preferredBatchNumbers?.length) {
            description += ` [Preferred Batches: ${line.batchPreferences.preferredBatchNumbers.join(', ')}]`;
        }

        return {
            order_id: order.id,
            product_id: line.productId,
            sku_id: line.skuId,
            description,
            quantity: line.quantity,
            unit_price_ex_vat: line.unitPrice,
            vat_rate: line.vatRate,
            discount_pct: 0,
            line_total_ex_vat: line.lineTotalExVat,
            line_vat_amount: line.lineVatAmount,
            required_variety_id: line.requiredVarietyId,
            required_batch_id: line.requiredBatchId,
        };
    });

    const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsPayload);

    if (itemsError) {
        console.error('Error creating order items:', itemsError);
        return { error: 'Failed to create order items' };
    }

    await supabase.from('order_events').insert({
        order_id: order.id,
        event_type: 'order_created',
        description: 'Order created via internal UI',
        created_by: user.id,
    });

    // Auto-create pick list for confirmed orders
    try {
        const { createPickListFromOrder } = await import('@/server/sales/picking');
        await createPickListFromOrder(order.id);
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
