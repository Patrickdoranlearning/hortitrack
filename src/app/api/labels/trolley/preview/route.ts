import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerApp } from '@/server/db/supabase';
import { resolveActiveOrgId } from '@/server/org/getActiveOrg';
import { generateTrolleyLabelCode } from '@/server/labels/build-trolley-label';

/**
 * GET /api/labels/trolley/preview
 * Generate HTML preview for trolley label printing via browser print dialog
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');
    const customerName = searchParams.get('customerName');
    const orderNumber = searchParams.get('orderNumber');
    const deliveryDate = searchParams.get('deliveryDate');
    const trolleyNumber = searchParams.get('trolleyNumber') || '1';
    const copies = parseInt(searchParams.get('copies') || '1', 10);

    if (!orderId || !customerName || !orderNumber) {
      return NextResponse.json(
        { error: 'orderId, customerName, and orderNumber are required' },
        { status: 400 }
      );
    }

    const orgId = await resolveActiveOrgId();
    if (!orgId) {
      return NextResponse.json(
        { error: 'No active organization' },
        { status: 401 }
      );
    }

    // Generate label code for datamatrix
    const labelCode = generateTrolleyLabelCode(orgId, orderId);

    // Format delivery date
    let formattedDate = '';
    if (deliveryDate) {
      try {
        const date = new Date(deliveryDate);
        formattedDate = date.toLocaleDateString('en-IE', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });
      } catch {
        formattedDate = deliveryDate;
      }
    }

    // Generate labels HTML (one per copy)
    const labels = Array.from({ length: copies }, (_, i) => {
      const currentTrolley = copies > 1 ? `${i + 1}` : trolleyNumber;
      return generateLabelHtml({
        labelCode,
        customerName,
        orderNumber,
        deliveryDate: formattedDate,
        trolleyNumber: currentTrolley,
        totalTrolleys: copies > 1 ? copies : undefined,
      });
    }).join('\n<div class="page-break"></div>\n');

    // Return full HTML page for printing
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trolley Label - ${orderNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    @page {
      size: 100mm 70mm;
      margin: 0;
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .no-print {
        display: none !important;
      }
      .page-break {
        page-break-after: always;
      }
      .label {
        page-break-inside: avoid;
      }
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }

    .no-print {
      text-align: center;
      margin-bottom: 20px;
      padding: 16px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .no-print button {
      background: #2563eb;
      color: white;
      border: none;
      padding: 12px 24px;
      font-size: 16px;
      border-radius: 6px;
      cursor: pointer;
      margin: 0 8px;
    }

    .no-print button:hover {
      background: #1d4ed8;
    }

    .no-print button.secondary {
      background: #6b7280;
    }

    .no-print button.secondary:hover {
      background: #4b5563;
    }

    .labels-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }

    .label {
      width: 100mm;
      height: 70mm;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 4mm;
      position: relative;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .label-content {
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 3mm;
    }

    .customer-info {
      flex: 1;
      padding-right: 4mm;
    }

    .customer-name {
      font-size: 20px;
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 2mm;
      word-wrap: break-word;
    }

    .order-number {
      font-size: 16px;
      font-weight: 600;
      color: #374151;
    }

    .qr-code {
      width: 28mm;
      height: 28mm;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .qr-code svg {
      width: 24mm;
      height: 24mm;
    }

    .divider {
      height: 1px;
      background: #e5e7eb;
      margin: 2mm 0;
    }

    .details {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2mm;
    }

    .detail-row {
      font-size: 12px;
      color: #4b5563;
    }

    .detail-row strong {
      color: #111827;
    }

    .trolley-info {
      margin-top: auto;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .trolley-number {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
    }

    .trolley-count {
      font-size: 12px;
      color: #6b7280;
    }

    .footer {
      border-top: 1px solid #e5e7eb;
      padding-top: 2mm;
      margin-top: 2mm;
      text-align: center;
    }

    .footer-text {
      font-size: 10px;
      color: #9ca3af;
    }

    .page-break {
      height: 0;
    }
  </style>
</head>
<body>
  <div class="no-print">
    <h2 style="margin-bottom: 12px;">Trolley Label Preview</h2>
    <p style="margin-bottom: 16px; color: #6b7280;">${copies} label${copies > 1 ? 's' : ''} for ${customerName}</p>
    <button onclick="window.print()">Print Label${copies > 1 ? 's' : ''}</button>
    <button class="secondary" onclick="window.close()">Close</button>
  </div>

  <div class="labels-container">
    ${labels}
  </div>

  <script>
    // Auto-trigger print dialog after a short delay
    setTimeout(() => {
      window.print();
    }, 500);
  </script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error: any) {
    console.error('[Trolley Label Preview] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate label preview' },
      { status: 500 }
    );
  }
}

interface LabelData {
  labelCode: string;
  customerName: string;
  orderNumber: string;
  deliveryDate?: string;
  trolleyNumber: string;
  totalTrolleys?: number;
}

function generateLabelHtml(data: LabelData): string {
  const { labelCode, customerName, orderNumber, deliveryDate, trolleyNumber, totalTrolleys } = data;

  // Generate a simple QR-like visual representation (actual QR would need a library)
  // For now, display the code as text - in production, use a QR code library
  const qrPlaceholder = `
    <div style="font-size: 8px; text-align: center; word-break: break-all; padding: 2mm;">
      <div style="font-weight: bold; margin-bottom: 1mm;">SCAN</div>
      <div style="font-family: monospace; font-size: 6px;">${labelCode}</div>
    </div>
  `;

  return `
    <div class="label">
      <div class="label-content">
        <div class="header">
          <div class="customer-info">
            <div class="customer-name">${escapeHtml(customerName)}</div>
            <div class="order-number">#${escapeHtml(orderNumber)}</div>
          </div>
          <div class="qr-code">
            ${qrPlaceholder}
          </div>
        </div>

        <div class="divider"></div>

        <div class="details">
          ${deliveryDate ? `<div class="detail-row"><strong>Delivery:</strong> ${escapeHtml(deliveryDate)}</div>` : ''}

          <div class="trolley-info">
            <div>
              <div class="trolley-number">Trolley ${escapeHtml(trolleyNumber)}</div>
              ${totalTrolleys ? `<div class="trolley-count">of ${totalTrolleys} trolleys</div>` : ''}
            </div>
          </div>
        </div>

        <div class="footer">
          <div class="footer-text">Scan to start picking</div>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
