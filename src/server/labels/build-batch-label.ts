
// src/server/labels/build-batch-label.ts
const dpmm = 8; // 203dpi ≈ 8 dots/mm
const mm = (n: number, customDpmm?: number) => Math.round(n * (customDpmm || dpmm));

type LabelInput = {
  batchNumber: string | number;
  variety: string;
  family: string;
  quantity: number;
  size: string;
  location?: string;
  payload?: string; // DataMatrix content
};

type LabelTemplate = {
  width_mm: number;
  height_mm: number;
  margin_mm: number;
  dpi: number;
  zpl_template?: string;
  layout?: Record<string, any>;
};

export function buildZpl(input: LabelInput, copies: number = 1): string {
  const { batchNumber, variety, family, quantity, size, location, payload } = input;
  const dmPayload = payload ?? `ht:batch:${batchNumber}`;
  
  // Label size: 70x50mm, margin 3mm
  const W = mm(70); // 560
  const H = mm(50); // 400
  const M = mm(3);  // 24

  // Left column: DM 24mm wide, top-left
  const dmSide = mm(24); // 192 dots
  const leftColW = mm(26); // DM + a bit of breathing space
  const gapCol = mm(2);
  const textRightX = M + leftColW + gapCol; // start of right column
  const textRightW = W - textRightX - M;

  // Below-DM text start
  const belowDmY = M + dmSide + mm(2);
  const belowDmW = dmSide; // fit under DM

  // Fonts
  const fBatch = 72; // big
  const fVar   = 48; // medium
  const fInfo  = 30; // small info under DM

  // DataMatrix
  const dmModule = 6; // tweak 5–8 if needed

  return [
    "^XA",
    "^CI28",
    `^PW${W}`,
    `^LL${H}`,
    "^LH0,0",
    copies > 1 ? `^PQ${copies},0,1,Y` : "", // Print quantity

    // Data Matrix top-left
    `^FO${M},${M}`,
    `^BXN,${dmSide},${dmModule},2`,
    `^FD${escapeZpl(dmPayload)}^FS`,

    // Details BELOW the Data Matrix (Family / Size / Qty / Location)
    `^FO${M},${belowDmY}`,
    `^CF0,${fInfo}`,
    `^FB${belowDmW},1,0,L,0`,
    `^FDFamily: ${escapeZpl(family)}^FS`,

    `^FO${M},${belowDmY + mm(6)}`,
    `^CF0,${fInfo}`,
    `^FB${belowDmW},1,0,L,0`,
    `^FDSize: ${escapeZpl(size)}^FS`,

    `^FO${M},${belowDmY + mm(12)}`,
    `^CF0,${fInfo}`,
    `^FB${belowDmW},1,0,L,0`,
    `^FDQty: ${quantity}^FS`,

    location ? [
      `^FO${M},${belowDmY + mm(18)}`,
      `^CF0,${fInfo}`,
      `^FB${belowDmW},1,0,L,0`,
      `^FDLoc: ${escapeZpl(location)}^FS`,
    ].join("\n") : "",

    // RIGHT COLUMN: Batch # and Variety
    `^FO${textRightX},${M + mm(2)}`,
    `^CF0,${fBatch}`,
    `^FB${textRightW},1,0,L,0`,
    `^FD#${escapeZpl(String(batchNumber))}^FS`,

    `^FO${textRightX},${M + mm(16)}`,
    `^CF0,${fVar}`,
    `^FB${textRightW},2,0,L,0`,
    `^FD${escapeZpl(variety)}^FS`,

    "^XZ",
  ].filter(Boolean).join("\n");
}

export function buildZplWithTemplate(
  input: LabelInput, 
  template: LabelTemplate,
  copies: number = 1
): string {
  const { batchNumber, variety, family, quantity, size, location, payload } = input;
  const dmPayload = payload ?? `ht:batch:${batchNumber}`;
  
  // If custom ZPL template exists, use it
  if (template.zpl_template) {
    let zpl = template.zpl_template
      .replace(/\{\{batchNumber\}\}/g, escapeZpl(String(batchNumber)))
      .replace(/\{\{variety\}\}/g, escapeZpl(variety))
      .replace(/\{\{family\}\}/g, escapeZpl(family))
      .replace(/\{\{quantity\}\}/g, String(quantity))
      .replace(/\{\{size\}\}/g, escapeZpl(size))
      .replace(/\{\{location\}\}/g, escapeZpl(location || ""))
      .replace(/\{\{payload\}\}/g, escapeZpl(dmPayload));
    
    // Add print quantity if multiple copies
    if (copies > 1) {
      zpl = zpl.replace("^XA", `^XA\n^PQ${copies},0,1,Y`);
    }
    return zpl;
  }

  // Dynamic template based on dimensions
  const customDpmm = template.dpi === 300 ? 12 : template.dpi === 600 ? 24 : 8;
  const W = mm(template.width_mm, customDpmm);
  const H = mm(template.height_mm, customDpmm);
  const M = mm(template.margin_mm, customDpmm);
  const layout = template.layout || {};

  // Compact label (50x30mm or smaller)
  if (template.width_mm <= 50 || template.height_mm <= 30) {
    const dmSize = mm(layout.datamatrix?.size || 16, customDpmm);
    const dmModule = Math.max(3, Math.floor(dmSize / 30));

    return [
      "^XA",
      "^CI28",
      `^PW${W}`,
      `^LL${H}`,
      "^LH0,0",
      copies > 1 ? `^PQ${copies},0,1,Y` : "",

      // Small DataMatrix
      `^FO${M},${M}`,
      `^BXN,${dmSize},${dmModule},2`,
      `^FD${escapeZpl(dmPayload)}^FS`,

      // Variety name (compact)
      `^FO${M + dmSize + mm(2, customDpmm)},${M}`,
      `^CF0,${layout.variety?.fontSize || 28}`,
      `^FB${W - M - dmSize - mm(4, customDpmm)},2,0,L,0`,
      `^FD${escapeZpl(variety)}^FS`,

      // Batch number at bottom
      `^FO${M + dmSize + mm(2, customDpmm)},${M + mm(10, customDpmm)}`,
      `^CF0,${layout.batchNumber?.fontSize || 36}`,
      `^FB${W - M - dmSize - mm(4, customDpmm)},1,0,L,0`,
      `^FD#${escapeZpl(String(batchNumber))}^FS`,

      "^XZ",
    ].filter(Boolean).join("\n");
  }

  // Standard/large label - use default layout
  return buildZpl(input, copies);
}

function escapeZpl(s: string) {
  return s.replace(/[\^\\~]/g, (m) => "\\" + m);
}
