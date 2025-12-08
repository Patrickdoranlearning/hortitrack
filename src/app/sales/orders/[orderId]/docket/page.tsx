import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import PrintableDocketClient from './PrintableDocketClient';

interface DocketPageProps {
  params: Promise<{ orderId: string }>;
}

export default async function DeliveryDocketPage({ params }: DocketPageProps) {
  const { orderId } = await params;
  const supabase = await createClient();

  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      id,
      org_id,
      order_number,
      status,
      subtotal_ex_vat,
      vat_amount,
      total_inc_vat,
      requested_delivery_date,
      notes,
      created_at,
      ship_to_address_id,
      customer_id,
      customer:customers(
        name,
        email,
        phone
      ),
      order_items(
        id,
        description,
        quantity,
        unit_price_ex_vat,
        line_total_ex_vat,
        product:products(name)
      )
    `)
    .eq('id', orderId)
    .single();

  if (error || !order) {
    notFound();
  }

  // Fetch organization details
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', order.org_id)
    .single();

  // Fetch customer address
  let customerAddress: { address_line1: string | null; address_line2: string | null; city: string | null; county: string | null; eircode: string | null } | null = null;
  if (order.ship_to_address_id) {
    const { data: addr } = await supabase
      .from('customer_addresses')
      .select('address_line1, address_line2, city, county, eircode')
      .eq('id', order.ship_to_address_id)
      .maybeSingle();
    customerAddress = addr;
  } else if (order.customer_id) {
    const { data: addr } = await supabase
      .from('customer_addresses')
      .select('address_line1, address_line2, city, county, eircode')
      .eq('customer_id', order.customer_id)
      .eq('is_default_shipping', true)
      .maybeSingle();
    customerAddress = addr;
  }

  const formatAddress = () => {
    if (!customerAddress) return 'No address on file';
    const parts = [
      customerAddress.address_line1,
      customerAddress.address_line2,
      customerAddress.city,
      customerAddress.county,
      customerAddress.eircode
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'No address on file';
  };

  const customer = order.customer as { name: string; email: string | null; phone: string | null } | null;
  const items = (order.order_items || []) as Array<{
    id: string;
    description: string | null;
    quantity: number;
    product: { name: string | null } | null;
  }>;

  // Prepare organization data with defaults
  const orgData = org as Record<string, unknown> | null;
  const companyInfo = {
    name: orgData?.name as string || 'Your Company',
    address: orgData?.address as string || '',
    phone: orgData?.phone as string || '',
    logoUrl: orgData?.logo_url as string || null,
  };

  // Prepare data for client component
  const docketData = {
    orderNumber: order.order_number,
    status: order.status,
    createdAt: format(new Date(order.created_at), 'PPP'),
    deliveryDate: order.requested_delivery_date 
      ? format(new Date(order.requested_delivery_date), 'PPP')
      : null,
    notes: order.notes,
    customer: {
      name: customer?.name || 'Unknown Customer',
      address: formatAddress(),
      phone: customer?.phone || null,
    },
    items: items.map(item => ({
      id: item.id,
      description: item.product?.name || item.description || 'Product',
      quantity: item.quantity,
    })),
    company: companyInfo,
  };

  return <PrintableDocketClient docket={docketData} />;
}
