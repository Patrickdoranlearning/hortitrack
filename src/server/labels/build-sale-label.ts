// src/server/labels/build-sale-label.ts
// Pre-pricing label – Code128 or EAN-13 compatible.
// Supports template-driven layouts (40x40mm, 70x50mm, etc.)
// Uses ^PQ for quantity/copies.

const dpmm = 8; // 203dpi ≈ 8 dots/mm
const mm = (n: number, customDpmm?: number) => Math.round(n * (customDpmm || dpmm));

type Symbology = "code128" | "ean13";

export type SaleLabelInput = {
  productTitle: string;      // e.g., "Veronica 'Blue Bomb'"
  size: string;              // "10.5cm"
  priceText: string;         // "€5.99"
  barcode: string;           // data-to-encode
  symbology?: Symbology;     // default code128
  footerSmall?: string;      // e.g., "Grown in Ireland – Doran Nurseries"
  qty?: number;              // copies to print with ^PQ
  lotNumber?: string;        // optional batch/lot reference
};

export type SaleLabelTemplate = {
  width_mm: number;
  height_mm: number;
  margin_mm: number;
  dpi: number;
  zpl_template?: string;     // custom ZPL template with {{tokens}}
  layout?: {
    showSize?: boolean;
    showLot?: boolean;
    showFooter?: boolean;
    barcodeHeight?: number;
    titleFontSize?: number;
    priceFontSize?: number;
  };
};

export function buildSaleLabelZpl(input: SaleLabelInput) {
  const {
    productTitle,
    size,
    priceText,
    barcode,
    symbology = "code128",
    footerSmall = "",
    qty = 1,
  } = input;

  const W = mm(58), H = mm(35), M = mm(3);
  const labelW = W - 2*M;
  const titleH = mm(10);
  const lineY = M + titleH + mm(1);
  const priceY = lineY + mm(6);
  const barcodeY = priceY + mm(10);
  const footerY = H - M - mm(5);

  const barcodeCmd =
    symbology === "ean13"
      ? `^BEN,60,Y,N`   // EAN-13
      : `^BCN,60,Y,N,N`; // Code128

  return [
    "^XA",
    `^PW${W}`,
    `^LL${H}`,
    `^LH0,0`,
    `^PQ${Math.max(1, Math.floor(qty))},0,1,Y`, // print quantity
    // Title
    `^CF0,26`,
    `^FO${M},${M}^FB${labelW},1,0,L,0^FD${escapeZpl(productTitle)}^FS`,
    // Size
    `^CF0,22`,
    `^FO${M},${lineY}^FD${escapeZpl(size)}^FS`,
    // Price
    `^CF0,32`,
    `^FO${M},${priceY}^FD${escapeZpl(priceText)}^FS`,
    // Barcode + HRI
    `^BY2,3,60`,
    `^FO${M},${barcodeY}${barcodeCmd}`,
    `^FD${escapeZpl(barcode)}^FS`,
    // Footer
    footerSmall
      ? `^CF0,18^FO${M},${footerY}^FB${labelW},1,0,L,0^FD${escapeZpl(footerSmall)}^FS`
      : "",
    "^XZ",
  ].filter(Boolean).join("\n");
}

function escapeZpl(s: string): string {
  return s.replace(/[\^\\~]/g, (m) => "\\" + m);
}

/**
 * Build sale label ZPL with template support.
 * Handles 40x40mm (compact) and 70x50mm (full) layouts.
 */
export function buildSaleLabelZplWithTemplate(
  input: SaleLabelInput,
  template: SaleLabelTemplate,
  copies: number = 1
): string {
  const {
    productTitle,
    size,
    priceText,
    barcode,
    symbology = "code128",
    footerSmall = "",
    lotNumber,
  } = input;

  // If custom ZPL template exists, use token replacement
  if (template.zpl_template) {
    const rendered = renderTemplate(template.zpl_template, {
      productTitle: escapeZpl(productTitle),
      size: escapeZpl(size),
      priceText: escapeZpl(priceText),
      barcode: escapeZpl(barcode),
      footerSmall: escapeZpl(footerSmall),
      lotNumber: escapeZpl(lotNumber ?? ""),
    });
    if (copies > 1) {
      return injectPrintQuantity(rendered, copies);
    }
    return rendered;
  }

  // Dynamic layout based on template dimensions
  const customDpmm = template.dpi === 300 ? 12 : template.dpi === 600 ? 24 : 8;
  const W = mm(template.width_mm, customDpmm);
  const H = mm(template.height_mm, customDpmm);
  const M = mm(template.margin_mm, customDpmm);
  const labelW = W - 2 * M;
  const layout = template.layout || {};

  const barcodeCmd =
    symbology === "ean13"
      ? `^BEN,${layout.barcodeHeight || 50},Y,N`
      : `^BCN,${layout.barcodeHeight || 50},Y,N,N`;

  // Compact layout for small labels (40x40mm or smaller)
  if (template.width_mm <= 45 && template.height_mm <= 45) {
    return buildCompactLayout({
      W, H, M, labelW, customDpmm,
      productTitle, priceText, barcode, barcodeCmd,
      copies, layout,
    });
  }

  // Full layout for larger labels (70x50mm, etc.)
  return buildFullLayout({
    W, H, M, labelW, customDpmm,
    productTitle, size, priceText, barcode, barcodeCmd,
    footerSmall, lotNumber, copies, layout,
  });
}

/**
 * Compact 40x40mm layout: barcode at top, item name, price
 */
function buildCompactLayout(opts: {
  W: number; H: number; M: number; labelW: number; customDpmm: number;
  productTitle: string; priceText: string; barcode: string; barcodeCmd: string;
  copies: number; layout: SaleLabelTemplate["layout"];
}): string {
  const { W, H, M, labelW, customDpmm, productTitle, priceText, barcode, barcodeCmd, copies, layout } = opts;
  
  const titleFont = layout?.titleFontSize || 24;
  const priceFont = layout?.priceFontSize || 32;
  const barcodeH = layout?.barcodeHeight || 40;
  
  // Vertical positions
  const barcodeY = M;
  const titleY = M + barcodeH + mm(4, customDpmm);
  const priceY = titleY + mm(8, customDpmm);

  return [
    "^XA",
    "^CI28",
    `^PW${W}`,
    `^LL${H}`,
    "^LH0,0",
    copies > 1 ? `^PQ${copies},0,1,Y` : "",

    // Barcode at top (centered)
    `^BY2,2,${barcodeH}`,
    `^FO${M},${barcodeY}${barcodeCmd}`,
    `^FD${escapeZpl(barcode)}^FS`,

    // Product title (2 lines max)
    `^CF0,${titleFont}`,
    `^FO${M},${titleY}^FB${labelW},2,0,C,0^FD${escapeZpl(productTitle)}^FS`,

    // Price (bold, centered)
    `^CF0,${priceFont}`,
    `^FO${M},${priceY}^FB${labelW},1,0,C,0^FD${escapeZpl(priceText)}^FS`,

    "^XZ",
  ].filter(Boolean).join("\n");
}

/**
 * Full 70x50mm layout: item name, size, price, barcode, optional footer/lot
 */
function buildFullLayout(opts: {
  W: number; H: number; M: number; labelW: number; customDpmm: number;
  productTitle: string; size: string; priceText: string; barcode: string; barcodeCmd: string;
  footerSmall: string; lotNumber?: string; copies: number; layout: SaleLabelTemplate["layout"];
}): string {
  const {
    W, H, M, labelW, customDpmm,
    productTitle, size, priceText, barcode, barcodeCmd,
    footerSmall, lotNumber, copies, layout
  } = opts;

  const titleFont = layout?.titleFontSize || 28;
  const priceFont = layout?.priceFontSize || 36;
  const barcodeH = layout?.barcodeHeight || 50;
  const showSize = layout?.showSize !== false;
  const showLot = layout?.showLot !== false && lotNumber;
  const showFooter = layout?.showFooter !== false && footerSmall;

  // Vertical positions
  let currentY = M;
  
  const titleY = currentY;
  currentY += mm(10, customDpmm);
  
  const sizeY = showSize ? currentY : -1;
  if (showSize) currentY += mm(6, customDpmm);
  
  const priceY = currentY;
  currentY += mm(10, customDpmm);
  
  const barcodeY = currentY;
  currentY += barcodeH + mm(2, customDpmm);
  
  const lotY = showLot ? currentY : -1;
  if (showLot) currentY += mm(5, customDpmm);
  
  const footerY = H - M - mm(5, customDpmm);

  const lines: string[] = [
    "^XA",
    "^CI28",
    `^PW${W}`,
    `^LL${H}`,
    "^LH0,0",
    copies > 1 ? `^PQ${copies},0,1,Y` : "",

    // Product title
    `^CF0,${titleFont}`,
    `^FO${M},${titleY}^FB${labelW},2,0,L,0^FD${escapeZpl(productTitle)}^FS`,
  ];

  // Size (optional)
  if (showSize && sizeY >= 0) {
    lines.push(
      `^CF0,22`,
      `^FO${M},${sizeY}^FD${escapeZpl(size)}^FS`
    );
  }

  // Price
  lines.push(
    `^CF0,${priceFont}`,
    `^FO${M},${priceY}^FD${escapeZpl(priceText)}^FS`
  );

  // Barcode
  lines.push(
    `^BY2,3,${barcodeH}`,
    `^FO${M},${barcodeY}${barcodeCmd}`,
    `^FD${escapeZpl(barcode)}^FS`
  );

  // Lot number (optional)
  if (showLot && lotY >= 0) {
    lines.push(
      `^CF0,18`,
      `^FO${M},${lotY}^FDLot: ${escapeZpl(lotNumber!)}^FS`
    );
  }

  // Footer (optional)
  if (showFooter) {
    lines.push(
      `^CF0,18`,
      `^FO${M},${footerY}^FB${labelW},1,0,L,0^FD${escapeZpl(footerSmall)}^FS`
    );
  }

  lines.push("^XZ");
  return lines.filter(Boolean).join("\n");
}

// Token replacement for custom ZPL templates
const TOKEN_REGEX = /\{\{([a-zA-Z0-9_]+)\}\}/g;
const ALLOWED_TOKENS = new Set([
  "productTitle",
  "size",
  "priceText",
  "barcode",
  "footerSmall",
  "lotNumber",
]);

function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(TOKEN_REGEX, (_match, token) => {
    if (!ALLOWED_TOKENS.has(token)) {
      return _match;
    }
    return values[token] ?? "";
  });
}

function injectPrintQuantity(zpl: string, copies: number): string {
  if (/^(\^XA)/m.test(zpl)) {
    return zpl.replace(/^(\^XA)/m, `$1\n^PQ${copies},0,1,Y`);
  }
  return `^XA\n^PQ${copies},0,1,Y\n${zpl}`;
}

// ============================================
// Visual Layout to ZPL Generation
// ============================================

export type LayoutField = {
  id: string;
  type: "text" | "barcode" | "static_text" | "line";
  binding?: string;
  staticText?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  align?: "left" | "center" | "right";
  barcodeType?: "code128" | "datamatrix" | "qr";
};

export type VisualLayout = {
  fields: LayoutField[];
};

export type LabelData = Record<string, string | number | undefined>;

/**
 * Build ZPL from a visual layout (fields array) and data values.
 * This connects the visual template editor to actual ZPL generation.
 */
export function buildZplFromLayout(
  layout: VisualLayout,
  data: LabelData,
  template: { width_mm: number; height_mm: number; margin_mm: number; dpi: number },
  copies: number = 1
): string {
  const customDpmm = template.dpi === 300 ? 12 : template.dpi === 600 ? 24 : 8;
  const W = mm(template.width_mm, customDpmm);
  const H = mm(template.height_mm, customDpmm);

  const lines: string[] = [
    "^XA",
    "^CI28",
    `^PW${W}`,
    `^LL${H}`,
    "^LH0,0",
    copies > 1 ? `^PQ${copies},0,1,Y` : "",
  ];

  // Process each field in the layout
  for (const field of layout.fields) {
    const x = mm(field.x, customDpmm);
    const y = mm(field.y, customDpmm);
    const fieldW = mm(field.width, customDpmm);
    const fieldH = mm(field.height, customDpmm);

    if (field.type === "text") {
      // Get the bound data value
      const value = field.binding ? String(data[field.binding] ?? "") : "";
      if (!value) continue;

      const fontSize = field.fontSize ? Math.round(field.fontSize * (customDpmm / 8) * 2.5) : 24;
      const alignment = field.align === "center" ? "C" : field.align === "right" ? "R" : "L";
      const maxLines = Math.max(1, Math.floor(fieldH / (fontSize * 0.5)));

      lines.push(
        `^CF0,${fontSize}`,
        `^FO${x},${y}^FB${fieldW},${maxLines},0,${alignment},0^FD${escapeZpl(value)}^FS`
      );
    } else if (field.type === "static_text") {
      const value = field.staticText || "";
      if (!value) continue;

      const fontSize = field.fontSize ? Math.round(field.fontSize * (customDpmm / 8) * 2.5) : 24;
      const alignment = field.align === "center" ? "C" : field.align === "right" ? "R" : "L";

      lines.push(
        `^CF0,${fontSize}`,
        `^FO${x},${y}^FB${fieldW},1,0,${alignment},0^FD${escapeZpl(value)}^FS`
      );
    } else if (field.type === "barcode") {
      const value = field.binding ? String(data[field.binding] ?? data.barcode ?? "") : "";
      if (!value) continue;

      const barcodeH = Math.max(20, fieldH);

      if (field.barcodeType === "datamatrix") {
        // Data Matrix
        const dmSize = Math.min(fieldW, fieldH);
        const dmModule = Math.max(3, Math.floor(dmSize / 30));
        lines.push(
          `^FO${x},${y}`,
          `^BXN,${dmSize},${dmModule},2`,
          `^FD${escapeZpl(value)}^FS`
        );
      } else if (field.barcodeType === "qr") {
        // QR Code
        const qrSize = Math.min(fieldW, fieldH);
        lines.push(
          `^FO${x},${y}`,
          `^BQN,2,${Math.max(2, Math.floor(qrSize / 40))}`,
          `^FDQA,${escapeZpl(value)}^FS`
        );
      } else {
        // Code128 (default)
        lines.push(
          `^BY2,3,${barcodeH}`,
          `^FO${x},${y}^BCN,${barcodeH},Y,N,N`,
          `^FD${escapeZpl(value)}^FS`
        );
      }
    } else if (field.type === "line") {
      // Horizontal line
      lines.push(
        `^FO${x},${y}^GB${fieldW},${Math.max(1, mm(0.5, customDpmm))},${Math.max(1, mm(0.5, customDpmm))}^FS`
      );
    }
  }

  lines.push("^XZ");
  return lines.filter(Boolean).join("\n");
}

/**
 * Build ZPL from a template that has visual layout fields.
 * Falls back to legacy layout if no fields array present.
 */
export function buildZplFromTemplateLayout(
  template: SaleLabelTemplate & { layout?: VisualLayout | SaleLabelTemplate["layout"] },
  data: LabelData,
  copies: number = 1
): string {
  // Check if template has visual layout fields
  const layout = template.layout as VisualLayout | undefined;
  if (layout?.fields && Array.isArray(layout.fields) && layout.fields.length > 0) {
    return buildZplFromLayout(layout, data, template, copies);
  }

  // Fall back to legacy template-based generation
  const input: SaleLabelInput = {
    productTitle: String(data.productTitle ?? data.variety ?? ""),
    size: String(data.size ?? ""),
    priceText: String(data.priceText ?? ""),
    barcode: String(data.barcode ?? ""),
    footerSmall: String(data.footerSmall ?? ""),
    lotNumber: data.lotNumber ? String(data.lotNumber) : undefined,
  };

  return buildSaleLabelZplWithTemplate(input, template, copies);
}
