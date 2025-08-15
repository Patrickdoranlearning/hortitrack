// src/server/labels/build-batch-label.ts
// Zebra GT800 (203 dpi). If you ever move to 300 dpi, change DOTS_PER_MM to 12.
const DOTS_PER_MM = 8;

function mm(mm: number) {
  return Math.round(mm * DOTS_PER_MM);
}

// Escape ZPL field data safely. We’ll use ^FH\ (hex mode) + hex-encode risky chars.
function zplEscape(text: string) {
  if (text === null || text === undefined) return '';
  const needsHex = /[\^\\~]/;
  if (!needsHex.test(text)) return text;
  return text
    .split("")
    .map((ch) => {
      if (ch === "^") return "_5E"; // ^  -> _5E
      if (ch === "\\") return "_5C"; // \  -> _5C
      if (ch === "~") return "_7E"; // ~  -> _7E
      return ch;
    })
    .join("");
}

/**
 * Build a landscape ZPL for 70mm (width) x 50mm (height) label
 * with a 3mm border and a Data Matrix on the left.
 */
export function buildBatchLabelZplLandscape(params: {
  batchNumber: string | number;
  variety: string;
  family: string;
  quantity: number;
  size: string;
  // What the scanner should read:
  dataMatrixPayload: string; // e.g. `BATCH:12345` (match your app’s scanner)
  // Optional tweaks
  labelWidthMM?: number;   // default 70
  labelHeightMM?: number;  // default 50
  marginMM?: number;       // default 3
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
  } = params;

  // Convert to dots
  const PW = mm(labelWidthMM);   // print width (across printhead) — 70mm => 560 dots
  const LL = mm(labelHeightMM);  // label length (feed direction) — 50mm => 400 dots
  const M  = mm(marginMM);       // 3mm => 24 dots

  // Inner working area after margins
  const innerW = PW - M * 2;     // 560 - 48 = 512
  const innerH = LL - M * 2;     // 400 - 48 = 352

  // Data Matrix square: occupy up to inner height, but not more than ~45% of inner width
  const dmMax = Math.min(innerH, Math.floor(innerW * 0.45)); // e.g. 352 vs 230 → 230
  const dmSize = dmMax;          // make it square

  // Gutter between DM and text
  const gutter = mm(2);          // 2mm spacing

  // Text block geometry
  const textX = M + dmSize + gutter;
  const textY = M;
  const textW = innerW - dmSize - gutter;  // remaining width to the right
  const lineGap = mm(1.5);                 // 1.5mm vertical spacing between text blocks

  // Font sizes (in dots) — tuned to “maximize” while staying readable & consistent
  // Feel free to tweak these if your strings are usually short/long.
  const batchFont = 70; // Batch # headline
  const varietyFont = 58; // Variety (wrapped up to 2 lines)
  const infoFont = 36; // Family + Qty/Size

  // Compute Y positions
  let y = textY;

  // Build ZPL
  let zpl = "^XA\n";
  zpl += `^PW${PW}\n`;
  zpl += `^LL${LL}\n`;
  zpl += "^LH0,0\n";      // Label Home at top-left
  zpl += "^CI28\n";       // UTF-8/Unicode mode if supported

  // --- Data Matrix (left) ---
  // Position: top-left inside margin
  const dmX = M;
  const dmY = M;

  // ^BX – Data Matrix. Second param is module size (1–10+), we choose ~7 for dense but readable.
  // Third param is symbol height in dots (we let Zebra scale from module size and data length).
  // We’ll constrain size by putting it inside a graphic box clipping. Easiest is to size via module.
  // If you need a hard pixel size, switch to ^BX with a tuned module or use ^FO + ^GB as border only.
  zpl += `^FO${dmX},${dmY}\n`;
  zpl += "^BY2\n";               // (Not used by ^BX, but harmless; keeps consistency if you ever swap types)
  zpl += "^BXN,7,200\n";         // N=normal orientation, module=7, 200 ECC
  zpl += "^FH\\\n";              // hex mode for safe data
  zpl += `^FD${zplEscape(String(dataMatrixPayload))}^FS\n`;

  // Optional: a visual bounding box for the DM zone (comment out if not wanted)
  // zpl += `^FO${dmX - 2},${dmY - 2}^GB${dmSize + 4},${dmSize + 4},2^FS\n`;

  // --- Batch # (headline) ---
  zpl += `^FO${textX},${y}^CF0,${batchFont}\n`;
  zpl += "^FH\\\n";
  zpl += `^FD#${zplEscape(String(batchNumber))}^FS\n`;
  y += batchFont + lineGap;

  // --- Variety (wrapped up to 2 lines) ---
  zpl += `^FO${textX},${y}^CF0,${varietyFont}\n`;
  zpl += `^FB${textW},2,0,L,0\n`; // width=textW, max 2 lines, 0 gap, Left, no hanging indent
  zpl += "^FH\\\n";
  zpl += `^FD${zplEscape(variety)}^FS\n`;
  y += varietyFont * 2 + lineGap; // reserve space as if 2 lines (safe)

  // --- Family ---
  zpl += `^FO${textX},${y}^CF0,${infoFont}\n`;
  zpl += "^FH\\\n";
  zpl += `^FDFamily: ${zplEscape(family)}^FS\n`;
  y += infoFont + lineGap;

  // --- Qty + Size ---
  zpl += `^FO${textX},${y}^CF0,${infoFont}\n`;
  zpl += "^FH\\\n";
  zpl += `^FDQty: ${zplEscape(String(quantity))}   Size: ${zplEscape(size)}^FS\n`;

  zpl += "^XZ\n";
  return zpl;
}
