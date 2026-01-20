import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageFrame } from '@/ui/templates';
import OrderDetailPage from '@/components/sales/OrderDetailPage';
import type { OrderDetails } from '@/components/sales/OrderDetailPage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface OrderDetailServerPageProps {
  params: Promise<{ orderId: string }>;
}

export default async function OrderDetailServerPage({ params }: OrderDetailServerPageProps) {
  const { orderId } = await params;
  const supabase = await createClient();

  // Validate orderId format (should be UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(orderId)) {
    console.error('Invalid order ID format:', orderId);
    notFound();
  }

  // Fetch order - start with simple query that we know works
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      *,
      customer:customers(
        id,
        name,
        email,
        phone,
        vat_number,
        requires_pre_pricing
      )
    `)
    .eq('id', orderId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching order:', error.message, error.code, error.details);
    notFound();
  }

  if (!order) {
    console.error('Order not found:', orderId);
    notFound();
  }

  // Fetch order items separately
  const { data: orderItems } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);

  // Fetch invoices separately
  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('order_id', orderId);

  // Fetch customer address (ship_to or default)
  let customerAddress: { address_line1: string | null; address_line2: string | null; city: string | null; county: string | null; eircode: string | null } | null = null;
  if (order.ship_to_address_id) {
    const { data: addr } = await supabase
      .from('customer_addresses')
      .select('address_line1, address_line2, city, county, eircode')
      .eq('id', order.ship_to_address_id)
      .maybeSingle();
    customerAddress = addr;
  } else if (order.customer_id) {
    // Get default address
    const { data: addr } = await supabase
      .from('customer_addresses')
      .select('address_line1, address_line2, city, county, eircode')
      .eq('customer_id', order.customer_id)
      .eq('is_default_shipping', true)
      .maybeSingle();
    customerAddress = addr;
  }

  // Fetch pick lists separately (may not exist for all orgs)
  const { data: pickLists } = await supabase
    .from('pick_lists')
    .select('id, status, sequence, started_at, completed_at, notes')
    .eq('order_id', orderId);

  // Fetch order events separately (may not exist for all orgs)
  const { data: orderEvents } = await supabase
    .from('order_events')
    .select('id, event_type, description, metadata, created_at, created_by')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  // Fetch SKU details for order items
  const skuIds = (orderItems || [])
    .map((item: { sku_id: string }) => item.sku_id)
    .filter(Boolean);
  
  let skuMap: Record<string, { code: string | null; variety: string | null; size: string | null }> = {};
  if (skuIds.length > 0) {
    const { data: skus } = await supabase
      .from('skus')
      .select('id, code, plant_varieties(name), plant_sizes(name)')
      .in('id', skuIds);
    
    if (skus) {
      skuMap = skus.reduce((acc: Record<string, { code: string | null; variety: string | null; size: string | null }>, sku: any) => {
        acc[sku.id] = {
          code: sku.code,
          variety: sku.plant_varieties?.name || null,
          size: sku.plant_sizes?.name || null,
        };
        return acc;
      }, {});
    }
  }

  // Transform the data to match our types
  const orderDetails: OrderDetails = {
    id: order.id,
    org_id: order.org_id,
    order_number: order.order_number,
    customer_id: order.customer_id,
    ship_to_address_id: order.ship_to_address_id,
    status: order.status,
    payment_status: order.payment_status,
    requested_delivery_date: order.requested_delivery_date,
    notes: order.notes,
    subtotal_ex_vat: order.subtotal_ex_vat,
    vat_amount: order.vat_amount,
    total_inc_vat: order.total_inc_vat,
    trolleys_estimated: order.trolleys_estimated,
    created_at: order.created_at,
    updated_at: order.updated_at,
    customer: order.customer ? {
      id: (order.customer as any).id,
      name: (order.customer as any).name,
      email: (order.customer as any).email,
      phone: (order.customer as any).phone,
      address_line1: customerAddress?.address_line1 || null,
      address_line2: customerAddress?.address_line2 || null,
      city: customerAddress?.city || null,
      county: customerAddress?.county || null,
      eircode: customerAddress?.eircode || null,
      requires_pre_pricing: (order.customer as any).requires_pre_pricing || false,
    } : null,
    order_items: (orderItems || []).map((item: any) => {
      const skuInfo = skuMap[item.sku_id];
      return {
        id: item.id,
        order_id: item.order_id,
        sku_id: item.sku_id,
        product_id: item.product_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price_ex_vat: item.unit_price_ex_vat,
        vat_rate: item.vat_rate,
        discount_pct: item.discount_pct,
        line_total_ex_vat: item.line_total_ex_vat,
        line_vat_amount: item.line_vat_amount,
        rrp: item.rrp || null,
        product: null,
        sku: skuInfo ? {
          code: skuInfo.code,
          plant_varieties: skuInfo.variety ? { name: skuInfo.variety } : null,
          plant_sizes: skuInfo.size ? { name: skuInfo.size } : null,
        } : null,
      };
    }),
    invoices: (invoices || []).map((inv: any) => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      status: inv.status,
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      subtotal_ex_vat: inv.subtotal_ex_vat,
      vat_amount: inv.vat_amount,
      total_inc_vat: inv.total_inc_vat,
      balance_due: inv.balance_due,
    })),
    pick_lists: (pickLists || []).map((pl: any) => ({
      id: pl.id,
      status: pl.status,
      sequence: pl.sequence,
      started_at: pl.started_at,
      completed_at: pl.completed_at,
      notes: pl.notes,
    })),
    order_events: (orderEvents || []).map((evt: any) => ({
      id: evt.id,
      event_type: evt.event_type,
      description: evt.description,
      metadata: evt.metadata,
      created_at: evt.created_at,
      created_by: evt.created_by,
      profile: null, // Profile info not fetched for simplicity
    })),
  };

  return (
    <PageFrame moduleKey="sales">
      <OrderDetailPage order={orderDetails} />
    </PageFrame>
  );
}
