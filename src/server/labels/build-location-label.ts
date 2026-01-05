// src/server/labels/build-location-label.ts

const dpmm = 8; // 203dpi ≈ 8 dots/mm
const mm = (n: number) => Math.round(n * dpmm);

type BatchSummary = {
  batchNumber: string;
  variety: string;
  quantity: number;
  pottedDate?: string;
};

type LocationLabelInput = {
  locationId: string;
  locationName: string;
  nurserySite?: string;
  type?: string;
  siteId?: string;
  batchCount: number;
  totalQuantity: number;
  batches?: BatchSummary[];
  payload?: string;
};

export function buildLocationZpl(input: LocationLabelInput, copies: number = 1): string {
  const {
    locationId,
    locationName,
    nurserySite,
    type,
    siteId,
    batchCount,
    totalQuantity,
    batches = [],
    payload,
  } = input;

  const dmPayload = payload ?? `ht:loc:${locationId}`;

  // Label size: 100x70mm
  const W = mm(100); // 800 dots
  const H = mm(70);  // 560 dots
  const M = mm(4);   // 32 dots margin

  // DataMatrix settings
  const dmSide = mm(22);    // DataMatrix size
  const dmModule = 6;

  // Fonts
  const fLocation = 60;     // Large location name
  const fStats = 36;        // Stats (batch count, total plants)
  const fSection = 28;      // Section headers
  const fItem = 24;         // Batch list items
  const fFooter = 20;       // Footer text

  // Column widths
  const leftColW = mm(26);  // DM column
  const gapCol = mm(3);
  const textRightX = M + leftColW + gapCol;
  const textRightW = W - textRightX - M;

  // Build batch list entries (max 6 for space)
  const batchList = batches.slice(0, 6);
  const batchListZpl = batchList.map((b, idx) => {
    const y = M + mm(32) + mm(7 * idx);
    return [
      `^FO${textRightX},${y}`,
      `^CF0,${fItem}`,
      `^FB${textRightW},1,0,L,0`,
      `^FD${escapeZpl(b.variety || b.batchNumber)} • ${b.quantity.toLocaleString()}^FS`,
    ].join('\n');
  }).join('\n');

  // Contents header Y position
  const contentsHeaderY = M + mm(28);

  return [
    '^XA',
    '^CI28', // UTF-8
    `^PW${W}`,
    `^LL${H}`,
    '^LH0,0',
    copies > 1 ? `^PQ${copies},0,1,Y` : '',

    // Data Matrix top-left
    `^FO${M},${M}`,
    `^BXN,${dmSide},${dmModule},2`,
    `^FD${escapeZpl(dmPayload)}^FS`,

    // Location name (large, next to DM)
    `^FO${textRightX},${M}`,
    `^CF0,${fLocation}`,
    `^FB${textRightW},1,0,L,0`,
    `^FD${escapeZpl(locationName)}^FS`,

    // Site and type info below name
    `^FO${textRightX},${M + mm(10)}`,
    `^CF0,${fStats}`,
    `^FB${textRightW},1,0,L,0`,
    `^FD${escapeZpl(nurserySite || 'Main')} • ${escapeZpl(type || 'Section')}^FS`,

    // Stats (batch count and plant count)
    `^FO${textRightX},${M + mm(18)}`,
    `^CF0,${fStats}`,
    `^FB${textRightW},1,0,L,0`,
    `^FD${batchCount} batches • ${totalQuantity.toLocaleString()} plants^FS`,

    // Contents header
    `^FO${textRightX},${contentsHeaderY}`,
    `^CF0,${fSection}`,
    `^FB${textRightW},1,0,L,0`,
    `^FD--- CONTENTS ---^FS`,

    // Batch list
    batchListZpl,

    // Footer line (separator)
    `^FO${M},${H - mm(12)}`,
    `^GB${W - 2 * M},1,1^FS`,

    // Printed date (bottom left)
    `^FO${M},${H - mm(10)}`,
    `^CF0,${fFooter}`,
    `^FDPrinted: ${new Date().toLocaleDateString()}^FS`,

    // Site ID (bottom right)
    siteId
      ? [
          `^FO${W - M - mm(40)},${H - mm(10)}`,
          `^CF0,${fFooter}`,
          `^FB${mm(40)},1,0,R,0`,
          `^FDID: ${escapeZpl(siteId)}^FS`,
        ].join('\n')
      : '',

    // Horizontal line under header
    `^FO${M},${M + mm(26)}`,
    `^GB${W - 2 * M},1,1^FS`,

    '^XZ',
  ]
    .filter(Boolean)
    .join('\n');
}

function escapeZpl(s: string): string {
  return s.replace(/[\^\\~]/g, (m) => '\\' + m);
}





