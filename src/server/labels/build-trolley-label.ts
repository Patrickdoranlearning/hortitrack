// src/server/labels/build-trolley-label.ts

const dpmm = 8; // 203dpi ≈ 8 dots/mm
const mm = (n: number) => Math.round(n * dpmm);

export type TrolleyLabelInput = {
  labelCode: string; // Datamatrix content: HT:orgId:orderId:timestamp
  customerName: string;
  orderNumber: string;
  trolleyNumber?: string;
  deliveryDate?: string;
  itemCount?: number;
  notes?: string;
};

/**
 * Builds ZPL for a trolley label with datamatrix
 * Label size: 100x70mm (same as location labels)
 * Designed for scan-to-pick workflow
 */
export function buildTrolleyLabelZpl(input: TrolleyLabelInput, copies: number = 1): string {
  const {
    labelCode,
    customerName,
    orderNumber,
    trolleyNumber,
    deliveryDate,
    itemCount,
    notes,
  } = input;

  // Label size: 100x70mm
  const W = mm(100); // 800 dots
  const H = mm(70);  // 560 dots
  const M = mm(4);   // 32 dots margin

  // DataMatrix settings - larger for easier scanning
  const dmSide = mm(28);    // DataMatrix size (28mm)
  const dmModule = 8;       // Module size for better scan distance

  // Fonts
  const fCustomer = 72;     // Large customer name
  const fOrder = 48;        // Order number
  const fDetails = 32;      // Delivery date, item count
  const fTrolley = 40;      // Trolley number
  const fNotes = 24;        // Notes
  const fFooter = 20;       // Footer text

  // Layout
  const dmX = W - M - mm(30); // DataMatrix on right side
  const textW = dmX - M - mm(4); // Text width (left of datamatrix)

  return [
    '^XA',
    '^CI28', // UTF-8
    `^PW${W}`,
    `^LL${H}`,
    '^LH0,0',
    copies > 1 ? `^PQ${copies},0,1,Y` : '',

    // Large DataMatrix on right side for easy scanning
    `^FO${dmX},${M}`,
    `^BXN,${dmSide},${dmModule},2`,
    `^FD${escapeZpl(labelCode)}^FS`,

    // Customer name (large, prominent)
    `^FO${M},${M}`,
    `^CF0,${fCustomer}`,
    `^FB${textW},2,0,L,0`,
    `^FD${escapeZpl(truncate(customerName, 24))}^FS`,

    // Order number below customer
    `^FO${M},${M + mm(20)}`,
    `^CF0,${fOrder}`,
    `^FB${textW},1,0,L,0`,
    `^FD#${escapeZpl(orderNumber)}^FS`,

    // Horizontal separator
    `^FO${M},${M + mm(32)}`,
    `^GB${textW},2,2^FS`,

    // Delivery date (if provided)
    deliveryDate
      ? [
          `^FO${M},${M + mm(36)}`,
          `^CF0,${fDetails}`,
          `^FB${textW},1,0,L,0`,
          `^FDDelivery: ${escapeZpl(formatDate(deliveryDate))}^FS`,
        ].join('\n')
      : '',

    // Item count (if provided)
    itemCount !== undefined
      ? [
          `^FO${M},${M + mm(44)}`,
          `^CF0,${fDetails}`,
          `^FB${textW},1,0,L,0`,
          `^FD${itemCount} items^FS`,
        ].join('\n')
      : '',

    // Trolley number (bottom left, large)
    trolleyNumber
      ? [
          `^FO${M},${H - mm(22)}`,
          `^CF0,${fTrolley}`,
          `^FB${mm(40)},1,0,L,0`,
          `^FDTrolley ${escapeZpl(trolleyNumber)}^FS`,
        ].join('\n')
      : '',

    // Notes (if provided)
    notes
      ? [
          `^FO${M + mm(45)},${H - mm(20)}`,
          `^CF0,${fNotes}`,
          `^FB${textW - mm(45)},2,0,L,0`,
          `^FD${escapeZpl(truncate(notes, 50))}^FS`,
        ].join('\n')
      : '',

    // Footer line (separator)
    `^FO${M},${H - mm(12)}`,
    `^GB${W - 2 * M},1,1^FS`,

    // Scan instruction (bottom center)
    `^FO${M},${H - mm(10)}`,
    `^CF0,${fFooter}`,
    `^FB${W - 2 * M},1,0,C,0`,
    `^FDScan to start picking^FS`,

    '^XZ',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Generates the datamatrix payload for a trolley label
 * Format: HT:<orgId>:<orderId>:<timestamp>
 */
export function generateTrolleyLabelCode(orgId: string, orderId: string): string {
  const timestamp = Date.now().toString(36); // Base36 for shorter string
  return `HT:${orgId.slice(0, 8)}:${orderId.slice(0, 8)}:${timestamp}`;
}

/**
 * Parses a trolley label code to extract order info
 */
export function parseTrolleyLabelCode(code: string): {
  orgIdPrefix: string;
  orderIdPrefix: string;
  timestamp: number;
} | null {
  const parts = code.split(':');
  if (parts.length !== 4 || parts[0] !== 'HT') {
    return null;
  }
  return {
    orgIdPrefix: parts[1],
    orderIdPrefix: parts[2],
    timestamp: parseInt(parts[3], 36),
  };
}

function escapeZpl(s: string): string {
  return s.replace(/[\^\\~]/g, (m) => '\\' + m);
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + '…';
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return dateStr;
  }
}
