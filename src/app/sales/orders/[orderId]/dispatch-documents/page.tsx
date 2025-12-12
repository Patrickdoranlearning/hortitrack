import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import DispatchDocumentsClient from './DispatchDocumentsClient';

interface DispatchDocumentsPageProps {
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
}

export default async function DispatchDocumentsPage({ params }: DispatchDocumentsPageProps) {
  const { orderId } = await params;
  const supabase = await createClient();

  // Get order with all details
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      status,
      requested_delivery_date,
      notes,
      ship_to_address_id,
      subtotal_ex_vat,
      vat_amount,
      total_inc_vat,
      org_id,
      customer_id,
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
        sku_id
      )
    `)
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    notFound();
  }

  // Get invoice for this order (if exists)
  const { data: invoice } = await supabase
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
      notes
    `)
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch organization details
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', order.org_id)
    .single();

  // Fetch customer address
  let customerAddress: { 
    address_line1: string | null; 
    address_line2: string | null; 
    city: string | null; 
    county: string | null; 
    eircode: string | null 
  } | null = null;

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

  const items = (order.order_items || []) as InvoiceItem[];

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
      skuDetailsMap = skus.reduce((acc, sku: unknown) => {
        const s = sku as { id: string; code: string | null; plant_varieties: { name: string; plant_families: { name: string } | null } | null; plant_sizes: { name: string } | null };
        acc[s.id] = {
          varietyName: s.plant_varieties?.name || null,
          sizeName: s.plant_sizes?.name || null,
          familyName: s.plant_varieties?.plant_families?.name || null,
          code: s.code || null,
        };
        return acc;
      }, {} as Record<string, { varietyName: string | null; sizeName: string | null; familyName: string | null; code: string | null }>);
    }
  }

  // Fetch pick items to get batch information for each order item
  const orderItemIds = items.map(item => item.id);
  let batchMap: Record<string, { batchNumber: string | null; pickedQty: number }> = {};

  if (orderItemIds.length > 0) {
    const { data: pickItems } = await supabase
      .from('pick_items')
      .select(`
        order_item_id,
        picked_qty,
        picked_batch:picked_batch_id(batch_number)
      `)
      .in('order_item_id', orderItemIds);

    if (pickItems) {
      batchMap = pickItems.reduce((acc, pi: unknown) => {
        const p = pi as { order_item_id: string; picked_qty: number; picked_batch: { batch_number: string } | null };
        if (p.order_item_id) {
          acc[p.order_item_id] = {
            batchNumber: p.picked_batch?.batch_number || null,
            pickedQty: p.picked_qty || 0,
          };
        }
        return acc;
      }, {} as Record<string, { batchNumber: string | null; pickedQty: number }>);
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

  const formatAddressMultiline = () => {
    if (!customerAddress) return ['No address on file'];
    return [
      customerAddress.address_line1,
      customerAddress.address_line2,
      customerAddress.city,
      customerAddress.county,
      customerAddress.eircode
    ].filter(Boolean) as string[];
  };

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

  const customer = order.customer as { name: string; email: string | null; phone: string | null; vat_number: string | null } | null;

  // Prepare items data with enhanced details
  const itemsData = items.map(item => {
    const skuDetails = item.sku_id ? skuDetailsMap[item.sku_id] : null;
    const batchInfo = batchMap[item.id] || { batchNumber: null, pickedQty: 0 };
    
    // Build enhanced description: "Variety Name Size" or fall back to original description
    let description = item.description || 'Product';
    if (skuDetails?.varietyName && skuDetails?.sizeName) {
      description = `${skuDetails.varietyName} ${skuDetails.sizeName}`;
    } else if (skuDetails?.varietyName) {
      description = skuDetails.varietyName;
    }

    return {
      id: item.id,
      description,
      quantity: item.quantity,
      pickedQty: batchInfo.pickedQty || item.quantity,
      unitPrice: item.unit_price_ex_vat,
      vatRate: item.vat_rate,
      total: item.line_total_ex_vat,
      varietyName: skuDetails?.varietyName || null,
      sizeName: skuDetails?.sizeName || null,
      familyName: skuDetails?.familyName || null,
      batchNumber: batchInfo.batchNumber,
      skuCode: skuDetails?.code || null,
    };
  });

  // Build dispatch documents data
  const documentsData = {
    order: {
      orderNumber: order.order_number,
      status: order.status,
      requestedDeliveryDate: order.requested_delivery_date 
        ? format(new Date(order.requested_delivery_date), 'PPP') 
        : 'Not specified',
      notes: order.notes,
    },
    invoice: invoice ? {
      invoiceNumber: invoice.invoice_number,
      status: invoice.status,
      issueDate: format(new Date(invoice.issue_date), 'PPP'),
      dueDate: invoice.due_date ? format(new Date(invoice.due_date), 'PPP') : 'On Receipt',
      subtotalExVat: invoice.subtotal_ex_vat,
      vatAmount: invoice.vat_amount,
      totalIncVat: invoice.total_inc_vat,
      balanceDue: invoice.balance_due,
      notes: invoice.notes,
    } : {
      invoiceNumber: 'Pending',
      status: 'pending',
      issueDate: format(new Date(), 'PPP'),
      dueDate: 'On Receipt',
      subtotalExVat: order.subtotal_ex_vat || 0,
      vatAmount: order.vat_amount || 0,
      totalIncVat: order.total_inc_vat || 0,
      balanceDue: order.total_inc_vat || 0,
      notes: null,
    },
    customer: {
      name: customer?.name || 'Unknown Customer',
      address: formatAddress(),
      addressLines: formatAddressMultiline(),
      phone: customer?.phone || null,
      email: customer?.email || null,
      vatNumber: customer?.vat_number || null,
    },
    items: itemsData,
    vatSummary: Object.values(vatSummary),
    company: companyInfo,
    bank: bankInfo,
    invoiceSettings: invoiceSettings,
    generatedAt: format(new Date(), 'PPP HH:mm'),
  };

  return <DispatchDocumentsClient data={documentsData} />;
}

