import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';

interface DocketPageProps {
  params: Promise<{ orderId: string }>;
}

interface OrderItem {
  id: string;
  description: string | null;
  quantity: number;
  unit_price_ex_vat: number;
  line_total_ex_vat: number;
  product?: {
    name: string | null;
  } | null;
}

interface OrderWithDetails {
  id: string;
  order_number: string;
  status: string;
  subtotal_ex_vat: number | null;
  vat_amount: number | null;
  total_inc_vat: number | null;
  requested_delivery_date: string | null;
  notes: string | null;
  created_at: string;
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    county: string | null;
    eircode: string | null;
  } | null;
  order_items: OrderItem[];
}

export default async function DeliveryDocketPage({ params }: DocketPageProps) {
  const { orderId } = await params;
  const supabase = await createClient();

  const { data: order, error } = await supabase
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
      customer:customers(
        name,
        email,
        phone,
        address_line1,
        address_line2,
        city,
        county,
        eircode
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

  const typedOrder = order as unknown as OrderWithDetails;
  const customer = typedOrder.customer;

  const formatAddress = () => {
    if (!customer) return 'No address on file';
    const parts = [
      customer.address_line1,
      customer.address_line2,
      customer.city,
      customer.county,
      customer.eircode
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'No address on file';
  };

  return (
    <html>
      <head>
        <title>Delivery Docket - {typedOrder.order_number}</title>
        <style>{`
          @media print {
            @page {
              size: A4;
              margin: 15mm;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .no-print {
              display: none !important;
            }
          }
          
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #1a1a1a;
            background: #fff;
            padding: 20px;
          }
          
          .docket {
            max-width: 800px;
            margin: 0 auto;
          }
          
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #1a1a1a;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          
          .company-info h1 {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 4px;
          }
          
          .company-info p {
            color: #666;
            font-size: 11px;
          }
          
          .docket-title {
            text-align: right;
          }
          
          .docket-title h2 {
            font-size: 20px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          
          .docket-title .order-number {
            font-size: 16px;
            font-weight: 700;
            margin-top: 8px;
          }
          
          .details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
          }
          
          .detail-box h3 {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #666;
            margin-bottom: 8px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 4px;
          }
          
          .detail-box p {
            margin-bottom: 4px;
          }
          
          .detail-box .name {
            font-weight: 600;
            font-size: 14px;
          }
          
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          
          .items-table th {
            background: #f5f5f5;
            padding: 10px 8px;
            text-align: left;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 2px solid #1a1a1a;
          }
          
          .items-table th.qty,
          .items-table th.check {
            text-align: center;
            width: 80px;
          }
          
          .items-table td {
            padding: 12px 8px;
            border-bottom: 1px solid #ddd;
            vertical-align: top;
          }
          
          .items-table td.qty,
          .items-table td.check {
            text-align: center;
          }
          
          .items-table .check-box {
            width: 20px;
            height: 20px;
            border: 2px solid #1a1a1a;
            display: inline-block;
          }
          
          .signature-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
          }
          
          .signature-box h4 {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #666;
            margin-bottom: 40px;
          }
          
          .signature-line {
            border-bottom: 1px solid #1a1a1a;
            margin-bottom: 8px;
          }
          
          .signature-label {
            font-size: 10px;
            color: #666;
          }
          
          .notes-section {
            margin-top: 20px;
            padding: 15px;
            background: #f9f9f9;
            border-radius: 4px;
          }
          
          .notes-section h4 {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #666;
            margin-bottom: 8px;
          }
          
          .print-button {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 24px;
            background: #1a1a1a;
            color: #fff;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
          }
          
          .print-button:hover {
            background: #333;
          }
        `}</style>
      </head>
      <body>
        <button className="print-button no-print" onClick="window.print()">
          Print Docket
        </button>
        
        <div className="docket">
          {/* Header */}
          <div className="header">
            <div className="company-info">
              <h1>Doran Nurseries</h1>
              <p>Plant Nursery & Garden Centre</p>
              <p>Wicklow, Ireland</p>
            </div>
            <div className="docket-title">
              <h2>Delivery Docket</h2>
              <div className="order-number">{typedOrder.order_number}</div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="details-grid">
            <div className="detail-box">
              <h3>Deliver To</h3>
              <p className="name">{customer?.name || 'Unknown Customer'}</p>
              <p>{formatAddress()}</p>
              {customer?.phone && <p>Tel: {customer.phone}</p>}
            </div>
            <div className="detail-box">
              <h3>Order Details</h3>
              <p><strong>Date:</strong> {format(new Date(typedOrder.created_at), 'PPP')}</p>
              {typedOrder.requested_delivery_date && (
                <p><strong>Delivery Date:</strong> {format(new Date(typedOrder.requested_delivery_date), 'PPP')}</p>
              )}
              <p><strong>Status:</strong> {typedOrder.status}</p>
            </div>
          </div>

          {/* Items Table */}
          <table className="items-table">
            <thead>
              <tr>
                <th>Description</th>
                <th className="qty">Qty</th>
                <th className="check">Checked</th>
              </tr>
            </thead>
            <tbody>
              {typedOrder.order_items.map((item) => (
                <tr key={item.id}>
                  <td>{item.product?.name || item.description || 'Product'}</td>
                  <td className="qty">{item.quantity}</td>
                  <td className="check">
                    <span className="check-box"></span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Notes */}
          {typedOrder.notes && (
            <div className="notes-section">
              <h4>Notes</h4>
              <p>{typedOrder.notes}</p>
            </div>
          )}

          {/* Signature Section */}
          <div className="signature-section">
            <div className="signature-box">
              <h4>Packed By</h4>
              <div className="signature-line"></div>
              <p className="signature-label">Name & Date</p>
            </div>
            <div className="signature-box">
              <h4>Received By</h4>
              <div className="signature-line"></div>
              <p className="signature-label">Customer Signature & Date</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

