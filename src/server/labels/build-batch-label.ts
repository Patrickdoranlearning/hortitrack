// utils/labels.ts
const DOTS_PER_MM = 8;
const mm = (n: number) => Math.round(n * DOTS_PER_MM);

// Simple escape; we don’t use ^FH hex mode here to keep things bulletproof
const sanitize = (s: string) => String(s).replace(/[\^\~\\]/g, " ");

export function buildBatchLabelZplLandscape(opts: {
  batchNumber: string | number;
  variety: string;
  family: string;
  quantity: number;
  size: string;
  dataMatrixPayload?: string; // default: BATCH:<batchNumber>
  labelWidthMM?: number;      // default: 70
  labelHeightMM?: number;     // default: 50
  marginMM?: number;          // default: 3
  rotate90?: boolean;         // if true, rotate all fields 90° for “landscape” on some setups
  debugFrame?: boolean;       // draws the 3mm inner frame
}) {
  const {
    batchNumber,
    variety,
    family,
    quantity,
    size,
    dataMatrixPayload,
    labelWidthMM = 70,
    labelHeightMM = 50,
    marginMM = 3,
    rotate90 = false,
    debugFrame = false,
  } = opts;

  const PW = mm(labelWidthMM);
  const LL = mm(labelHeightMM);
  const M  = mm(marginMM);
  const innerW = PW - M*2;
  const innerH = LL - M*2;

  // DM fits left column: up to 45% of text width but not taller than inner height
  const dmSize = Math.min(innerH, Math.floor(innerW * 0.45));
  const gutter = mm(2);

  const textX = M + dmSize + gutter;
  const textY = M;
  const textW = innerW - dmSize - gutter;

  const batchFont   = 70;
  const varietyFont = 58;
  const infoFont    = 36;

  const payload = dataMatrixPayload ?? `BATCH:${batchNumber}`;

  let y = textY;
  let z = "^XA\n";
  z += `^PW${PW}\n`;
  z += `^LL${LL}\n`;
  z += "^LH0,0\n";
  z += "^CI28\n";

  // For sites where the driver/printer expects portrait, rotate fields 90°
  // This keeps math identical; only orientation changes.
  if (rotate90) z += "^FWB\n";  // B = 270° (clockwise)

  if (debugFrame) {
    z += `^FO${M},${M}^GB${innerW},${innerH},2^FS\n`;
  }

  // Data Matrix (use ^BXM — module size, error corr)
  // module size 8 is compact but very readable at 203dpi. Adjust 6–10 if needed.
  z += `^FO${M},${M}\n`;
  z += "^BXM,8,200\n"; // orientation handled by ^FW, module=8, ECC=200
  z += `^FD${sanitize(payload)}^FS\n`;

  // Batch #
  z += `^FO${textX},${y}^CF0,${batchFont}\n`;
  z += `^FD#${sanitize(String(batchNumber))}^FS\n`;
  y += batchFont + mm(1.5);

  // Variety (wrap to 2 lines)
  z += `^FO${textX},${y}^CF0,${varietyFont}\n`;
  z += `^FB${textW},2,0,L,0\n`;
  z += `^FD${sanitize(variety)}^FS\n`;
  y += varietyFont * 2 + mm(1.5);

  // Family
  z += `^FO${textX},${y}^CF0,${infoFont}\n`;
  z += `^FDFamily: ${sanitize(family)}^FS\n`;
  y += infoFont + mm(1.5);

  // Qty + Size
  z += `^FO${textX},${y}^CF0,${infoFont}\n`;
  z += `^FDQty: ${sanitize(String(quantity))}   Size: ${sanitize(size)}^FS\n`;

  z += "^XZ\n";
  return z;
}
