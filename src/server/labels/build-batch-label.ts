
// src/server/labels/build-batch-label.ts

// DPI to dots-per-mm conversion
// 203 DPI = 8 dpmm, 300 DPI = 12 dpmm, 600 DPI = 24 dpmm
const getDpmm = (dpi: number) => dpi === 300 ? 12 : dpi === 600 ? 24 : 8;
const mm = (n: number, dpmm: number) => Math.round(n * dpmm);

type LabelInput = {
  batchNumber: string | number;
  variety: string;
  family: string;
  quantity: number;
  size: string;
  location?: string;
  payload?: string; // DataMatrix content
};

type LabelLayout = {
  datamatrix?: { size?: number };
  variety?: { fontSize?: number };
  batchNumber?: { fontSize?: number };
};

type LabelTemplate = {
  width_mm: number;
  height_mm: number;
  margin_mm: number;
  dpi: number;
  zpl_template?: string;
  layout?: LabelLayout;
};

type PrinterConfig = {
  dpi: number;
  label_columns?: number;
  label_width_mm?: number;
  label_gap_mm?: number;
};

// Default to 300 DPI (most common for newer Zebra printers)
export function buildZpl(input: LabelInput, copies: number = 1, dpi: number = 300): string {
  const { batchNumber, variety, family, quantity, size, location, payload } = input;
  const dmPayload = payload ?? `ht:batch:${batchNumber}`;

  // Calculate dots-per-mm based on DPI
  const dpmm = getDpmm(dpi);

  // Label size: 70x50mm, small margin to maximize space
  const W = mm(70, dpmm);   // 840 dots at 300dpi
  const H = mm(50, dpmm);   // 600 dots at 300dpi
  const M = mm(2, dpmm);    // 24 dots - smaller margin for more space

  // DataMatrix settings - sized for reliable scanning
  // Module size controls cell size in dots - larger = bigger barcode
  const dmSide = mm(18, dpmm);  // 216 dots at 300dpi (18mm square) - for layout calculations
  const dmModule = dpi === 300 ? 10 : dpi === 600 ? 20 : 7;  // Increased for better scanning

  // Layout calculations
  const textStartX = M + dmSide + mm(3, dpmm);  // Text starts after DM + small gap
  const textWidth = W - textStartX - M;         // Available width for text next to DM
  const fullWidth = W - (M * 2);                // Full width for rows

  // Fonts - optimized for visibility
  const fVar   = mm(7, dpmm);   // 7mm tall - variety name (84 dots) - LARGEST, most important
  const fInfo  = mm(5, dpmm);   // 5mm tall - info text (60 dots)
  const fBatch = mm(9, dpmm);   // 9mm tall - batch number at bottom (108 dots)

  // Vertical positions - DataMatrix and variety at top, batch number at bottom
  const row1Y = M + mm(1, dpmm);               // Variety name (next to DM)
  const row2Y = M + mm(9, dpmm);               // Family name (next to DM, below variety)
  const dmBottom = M + dmSide + mm(2, dpmm);   // Just below DataMatrix
  const row3Y = dmBottom;                      // Size | Qty | Location (compact row)
  const batchY = H - M - mm(9, dpmm);          // Batch # at bottom, large

  // Build compact info line - avoid colons which can cause issues with some printers
  const infoItems = [size, `Qty ${quantity}`];
  if (location) infoItems.push(location);
  const infoLine = infoItems.join("  /  ");

  return [
    "^XA",
    "^CI28",                             // UTF-8 encoding
    `^PW${W}`,                           // Print width
    `^LL${H}`,                           // Label length
    "^LH0,0",                            // Home position
    copies > 1 ? `^PQ${copies},0,1,Y` : "",

    // DataMatrix - top left
    `^FO${M},${M}`,
    `^BXN,${dmModule},200`,
    `^FD${escapeZpl(dmPayload)}^FS`,

    // Variety name - right of DataMatrix, PROMINENT (most important text)
    `^FO${textStartX},${row1Y}`,
    `^A0N,${fVar},${fVar}`,
    `^FB${textWidth},2,0,L,0`,
    `^FD${escapeZpl(variety)}^FS`,

    // Family/botanical name - right of DataMatrix, below variety
    `^FO${textStartX},${row2Y}`,
    `^A0N,${fInfo},${fInfo}`,
    `^FB${textWidth},1,0,L,0`,
    `^FD${escapeZpl(family)}^FS`,

    // Size | Qty | Location - compact info line below DM
    // Using direct field placement instead of field block for better compatibility
    `^FO${M},${row3Y}`,
    `^A0N,${fInfo},${fInfo}`,
    `^FD${escapeZpl(infoLine)}^FS`,

    // Batch # - LARGE at bottom, full width, right-aligned
    `^FO${M},${batchY}`,
    `^A0N,${fBatch},${fBatch}`,
    `^FB${fullWidth},1,0,R,0`,
    `^FD#${escapeZpl(String(batchNumber))}^FS`,

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
  
  // NOTE: Custom ZPL templates are disabled for now - using dynamic generation instead
  // to ensure consistent layout with DataMatrix. Re-enable when templates are properly configured.
  // if (template.zpl_template) {
  //   const rendered = renderTemplate(template.zpl_template, {
  //     batchNumber: escapeZpl(String(batchNumber)),
  //     variety: escapeZpl(variety),
  //     family: escapeZpl(family),
  //     quantity: String(quantity),
  //     size: escapeZpl(size),
  //     location: escapeZpl(location ?? ""),
  //     payload: escapeZpl(dmPayload),
  //   });
  //   if (copies > 1) {
  //     return injectPrintQuantity(rendered, copies);
  //   }
  //   return rendered;
  // }

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

  // Standard/large label - use default layout with template's DPI
  return buildZpl(input, copies, template.dpi || 300);
}

function escapeZpl(s: string) {
  return s.replace(/[\^\\~]/g, (m) => "\\" + m);
}

const TOKEN_REGEX = /\{\{([a-zA-Z0-9_]+)\}\}/g;
const ALLOWED_TOKENS = new Set([
  "batchNumber",
  "variety",
  "family",
  "quantity",
  "size",
  "location",
  "payload",
]);

function renderTemplate(template: string, values: Record<string, string>) {
  return template.replace(TOKEN_REGEX, (_match, token) => {
    if (!ALLOWED_TOKENS.has(token)) {
      return _match;
    }
    return values[token] ?? "";
  });
}

function injectPrintQuantity(zpl: string, copies: number) {
  if (/^(\^XA)/m.test(zpl)) {
    return zpl.replace(/^(\^XA)/m, `$1\n^PQ${copies},0,1,Y`);
  }
  return `^XA\n^PQ${copies},0,1,Y\n${zpl}`;
}

/**
 * Build ZPL for multi-column label printing (e.g., 2-across labels)
 * This generates the content for a single label at a specific column position
 */
export function buildZplMultiColumn(
  input: LabelInput,
  printer: PrinterConfig,
  column: number = 0,
  copies: number = 1
): string {
  const { batchNumber, variety, family, quantity, size, location, payload } = input;
  const dmPayload = payload ?? `ht:batch:${batchNumber}`;

  const dpi = printer.dpi || 300;
  const labelWidthMm = printer.label_width_mm || 50;
  const labelGapMm = printer.label_gap_mm || 3;
  const columns = printer.label_columns || 1;

  // Calculate dots-per-mm based on DPI
  const dpmm = getDpmm(dpi);

  // Individual label dimensions
  const W = mm(labelWidthMm, dpmm);
  const H = mm(35, dpmm);  // Typical height for 2-across labels (~35mm)
  const M = mm(1, dpmm);   // Tight margin for small labels

  // Calculate X offset for this column
  const columnOffset = column * (W + mm(labelGapMm, dpmm));

  // Total print width (all columns + gaps)
  const totalWidth = columns * W + (columns - 1) * mm(labelGapMm, dpmm);

  // DataMatrix settings - smaller for compact labels
  const dmSide = mm(12, dpmm);  // 12mm square DataMatrix
  const dmModule = dpi === 300 ? 5 : dpi === 600 ? 10 : 4;

  // Layout calculations relative to column offset
  const textStartX = columnOffset + M + dmSide + mm(2, dpmm);
  const textWidth = W - M - dmSide - mm(4, dpmm);

  // Fonts - compact for small labels
  const fVar   = mm(4, dpmm);   // 4mm - variety
  const fInfo  = mm(3, dpmm);   // 3mm - info text
  const fBatch = mm(5, dpmm);   // 5mm - batch number

  // Vertical positions
  const row1Y = M;
  const row2Y = M + mm(5, dpmm);
  const row3Y = M + mm(9, dpmm);
  const batchY = H - M - mm(6, dpmm);

  // Build compact info - avoid colons
  const infoLine = `${size}  /  Qty ${quantity}`;

  // Only include header/footer ZPL commands for first column (column 0)
  const isFirstColumn = column === 0;
  const isLastColumn = column === columns - 1;

  const zplParts = [];

  // Start label (only for first column)
  if (isFirstColumn) {
    zplParts.push(
      "^XA",
      "^CI28",
      `^PW${totalWidth}`,
      `^LL${H}`,
      "^LH0,0"
    );
  }

  // DataMatrix
  zplParts.push(
    `^FO${columnOffset + M},${M}`,
    `^BXN,${dmModule},200`,
    `^FD${escapeZpl(dmPayload)}^FS`
  );

  // Variety name
  zplParts.push(
    `^FO${textStartX},${row1Y}`,
    `^A0N,${fVar},${fVar}`,
    `^FB${textWidth},1,0,L,0`,
    `^FD${escapeZpl(variety)}^FS`
  );

  // Family name
  zplParts.push(
    `^FO${textStartX},${row2Y}`,
    `^A0N,${fInfo},${fInfo}`,
    `^FB${textWidth},1,0,L,0`,
    `^FD${escapeZpl(family)}^FS`
  );

  // Info line
  zplParts.push(
    `^FO${textStartX},${row3Y}`,
    `^A0N,${fInfo},${fInfo}`,
    `^FB${textWidth},1,0,L,0`,
    `^FD${escapeZpl(infoLine)}^FS`
  );

  // Batch number at bottom
  zplParts.push(
    `^FO${columnOffset + M},${batchY}`,
    `^A0N,${fBatch},${fBatch}`,
    `^FB${W - M * 2},1,0,R,0`,
    `^FD#${escapeZpl(String(batchNumber))}^FS`
  );

  // End label (only for last column)
  if (isLastColumn) {
    if (copies > 1) {
      zplParts.push(`^PQ${copies},0,1,Y`);
    }
    zplParts.push("^XZ");
  }

  return zplParts.filter(Boolean).join("\n");
}

/**
 * Build ZPL for a complete row of multi-column labels (same content on all columns)
 */
export function buildZplRow(
  input: LabelInput,
  printer: PrinterConfig,
  copies: number = 1
): string {
  const columns = printer.label_columns || 1;

  if (columns === 1) {
    // Single column - use regular buildZpl
    return buildZpl(input, copies, printer.dpi || 300);
  }

  // Multi-column - build all columns in one label
  const zplParts: string[] = [];

  for (let col = 0; col < columns; col++) {
    zplParts.push(buildZplMultiColumn(input, printer, col, col === columns - 1 ? copies : 1));
  }

  return zplParts.join("\n");
}
