
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
        plant_varieties?:
            | { name: string | null }
            | Array<{ name: string | null }>
            | null;
        plant_sizes?:
            | { name: string | null }
            | Array<{ name: string | null }>
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

    const { customerId, lines, deliveryDate, notesInternal, notesCustomer } = result.data;

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
        });
    }

    const subtotalExVat = roundToTwo(resolvedLines.reduce((sum, l) => sum + l.lineTotalExVat, 0));
    const vatAmount = roundToTwo(resolvedLines.reduce((sum, l) => sum + l.lineVatAmount, 0));
    const totalIncVat = roundToTwo(subtotalExVat + vatAmount);

    const nowIso = new Date().toISOString();
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
            org_id: orgId,
            customer_id: customerId,
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

    const orderItemsPayload = resolvedLines.map(line => ({
        order_id: order.id,
        product_id: line.productId,
        sku_id: line.skuId,
        description: line.description,
        quantity: line.quantity,
        unit_price_ex_vat: line.unitPrice,
        vat_rate: line.vatRate,
        discount_pct: 0,
        line_total_ex_vat: line.lineTotalExVat,
        line_vat_amount: line.lineVatAmount,
    }));

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

    const { data: items } = await supabase
        .from('order_items')
        .select('line_total_ex_vat, line_vat_amount')
        .eq('order_id', orderId);

    const subtotal = roundToTwo(items?.reduce((sum, item) => sum + (item.line_total_ex_vat || 0), 0) ?? 0);
    const vat = roundToTwo(items?.reduce((sum, item) => sum + (item.line_vat_amount || 0), 0) ?? 0);
    const total = roundToTwo(subtotal + vat);

    // 3. Create Invoice
    const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
            org_id: order.org_id,
            customer_id: order.customer_id,
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
    await supabase.from('order_events').insert({
        order_id: orderId,
        event_type: 'invoice_generated',
        description: 'Invoice generated from order detail view',
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
                plant_varieties ( name ),
                plant_sizes ( name )
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
