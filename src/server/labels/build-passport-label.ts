/**
 * Plant Passport Label Builder
 *
 * Generates ZPL labels for EU Plant Passport requirements.
 * EU Regulation (EU) 2016/2031 requires plant passports to include:
 * A) Botanical name (family/species)
 * B) Producer registration number
 * C) Traceability code (batch number)
 * D) Country of origin
 *
 * The passport must also include an EU flag and "Plant Passport" text.
 */

// DPI to dots-per-mm conversion
const getDpmm = (dpi: number) => dpi === 300 ? 12 : dpi === 600 ? 24 : 8;
const mm = (n: number, dpmm: number) => Math.round(n * dpmm);

export type PassportLabelInput = {
  aFamily: string;          // A) Botanical family/species name
  bProducerCode: string;    // B) Producer registration code
  cBatchNumber: string;     // C) Traceability code / batch number
  dCountryCode: string;     // D) Country of origin (ISO code)
  variety?: string;         // Optional: variety name for identification
};

type PassportLabelOptions = {
  dpi?: number;
  widthMm?: number;
  heightMm?: number;
  copies?: number;
  includeQr?: boolean;      // Include QR code for digital traceability
};

/**
 * Build ZPL for a standard EU Plant Passport label (50x30mm)
 *
 * Layout follows EU requirements with:
 * - EU flag (represented as "EU" text in basic ZPL)
 * - "Plant Passport" header
 * - A) B) C) D) fields clearly labeled
 */
export function buildPassportLabelZpl(
  input: PassportLabelInput,
  options: PassportLabelOptions = {}
): string {
  const {
    dpi = 300,
    widthMm = 50,
    heightMm = 30,
    copies = 1,
    includeQr = false,
  } = options;

  const { aFamily, bProducerCode, cBatchNumber, dCountryCode, variety } = input;

  const dpmm = getDpmm(dpi);
  const W = mm(widthMm, dpmm);
  const H = mm(heightMm, dpmm);
  const M = mm(2, dpmm);  // 2mm margin

  // Font sizes
  const fHeader = mm(3, dpmm);   // "Plant Passport" header
  const fLabel = mm(2.5, dpmm);  // A) B) C) D) labels
  const fValue = mm(3, dpmm);    // Field values
  const fEu = mm(4, dpmm);       // EU flag text

  // Layout positions
  const euFlagWidth = mm(8, dpmm);  // Space for EU flag representation
  const headerX = M + euFlagWidth + mm(2, dpmm);
  const contentX = M;

  // Vertical positions
  let y = M;
  const rowHeight = mm(5, dpmm);

  // QR code position (if included)
  const qrSize = mm(12, dpmm);
  const qrX = W - M - qrSize;
  const contentWidth = includeQr ? (qrX - M - mm(2, dpmm)) : (W - M * 2);

  const zpl: string[] = [
    "^XA",
    "^CI28",  // UTF-8
    `^PW${W}`,
    `^LL${H}`,
    "^LH0,0",
    copies > 1 ? `^PQ${copies},0,1,Y` : "",
  ];

  // EU Flag representation - blue rectangle with "EU" text
  // Note: Real labels should use a proper EU flag image, but ZPL basic version uses text
  zpl.push(
    // Blue background for EU flag area (inverted text on dark background)
    `^FO${M},${M}`,
    `^GB${euFlagWidth},${mm(10, dpmm)},${mm(10, dpmm)},B,0^FS`,
    // EU text
    `^FO${M + mm(1, dpmm)},${M + mm(2, dpmm)}`,
    `^A0N,${fEu},${fEu}`,
    `^FR^FD EU ^FS`,  // FR = field reverse (white on black)
  );

  // "Plant Passport" header
  zpl.push(
    `^FO${headerX},${M}`,
    `^A0N,${fHeader},${fHeader}`,
    `^FB${W - headerX - M},1,0,L,0`,
    `^FDPlant Passport^FS`,
  );

  // A) Botanical name / Family
  y = M + mm(11, dpmm);
  zpl.push(
    `^FO${contentX},${y}`,
    `^A0N,${fLabel},${fLabel}`,
    `^FDA)^FS`,
    `^FO${contentX + mm(5, dpmm)},${y}`,
    `^A0N,${fValue},${fValue}`,
    `^FB${contentWidth - mm(5, dpmm)},1,0,L,0`,
    `^FD${escapeZpl(aFamily)}^FS`,
  );

  // B) Producer Code
  y += rowHeight;
  zpl.push(
    `^FO${contentX},${y}`,
    `^A0N,${fLabel},${fLabel}`,
    `^FDB)^FS`,
    `^FO${contentX + mm(5, dpmm)},${y}`,
    `^A0N,${fValue},${fValue}`,
    `^FB${contentWidth - mm(5, dpmm)},1,0,L,0`,
    `^FD${escapeZpl(bProducerCode)}^FS`,
  );

  // C) Batch/Traceability code and D) Country on same line to save space
  y += rowHeight;
  const halfWidth = Math.floor(contentWidth / 2);

  // C) Batch number
  zpl.push(
    `^FO${contentX},${y}`,
    `^A0N,${fLabel},${fLabel}`,
    `^FDC)^FS`,
    `^FO${contentX + mm(5, dpmm)},${y}`,
    `^A0N,${fValue},${fValue}`,
    `^FB${halfWidth - mm(5, dpmm)},1,0,L,0`,
    `^FD${escapeZpl(cBatchNumber)}^FS`,
  );

  // D) Country code
  zpl.push(
    `^FO${contentX + halfWidth},${y}`,
    `^A0N,${fLabel},${fLabel}`,
    `^FDD)^FS`,
    `^FO${contentX + halfWidth + mm(5, dpmm)},${y}`,
    `^A0N,${fValue},${fValue}`,
    `^FD${escapeZpl(dCountryCode)}^FS`,
  );

  // QR code for digital traceability (optional)
  if (includeQr) {
    const qrPayload = `ht:passport:${cBatchNumber}`;
    zpl.push(
      `^FO${qrX},${M}`,
      `^BQN,2,3`,  // QR code, normal orientation, magnification 3
      `^FDQA,${escapeZpl(qrPayload)}^FS`,
    );
  }

  // Optional: variety name at bottom if provided
  if (variety) {
    y += rowHeight;
    zpl.push(
      `^FO${contentX},${y}`,
      `^A0N,${mm(2, dpmm)},${mm(2, dpmm)}`,
      `^FB${contentWidth},1,0,L,0`,
      `^FD${escapeZpl(variety)}^FS`,
    );
  }

  zpl.push("^XZ");

  return zpl.filter(Boolean).join("\n");
}

/**
 * Build ZPL for a larger format passport label (70x50mm)
 * Better for reading and includes more detail
 */
export function buildPassportLabelLargeZpl(
  input: PassportLabelInput,
  options: PassportLabelOptions = {}
): string {
  const {
    dpi = 300,
    widthMm = 70,
    heightMm = 50,
    copies = 1,
    includeQr = true,
  } = options;

  const { aFamily, bProducerCode, cBatchNumber, dCountryCode, variety } = input;

  const dpmm = getDpmm(dpi);
  const W = mm(widthMm, dpmm);
  const H = mm(heightMm, dpmm);
  const M = mm(3, dpmm);

  // Font sizes - larger for readability
  const fTitle = mm(5, dpmm);    // "EU Plant Passport" title
  const fLabel = mm(3, dpmm);    // Field labels
  const fValue = mm(4, dpmm);    // Field values
  const fVariety = mm(3.5, dpmm); // Variety name
  const fEu = mm(6, dpmm);       // EU text

  // EU flag area
  const euFlagWidth = mm(12, dpmm);
  const euFlagHeight = mm(12, dpmm);

  // QR code area
  const qrSize = mm(18, dpmm);
  const qrX = W - M - qrSize;

  // Content area
  const contentX = M;
  const contentWidth = includeQr ? (qrX - M - mm(3, dpmm)) : (W - M * 2);

  const zpl: string[] = [
    "^XA",
    "^CI28",
    `^PW${W}`,
    `^LL${H}`,
    "^LH0,0",
    copies > 1 ? `^PQ${copies},0,1,Y` : "",
  ];

  // EU Flag representation
  zpl.push(
    `^FO${M},${M}`,
    `^GB${euFlagWidth},${euFlagHeight},${euFlagHeight},B,0^FS`,
    `^FO${M + mm(2, dpmm)},${M + mm(3, dpmm)}`,
    `^A0N,${fEu},${fEu}`,
    `^FR^FDEU^FS`,
  );

  // "Plant Passport" header
  const headerX = M + euFlagWidth + mm(3, dpmm);
  zpl.push(
    `^FO${headerX},${M}`,
    `^A0N,${fTitle},${fTitle}`,
    `^FDPlant Passport^FS`,
    // Subheader
    `^FO${headerX},${M + mm(6, dpmm)}`,
    `^A0N,${mm(2.5, dpmm)},${mm(2.5, dpmm)}`,
    `^FDEU Regulation 2016/2031^FS`,
  );

  // Horizontal divider
  let y = M + euFlagHeight + mm(2, dpmm);
  zpl.push(
    `^FO${M},${y}`,
    `^GB${W - M * 2},1,1^FS`,
  );

  // Passport fields
  y += mm(3, dpmm);
  const rowHeight = mm(8, dpmm);
  const labelWidth = mm(6, dpmm);

  // A) Botanical name / Family
  zpl.push(
    `^FO${contentX},${y}`,
    `^A0N,${fLabel},${fLabel}`,
    `^FDA)^FS`,
    `^FO${contentX + labelWidth},${y}`,
    `^A0N,${fValue},${fValue}`,
    `^FB${contentWidth - labelWidth},2,0,L,0`,
    `^FD${escapeZpl(aFamily)}^FS`,
  );

  // B) Producer Code
  y += rowHeight;
  zpl.push(
    `^FO${contentX},${y}`,
    `^A0N,${fLabel},${fLabel}`,
    `^FDB)^FS`,
    `^FO${contentX + labelWidth},${y}`,
    `^A0N,${fValue},${fValue}`,
    `^FB${contentWidth - labelWidth},1,0,L,0`,
    `^FD${escapeZpl(bProducerCode)}^FS`,
  );

  // C) Batch number
  y += rowHeight;
  zpl.push(
    `^FO${contentX},${y}`,
    `^A0N,${fLabel},${fLabel}`,
    `^FDC)^FS`,
    `^FO${contentX + labelWidth},${y}`,
    `^A0N,${fValue},${fValue}`,
    `^FB${contentWidth - labelWidth},1,0,L,0`,
    `^FD${escapeZpl(cBatchNumber)}^FS`,
  );

  // D) Country code
  y += rowHeight;
  zpl.push(
    `^FO${contentX},${y}`,
    `^A0N,${fLabel},${fLabel}`,
    `^FDD)^FS`,
    `^FO${contentX + labelWidth},${y}`,
    `^A0N,${fValue},${fValue}`,
    `^FD${escapeZpl(dCountryCode)}^FS`,
  );

  // QR code for digital traceability
  if (includeQr) {
    const qrPayload = `ht:passport:${cBatchNumber}`;
    zpl.push(
      `^FO${qrX},${M}`,
      `^BQN,2,4`,  // QR code, magnification 4
      `^FDQA,${escapeZpl(qrPayload)}^FS`,
    );
  }

  // Variety name at bottom (if provided)
  if (variety) {
    zpl.push(
      `^FO${M},${H - M - mm(5, dpmm)}`,
      `^A0N,${fVariety},${fVariety}`,
      `^FB${W - M * 2},1,0,L,0`,
      `^FD${escapeZpl(variety)}^FS`,
    );
  }

  zpl.push("^XZ");

  return zpl.filter(Boolean).join("\n");
}

/**
 * Build a combined batch + passport label
 * Includes batch identification info AND EU passport requirements
 */
export function buildCombinedBatchPassportZpl(
  batchInfo: {
    batchNumber: string | number;
    variety: string;
    family: string;
    quantity: number;
    size: string;
    location?: string;
  },
  passportInfo: PassportLabelInput,
  options: PassportLabelOptions = {}
): string {
  const {
    dpi = 300,
    widthMm = 70,
    heightMm = 70,
    copies = 1,
  } = options;

  const dpmm = getDpmm(dpi);
  const W = mm(widthMm, dpmm);
  const H = mm(heightMm, dpmm);
  const M = mm(2, dpmm);

  // Split label into two sections
  const passportHeight = mm(30, dpmm);
  const batchInfoHeight = H - passportHeight;

  const zpl: string[] = [
    "^XA",
    "^CI28",
    `^PW${W}`,
    `^LL${H}`,
    "^LH0,0",
    copies > 1 ? `^PQ${copies},0,1,Y` : "",
  ];

  // Top section: Batch info with DataMatrix
  const dmSide = mm(16, dpmm);
  const dmModule = dpi === 300 ? 8 : dpi === 600 ? 16 : 6;
  const dmPayload = `ht:batch:${batchInfo.batchNumber}`;

  const fVar = mm(5, dpmm);
  const fInfo = mm(3.5, dpmm);
  const fBatch = mm(6, dpmm);

  const textStartX = M + dmSide + mm(3, dpmm);
  const textWidth = W - textStartX - M;

  // DataMatrix
  zpl.push(
    `^FO${M},${M}`,
    `^BXN,${dmModule},200`,
    `^FD${escapeZpl(dmPayload)}^FS`,
  );

  // Variety name
  zpl.push(
    `^FO${textStartX},${M}`,
    `^A0N,${fVar},${fVar}`,
    `^FB${textWidth},2,0,L,0`,
    `^FD${escapeZpl(batchInfo.variety)}^FS`,
  );

  // Size and quantity
  const infoY = M + mm(10, dpmm);
  const infoLine = `${batchInfo.size}  /  Qty: ${batchInfo.quantity}`;
  zpl.push(
    `^FO${textStartX},${infoY}`,
    `^A0N,${fInfo},${fInfo}`,
    `^FD${escapeZpl(infoLine)}^FS`,
  );

  // Batch number
  const batchY = M + dmSide + mm(2, dpmm);
  zpl.push(
    `^FO${M},${batchY}`,
    `^A0N,${fBatch},${fBatch}`,
    `^FB${W - M * 2},1,0,R,0`,
    `^FD#${escapeZpl(String(batchInfo.batchNumber))}^FS`,
  );

  // Divider line
  const dividerY = batchInfoHeight;
  zpl.push(
    `^FO${M},${dividerY}`,
    `^GB${W - M * 2},2,2^FS`,
  );

  // Bottom section: EU Plant Passport
  const passportY = dividerY + mm(2, dpmm);
  const euFlagWidth = mm(10, dpmm);
  const fPassportTitle = mm(3.5, dpmm);
  const fLabel = mm(2.5, dpmm);
  const fValue = mm(3, dpmm);

  // EU flag
  zpl.push(
    `^FO${M},${passportY}`,
    `^GB${euFlagWidth},${mm(8, dpmm)},${mm(8, dpmm)},B,0^FS`,
    `^FO${M + mm(2, dpmm)},${passportY + mm(2, dpmm)}`,
    `^A0N,${mm(4, dpmm)},${mm(4, dpmm)}`,
    `^FR^FDEU^FS`,
  );

  // "Plant Passport" header
  const passportHeaderX = M + euFlagWidth + mm(2, dpmm);
  zpl.push(
    `^FO${passportHeaderX},${passportY}`,
    `^A0N,${fPassportTitle},${fPassportTitle}`,
    `^FDPlant Passport^FS`,
  );

  // Passport fields - compact two-column layout
  let y = passportY + mm(10, dpmm);
  const colWidth = Math.floor((W - M * 2) / 2);

  // A) and B) on first row
  zpl.push(
    // A) Family
    `^FO${M},${y}`,
    `^A0N,${fLabel},${fLabel}`,
    `^FDA) ${escapeZpl(passportInfo.aFamily)}^FS`,
    // B) Producer
    `^FO${M + colWidth},${y}`,
    `^A0N,${fLabel},${fLabel}`,
    `^FDB) ${escapeZpl(passportInfo.bProducerCode)}^FS`,
  );

  // C) and D) on second row
  y += mm(5, dpmm);
  zpl.push(
    // C) Batch
    `^FO${M},${y}`,
    `^A0N,${fLabel},${fLabel}`,
    `^FDC) ${escapeZpl(passportInfo.cBatchNumber)}^FS`,
    // D) Country
    `^FO${M + colWidth},${y}`,
    `^A0N,${fLabel},${fLabel}`,
    `^FDD) ${escapeZpl(passportInfo.dCountryCode)}^FS`,
  );

  zpl.push("^XZ");

  return zpl.filter(Boolean).join("\n");
}

function escapeZpl(s: string): string {
  return s.replace(/[\^\\~]/g, (m) => "\\" + m);
}
