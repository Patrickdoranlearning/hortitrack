/**
 * ZPL Label Builder for Material Lots
 * Generates labels for boxes, bags, pallets of materials
 */

// DPI to dots-per-mm conversion
// 203 DPI = 8 dpmm, 300 DPI = 12 dpmm, 600 DPI = 24 dpmm
const getDpmm = (dpi: number) => (dpi === 300 ? 12 : dpi === 600 ? 24 : 8);
const mm = (n: number, dpmm: number) => Math.round(n * dpmm);

export type LotLabelInput = {
  lotNumber: string;
  lotBarcode: string;
  materialName: string;
  materialPartNumber: string;
  categoryName: string;
  quantity: number;
  uom: string;
  unitType: string;
  unitsPerPackage?: number | null;
  supplierName?: string | null;
  supplierLotNumber?: string | null;
  receivedDate: string;
  expiryDate?: string | null;
  locationName?: string | null;
};

/**
 * Build ZPL for a material lot label
 * Standard size: 70x50mm (same as batch labels)
 *
 * Layout:
 * ┌─────────────────────────────────────────────────┐
 * │  [DM]   MATERIAL NAME (large)                   │
 * │         Part: M-POT-001  |  Category            │
 * │                                                 │
 * │  Box of 500 each                                │
 * │  Supplier: ABC Ltd  |  Supplier Lot: XYZ123     │
 * │  Received: 2026-01-31  |  Location: Warehouse   │
 * │                                                 │
 * │                               LOT: L-M-POT-001-0042 │
 * └─────────────────────────────────────────────────┘
 */
export function buildLotLabelZpl(
  input: LotLabelInput,
  copies: number = 1,
  dpi: number = 300
): string {
  const {
    lotNumber,
    lotBarcode,
    materialName,
    materialPartNumber,
    categoryName,
    quantity,
    uom,
    unitType,
    unitsPerPackage,
    supplierName,
    supplierLotNumber,
    receivedDate,
    expiryDate,
    locationName,
  } = input;

  const dpmm = getDpmm(dpi);

  // Label size: 70x50mm
  const W = mm(70, dpmm);
  const H = mm(50, dpmm);
  const M = mm(2, dpmm);

  // DataMatrix settings
  const dmSide = mm(18, dpmm);
  const dmModule = dpi === 300 ? 10 : dpi === 600 ? 20 : 7;

  // Layout calculations
  const textStartX = M + dmSide + mm(3, dpmm);
  const textWidth = W - textStartX - M;
  const fullWidth = W - M * 2;

  // Fonts
  const fLarge = mm(6, dpmm); // Material name
  const fMedium = mm(4, dpmm); // Info text
  const fSmall = mm(3, dpmm); // Small details
  const fLot = mm(7, dpmm); // Lot number at bottom

  // Vertical positions
  const row1Y = M + mm(1, dpmm); // Material name
  const row2Y = M + mm(8, dpmm); // Part number / category
  const dmBottom = M + dmSide + mm(3, dpmm);
  const row3Y = dmBottom; // Quantity/unit info
  const row4Y = dmBottom + mm(6, dpmm); // Supplier info
  const row5Y = dmBottom + mm(11, dpmm); // Date/location
  const lotY = H - M - mm(7, dpmm); // LOT at bottom

  // Build quantity line (e.g., "Box of 500 each" or "Bag of 50 litre")
  let qtyLine = `${capitalize(unitType)}`;
  if (unitsPerPackage) {
    qtyLine += ` of ${unitsPerPackage}`;
  } else {
    qtyLine += ` - ${quantity}`;
  }
  qtyLine += ` ${uom}`;

  // Build supplier line
  const supplierParts: string[] = [];
  if (supplierName) {
    supplierParts.push(`Supplier: ${supplierName}`);
  }
  if (supplierLotNumber) {
    supplierParts.push(`Lot: ${supplierLotNumber}`);
  }
  const supplierLine = supplierParts.join("  |  ");

  // Build date/location line
  const dateParts: string[] = [];
  dateParts.push(`Received: ${formatDate(receivedDate)}`);
  if (expiryDate) {
    dateParts.push(`Expires: ${formatDate(expiryDate)}`);
  }
  if (locationName) {
    dateParts.push(locationName);
  }
  const dateLine = dateParts.join("  |  ");

  return [
    "^XA",
    "^CI28", // UTF-8 encoding
    `^PW${W}`,
    `^LL${H}`,
    "^LH0,0",
    copies > 1 ? `^PQ${copies},0,1,Y` : "",

    // DataMatrix - top left
    `^FO${M},${M}`,
    `^BXN,${dmModule},200`,
    `^FD${escapeZpl(lotBarcode)}^FS`,

    // Material name - right of DataMatrix, PROMINENT
    `^FO${textStartX},${row1Y}`,
    `^A0N,${fLarge},${fLarge}`,
    `^FB${textWidth},2,0,L,0`,
    `^FD${escapeZpl(materialName)}^FS`,

    // Part number | Category - right of DataMatrix, below name
    `^FO${textStartX},${row2Y}`,
    `^A0N,${fSmall},${fSmall}`,
    `^FB${textWidth},1,0,L,0`,
    `^FD${escapeZpl(materialPartNumber)}  |  ${escapeZpl(categoryName)}^FS`,

    // Quantity/unit line - below DM
    `^FO${M},${row3Y}`,
    `^A0N,${fMedium},${fMedium}`,
    `^FD${escapeZpl(qtyLine)}^FS`,

    // Supplier line (if present)
    supplierLine
      ? [
          `^FO${M},${row4Y}`,
          `^A0N,${fSmall},${fSmall}`,
          `^FD${escapeZpl(supplierLine)}^FS`,
        ].join("\n")
      : "",

    // Date/location line
    `^FO${M},${row5Y}`,
    `^A0N,${fSmall},${fSmall}`,
    `^FD${escapeZpl(dateLine)}^FS`,

    // LOT number - LARGE at bottom, right-aligned
    `^FO${M},${lotY}`,
    `^A0N,${fLot},${fLot}`,
    `^FB${fullWidth},1,0,R,0`,
    `^FDLOT: ${escapeZpl(lotNumber)}^FS`,

    "^XZ",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Build a compact lot label (50x30mm)
 * For smaller label printers or when space is limited
 */
export function buildCompactLotLabelZpl(
  input: LotLabelInput,
  copies: number = 1,
  dpi: number = 300
): string {
  const { lotNumber, lotBarcode, materialName, quantity, uom, unitType } = input;

  const dpmm = getDpmm(dpi);

  // Label size: 50x30mm
  const W = mm(50, dpmm);
  const H = mm(30, dpmm);
  const M = mm(1, dpmm);

  // Smaller DataMatrix
  const dmSide = mm(12, dpmm);
  const dmModule = dpi === 300 ? 6 : dpi === 600 ? 12 : 4;

  // Layout
  const textStartX = M + dmSide + mm(2, dpmm);
  const textWidth = W - textStartX - M;

  // Fonts
  const fName = mm(4, dpmm);
  const fInfo = mm(3, dpmm);
  const fLot = mm(5, dpmm);

  // Build quantity text
  const qtyText = `${capitalize(unitType)} - ${quantity} ${uom}`;

  return [
    "^XA",
    "^CI28",
    `^PW${W}`,
    `^LL${H}`,
    "^LH0,0",
    copies > 1 ? `^PQ${copies},0,1,Y` : "",

    // DataMatrix
    `^FO${M},${M}`,
    `^BXN,${dmModule},200`,
    `^FD${escapeZpl(lotBarcode)}^FS`,

    // Material name
    `^FO${textStartX},${M}`,
    `^A0N,${fName},${fName}`,
    `^FB${textWidth},2,0,L,0`,
    `^FD${escapeZpl(materialName)}^FS`,

    // Quantity
    `^FO${textStartX},${M + mm(9, dpmm)}`,
    `^A0N,${fInfo},${fInfo}`,
    `^FD${escapeZpl(qtyText)}^FS`,

    // Lot number at bottom
    `^FO${M},${H - M - mm(6, dpmm)}`,
    `^A0N,${fLot},${fLot}`,
    `^FB${W - M * 2},1,0,R,0`,
    `^FD${escapeZpl(lotNumber)}^FS`,

    "^XZ",
  ]
    .filter(Boolean)
    .join("\n");
}

// Helper functions
function escapeZpl(s: string): string {
  return s.replace(/[\^\\~]/g, (m) => "\\" + m);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toISOString().split("T")[0];
  } catch {
    return dateStr;
  }
}
