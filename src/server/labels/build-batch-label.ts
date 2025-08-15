
// src/utils/labels.ts
const DOTS_PER_MM = 8;
const mm = (n: number) => Math.round(n * DOTS_PER_MM);
const sanitize = (s: string) => String(s).replace(/[\^\~\\]/g, " ");

export function buildBatchLabelZplLandscape(opts: {
  batchNumber: string | number;
  variety: string;
  family: string;
  quantity: number;
  size: string;
  dataMatrixPayload?: string;
  marginMM?: number; // default 3
  debugFrame?: boolean;
}) {
  const {
    batchNumber, variety, family, quantity, size,
    dataMatrixPayload,
    marginMM = 3,
    debugFrame = false,
  } = opts;

  // IMPORTANT: Use PW=50mm, LL=70mm and rotate fields 90° via ^FWB.
  const PW = mm(50);
  const LL = mm(70);
  const M = mm(marginMM);
  const innerW = PW - M * 2;
  const innerH = LL - M * 2;

  // Coordinates still use PW×LL grid. With ^FWB, fields are rotated,
  // but you can keep your anchors simple and “mentally” treat it landscape.
  const dmSize = Math.min(innerW, Math.floor(innerH * 0.45)); // a bit conservative
  const gutter = mm(2);
  const textX = M;
  const textY = M + dmSize + gutter; // text appears “to the right” after rotation
  const textW = innerH - dmSize - gutter;

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
  z += "^FWB\n"; // rotate all fields 90° → landscape look on printer that assumes portrait media

  if (debugFrame) {
    z += `^FO${M},${M}^GB${innerW},${innerH},2^FS\n`;
  }

  // DataMatrix “left” (after rotation)
  z += `^FO${M},${M}\n`;
  z += "^BXM,8,200\n";
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
