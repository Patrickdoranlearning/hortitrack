import { requireCustomerAuth } from '@/lib/auth/b2b-guard';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { B2BPrintableInvoiceClient } from './B2BPrintableInvoiceClient';

interface PageProps {
  params: Promise<{ invoiceId: string }>;
}

export default async function B2BInvoiceDetailPage({ params }: PageProps) {
  const { invoiceId } = await params;
  const authContext = await requireCustomerAuth();
  const supabase = await createClient();

  // Fetch invoice with order details
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select(`
      id,
      invoice_number,
      status,
      issue_date,
      due_date,
      subtotal_ex_vat,
      vat_amount,
      total_inc_vat,
      balance_due,
      notes,
      order_id,
      org_id
    `)
    .eq('id', invoiceId)
    .eq('customer_id', authContext.customerId)
    .single();

  if (invoiceError || !invoice) {
    notFound();
  }

  // Fetch order with items
  let orderData: any = null;
  let orderItems: any[] = [];
  let customerAddress: any = null;

  if (invoice.order_id) {
    const { data: order } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        subtotal_ex_vat,
        vat_amount,
        total_inc_vat,
        requested_delivery_date,
        notes,
        created_at,
        ship_to_address_id
      `)
      .eq('id', invoice.order_id)
      .single();

    if (order) {
      orderData = order;

      // Fetch order items with SKU details
      const { data: items } = await supabase
        .from('order_items')
        .select(`
          id,
          description,
          quantity,
          unit_price_ex_vat,
          vat_rate,
          line_total_ex_vat,
          line_vat_amount,
          rrp,
          sku_id
        `)
        .eq('order_id', invoice.order_id)
        .order('created_at');

      orderItems = items || [];

      // Fetch customer address
      if (order.ship_to_address_id) {
        const { data: addr } = await supabase
          .from('customer_addresses')
          .select('label, store_name, line1, line2, city, county, eircode')
          .eq('id', order.ship_to_address_id)
          .single();
        customerAddress = addr;
      }
    }
  }

  // Get default address if no ship_to_address
  if (!customerAddress) {
    const { data: addr } = await supabase
      .from('customer_addresses')
      .select('label, store_name, line1, line2, city, county, eircode')
      .eq('customer_id', authContext.customerId)
      .eq('is_default', true)
      .maybeSingle();
    customerAddress = addr;
  }

  // Fetch organization details
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', invoice.org_id)
    .single();

  // Determine if this is an order confirmation or invoice
  const isOrderConfirmation = invoice.status === 'draft' || !invoice.invoice_number;

  // Format address
  const formatAddress = () => {
    if (!customerAddress) return 'No address on file';
    const parts = [
      customerAddress.store_name,
      customerAddress.line1,
      customerAddress.line2,
      customerAddress.city,
      customerAddress.county,
      customerAddress.eircode,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'No address on file';
  };

  // Group items by VAT rate for summary
  const vatSummary = orderItems.reduce((acc, item) => {
    const rate = item.vat_rate || 0;
    if (!acc[rate]) {
      acc[rate] = { rate, total: 0, vat: 0 };
    }
    acc[rate].total += item.line_total_ex_vat || 0;
    acc[rate].vat += item.line_vat_amount || 0;
    return acc;
  }, {} as Record<number, { rate: number; total: number; vat: number }>);

  // Prepare organization data with defaults
  const orgData = org as Record<string, unknown> | null;
  const companyInfo = {
    name: (orgData?.name as string) || 'Your Supplier',
    address: (orgData?.address as string) || '',
    email: (orgData?.email as string) || '',
    phone: (orgData?.phone as string) || '',
    website: (orgData?.website as string) || '',
    vatNumber: (orgData?.vat_number as string) || '',
    companyRegNumber: (orgData?.company_reg_number as string) || '',
    logoUrl: (orgData?.logo_url as string) || null,
  };

  const bankInfo = {
    bankName: (orgData?.bank_name as string) || '',
    bankIban: (orgData?.bank_iban as string) || '',
    bankBic: (orgData?.bank_bic as string) || '',
  };

  // Prepare document data
  const documentData = {
    isOrderConfirmation,
    documentNumber: isOrderConfirmation
      ? orderData?.order_number || `ORD-${invoice.id.slice(0, 8)}`
      : invoice.invoice_number,
    status: invoice.status,
    issueDate: invoice.issue_date
      ? format(new Date(invoice.issue_date), 'PPP')
      : format(new Date(), 'PPP'),
    dueDate: invoice.due_date ? format(new Date(invoice.due_date), 'PPP') : 'On Receipt',
    orderNumber: orderData?.order_number || '-',
    orderDate: orderData?.created_at
      ? format(new Date(orderData.created_at), 'PPP')
      : null,
    requestedDeliveryDate: orderData?.requested_delivery_date
      ? format(new Date(orderData.requested_delivery_date), 'PPP')
      : 'TBC',
    subtotalExVat: invoice.subtotal_ex_vat || orderData?.subtotal_ex_vat || 0,
    vatAmount: invoice.vat_amount || orderData?.vat_amount || 0,
    totalIncVat: invoice.total_inc_vat || orderData?.total_inc_vat || 0,
    balanceDue: invoice.balance_due || 0,
    notes: invoice.notes || orderData?.notes || null,
    customer: {
      name: authContext.customer.name,
      address: formatAddress(),
      phone: authContext.customer.phone || null,
      email: authContext.customer.email || null,
    },
    items: orderItems.map((item) => ({
      id: item.id,
      description: item.description || 'Product',
      quantity: item.quantity,
      unitPrice: item.unit_price_ex_vat,
      vatRate: item.vat_rate || 0,
      total: item.line_total_ex_vat,
      rrp: item.rrp,
    })),
    vatSummary: Object.values(vatSummary),
    company: companyInfo,
    bank: bankInfo,
  };

  return <B2BPrintableInvoiceClient document={documentData} />;
}
