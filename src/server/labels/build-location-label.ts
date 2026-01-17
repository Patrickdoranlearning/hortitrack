// src/server/labels/build-location-label.ts

// DPI to dots-per-mm conversion
// 203 DPI = 8 dpmm, 300 DPI = 12 dpmm, 600 DPI = 24 dpmm
const getDpmm = (dpi: number) => dpi === 300 ? 12 : dpi === 600 ? 24 : 8;
const mm = (n: number, dpmm: number) => Math.round(n * dpmm);

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

export function buildLocationZpl(input: LocationLabelInput, copies: number = 1, dpi: number = 300): string {
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

  // Calculate dots-per-mm based on DPI
  const dpmm = getDpmm(dpi);

  // Label size: 100x70mm
  const W = mm(100, dpmm); // 1200 dots at 300dpi
  const H = mm(70, dpmm);  // 840 dots at 300dpi
  const M = mm(4, dpmm);   // margin

  // DataMatrix settings - module size based on DPI
  // Module size determines cell size in dots - larger = bigger barcode
  const dmModule = dpi === 300 ? 12 : dpi === 600 ? 24 : 8;  // Increased for better scanning

  // Fonts - scale with DPI
  const fLocation = mm(5, dpmm);   // Large location name (5mm)
  const fStats = mm(3, dpmm);      // Stats (batch count, total plants)
  const fSection = mm(2.5, dpmm);  // Section headers
  const fItem = mm(2.2, dpmm);     // Batch list items
  const fFooter = mm(2, dpmm);     // Footer text

  // Column widths - DataMatrix area
  const dmSide = mm(22, dpmm);    // DataMatrix display area
  const leftColW = mm(26, dpmm);  // DM column
  const gapCol = mm(3, dpmm);
  const textRightX = M + leftColW + gapCol;
  const textRightW = W - textRightX - M;

  // Build batch list entries (max 6 for space)
  const batchList = batches.slice(0, 6);
  const batchListZpl = batchList.map((b, idx) => {
    const y = M + mm(32, dpmm) + mm(7 * idx, dpmm);
    return [
      `^FO${textRightX},${y}`,
      `^A0N,${fItem},${fItem}`,
      `^FB${textRightW},1,0,L,0`,
      `^FD${escapeZpl(b.variety || b.batchNumber)} - ${b.quantity.toLocaleString()}^FS`,
    ].join('\n');
  }).join('\n');

  // Contents header Y position
  const contentsHeaderY = M + mm(28, dpmm);

  return [
    '^XA',
    '^CI28', // UTF-8
    `^PW${W}`,
    `^LL${H}`,
    '^LH0,0',
    copies > 1 ? `^PQ${copies},0,1,Y` : '',

    // Data Matrix top-left
    // ^BXN command: ^BXo,h,s where h=module size (not total size), s=200 for default
    `^FO${M},${M}`,
    `^BXN,${dmModule},200`,
    `^FD${escapeZpl(dmPayload)}^FS`,

    // Location name (large, next to DM)
    `^FO${textRightX},${M}`,
    `^A0N,${fLocation},${fLocation}`,
    `^FB${textRightW},1,0,L,0`,
    `^FD${escapeZpl(locationName)}^FS`,

    // Site and type info below name
    `^FO${textRightX},${M + mm(10, dpmm)}`,
    `^A0N,${fStats},${fStats}`,
    `^FB${textRightW},1,0,L,0`,
    `^FD${escapeZpl(nurserySite || 'Main')} - ${escapeZpl(type || 'Section')}^FS`,

    // Stats (batch count and plant count)
    `^FO${textRightX},${M + mm(18, dpmm)}`,
    `^A0N,${fStats},${fStats}`,
    `^FB${textRightW},1,0,L,0`,
    `^FD${batchCount} batches - ${totalQuantity.toLocaleString()} plants^FS`,

    // Contents header
    `^FO${textRightX},${contentsHeaderY}`,
    `^A0N,${fSection},${fSection}`,
    `^FB${textRightW},1,0,L,0`,
    `^FD--- CONTENTS ---^FS`,

    // Batch list
    batchListZpl,

    // Footer line (separator)
    `^FO${M},${H - mm(12, dpmm)}`,
    `^GB${W - 2 * M},1,1^FS`,

    // Printed date (bottom left)
    `^FO${M},${H - mm(10, dpmm)}`,
    `^A0N,${fFooter},${fFooter}`,
    `^FDPrinted: ${new Date().toLocaleDateString()}^FS`,

    // Site ID (bottom right)
    siteId
      ? [
          `^FO${W - M - mm(40, dpmm)},${H - mm(10, dpmm)}`,
          `^A0N,${fFooter},${fFooter}`,
          `^FB${mm(40, dpmm)},1,0,R,0`,
          `^FDID: ${escapeZpl(siteId)}^FS`,
        ].join('\n')
      : '',

    // Horizontal line under header
    `^FO${M},${M + mm(26, dpmm)}`,
    `^GB${W - 2 * M},1,1^FS`,

    '^XZ',
  ]
    .filter(Boolean)
    .join('\n');
}

function escapeZpl(s: string): string {
  return s.replace(/[\^\\~]/g, (m) => '\\' + m);
}







