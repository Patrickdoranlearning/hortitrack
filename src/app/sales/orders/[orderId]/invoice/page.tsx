import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import PrintableInvoiceClient from './PrintableInvoiceClient';

interface InvoicePageProps {
  params: Promise<{ orderId: string }>;
}

interface InvoiceItem {
  id: string;
  description: string | null;
  quantity: number;
  unit_price_ex_vat: number;
  vat_rate: number;
  line_total_ex_vat: number;
  line_vat_amount: number;
  sku_id: string | null;
  product_id: string | null;
  required_variety_id: string | null;
}

interface InvoiceWithDetails {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  subtotal_ex_vat: number;
  vat_amount: number;
  total_inc_vat: number;
  balance_due: number;
  notes: string | null;
  org_id: string;
  order: {
    id: string;
    order_number: string;
    requested_delivery_date: string | null;
    notes: string | null;
    ship_to_address_id: string | null;
    customer_id: string | null;
    currency: string | null;
    customer: {
      name: string;
      email: string | null;
      phone: string | null;
      vat_number: string | null;
    } | null;
    order_items: InvoiceItem[];
  } | null;
}

export default async function PrintableInvoicePage({ params }: InvoicePageProps) {
  const { orderId } = await params;
  const supabase = await createClient();

  // Get invoice for this order
  const { data: invoice, error } = await supabase
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
      org_id,
      order:orders(
        id,
        order_number,
        requested_delivery_date,
        notes,
        ship_to_address_id,
        customer_id,
        currency,
        customer:customers(
          name,
          email,
          phone,
          vat_number
        ),
        order_items(
          id,
          description,
          quantity,
          unit_price_ex_vat,
          vat_rate,
          line_total_ex_vat,
          line_vat_amount,
          sku_id,
          product_id,
          required_variety_id
        )
      )
    `)
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !invoice) {
    notFound();
  }

  // Fetch organization details for the invoice
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', invoice.org_id)
    .single();

  // Fetch customer address
  let customerAddress: { address_line1: string | null; address_line2: string | null; city: string | null; county: string | null; eircode: string | null } | null = null;
  const orderData = invoice.order as any;
  if (orderData?.ship_to_address_id) {
    const { data: addr } = await supabase
      .from('customer_addresses')
      .select('address_line1, address_line2, city, county, eircode')
      .eq('id', orderData.ship_to_address_id)
      .maybeSingle();
    customerAddress = addr;
  } else if (orderData?.customer_id) {
    const { data: addr } = await supabase
      .from('customer_addresses')
      .select('address_line1, address_line2, city, county, eircode')
      .eq('customer_id', orderData.customer_id)
      .eq('is_default_shipping', true)
      .maybeSingle();
    customerAddress = addr;
  }

  const typedInvoice = invoice as unknown as InvoiceWithDetails;
  const customer = typedInvoice.order?.customer;
  const items = typedInvoice.order?.order_items || [];

  // Fetch SKU details with variety, size, and family for each item
  const skuIds = items.map(item => item.sku_id).filter(Boolean) as string[];
  let skuDetailsMap: Record<string, { 
    varietyName: string | null; 
    sizeName: string | null; 
    familyName: string | null;
    code: string | null;
  }> = {};

  if (skuIds.length > 0) {
    const { data: skus } = await supabase
      .from('skus')
      .select(`
        id,
        code,
        plant_varieties(
          name,
          plant_families(name)
        ),
        plant_sizes(name)
      `)
      .in('id', skuIds);

    if (skus) {
      skuDetailsMap = skus.reduce((acc, sku: any) => {
        acc[sku.id] = {
          varietyName: sku.plant_varieties?.name || null,
          sizeName: sku.plant_sizes?.name || null,
          familyName: sku.plant_varieties?.plant_families?.name || null,
          code: sku.code || null,
        };
        return acc;
      }, {} as Record<string, { varietyName: string | null; sizeName: string | null; familyName: string | null; code: string | null }>);
    }
  }

  // Fetch required variety names for items with specific variety requests
  const reqVarietyIds = items.map(item => (item as any).required_variety_id).filter(Boolean) as string[];
  let reqVarietyNameMap: Record<string, string> = {};
  if (reqVarietyIds.length > 0) {
    const { data: varieties } = await supabase
      .from('plant_varieties')
      .select('id, name')
      .in('id', reqVarietyIds);
    if (varieties) {
      reqVarietyNameMap = varieties.reduce((acc: Record<string, string>, v: { id: string; name: string }) => {
        acc[v.id] = v.name;
        return acc;
      }, {});
    }
  }

  // Fetch product names for items with product_id
  const productIds = items.map(item => (item as any).product_id).filter(Boolean) as string[];
  let productNameMap: Record<string, string> = {};
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('id, name')
      .in('id', productIds);
    if (products) {
      productNameMap = products.reduce((acc: Record<string, string>, p: { id: string; name: string }) => {
        acc[p.id] = p.name;
        return acc;
      }, {});
    }
  }

  // Fetch pick items to get batch information for each order item
  const orderItemIds = items.map(item => item.id);
  let batchMap: Record<string, string | null> = {};

  if (orderItemIds.length > 0) {
    const { data: pickItems } = await supabase
      .from('pick_items')
      .select(`
        order_item_id,
        picked_batch:picked_batch_id(batch_number)
      `)
      .in('order_item_id', orderItemIds);

    if (pickItems) {
      batchMap = pickItems.reduce((acc, pi: any) => {
        if (pi.order_item_id && pi.picked_batch?.batch_number) {
          acc[pi.order_item_id] = pi.picked_batch.batch_number;
        }
        return acc;
      }, {} as Record<string, string | null>);
    }
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

  // Fetch order fees (pre-pricing, delivery, etc.)
  const { data: orderFees } = await supabase
    .from('order_fees')
    .select('*')
    .eq('order_id', orderId);

  // Group items by VAT rate for summary
  const vatSummary = items.reduce((acc, item) => {
    const rate = item.vat_rate;
    if (!acc[rate]) {
      acc[rate] = { rate, total: 0, vat: 0 };
    }
    acc[rate].total += item.line_total_ex_vat;
    acc[rate].vat += item.line_vat_amount;
    return acc;
  }, {} as Record<number, { rate: number; total: number; vat: number }>);

  // Include fee VAT in the summary
  if (orderFees) {
    for (const fee of orderFees) {
      if (fee.subtotal > 0 && fee.vat_rate) {
        const rate = fee.vat_rate;
        if (!vatSummary[rate]) {
          vatSummary[rate] = { rate, total: 0, vat: 0 };
        }
        vatSummary[rate].total += fee.subtotal;
        vatSummary[rate].vat += fee.vat_amount || 0;
      }
    }
  }

  // Prepare organization data with defaults
  const orgData = org as Record<string, unknown> | null;
  const companyInfo = {
    name: orgData?.name as string || 'Your Company',
    address: orgData?.address as string || '',
    email: orgData?.email as string || '',
    phone: orgData?.phone as string || '',
    website: orgData?.website as string || '',
    vatNumber: orgData?.vat_number as string || '',
    companyRegNumber: orgData?.company_reg_number as string || '',
    logoUrl: orgData?.logo_url as string || null,
  };

  const bankInfo = {
    bankName: orgData?.bank_name as string || '',
    bankIban: orgData?.bank_iban as string || '',
    bankBic: orgData?.bank_bic as string || '',
  };

  const invoiceSettings = {
    footerText: orgData?.invoice_footer_text as string || '',
  };

  // Prepare data for client component with enhanced item details
  const invoiceData = {
    invoiceNumber: typedInvoice.invoice_number,
    status: typedInvoice.status,
    issueDate: format(new Date(typedInvoice.issue_date), 'PPP'),
    dueDate: typedInvoice.due_date ? format(new Date(typedInvoice.due_date), 'PPP') : 'On Receipt',
    orderNumber: typedInvoice.order?.order_number || '-',
    currency: (typedInvoice.order as any)?.currency || 'EUR',
    subtotalExVat: typedInvoice.subtotal_ex_vat,
    vatAmount: typedInvoice.vat_amount,
    totalIncVat: typedInvoice.total_inc_vat,
    balanceDue: typedInvoice.balance_due,
    notes: typedInvoice.notes || typedInvoice.order?.notes || null,
    customer: {
      name: customer?.name || 'Unknown Customer',
      address: formatAddress(),
      phone: customer?.phone || null,
      email: customer?.email || null,
      vatNumber: customer?.vat_number || null,
    },
    items: items.map(item => {
      const skuDetails = item.sku_id ? skuDetailsMap[item.sku_id] : null;
      const batchNumber = batchMap[item.id] || null;
      const reqVarId = (item as any).required_variety_id as string | null;
      const prodId = (item as any).product_id as string | null;
      const requiredVarietyName = reqVarId ? reqVarietyNameMap[reqVarId] || null : null;
      const productName = prodId ? productNameMap[prodId] || null : null;

      // Build description: product name or description as primary
      const description = productName || item.description || 'Product';

      return {
        id: item.id,
        description,
        quantity: item.quantity,
        unitPrice: item.unit_price_ex_vat,
        vatRate: item.vat_rate,
        total: item.line_total_ex_vat,
        // Enhanced fields
        varietyName: skuDetails?.varietyName || null,
        sizeName: skuDetails?.sizeName || null,
        familyName: skuDetails?.familyName || null,
        batchNumber: batchNumber,
        skuCode: skuDetails?.code || null,
        requiredVarietyName,
        productName,
      };
    }),
    fees: (orderFees || []).map(fee => ({
      id: fee.id,
      name: fee.name,
      feeType: fee.fee_type,
      quantity: fee.quantity || 1,
      unitAmount: fee.unit_amount,
      subtotal: fee.subtotal,
      vatRate: fee.vat_rate || 0,
      vatAmount: fee.vat_amount || 0,
      totalAmount: fee.total_amount,
    })),
    vatSummary: Object.values(vatSummary),
    company: companyInfo,
    bank: bankInfo,
    invoiceSettings: invoiceSettings,
  };

  return <PrintableInvoiceClient invoice={invoiceData} />;
}
