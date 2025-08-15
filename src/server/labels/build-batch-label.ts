
// src/server/labels/build-batch-label.ts
// Helper: mm → dots @ 203dpi
const dpmm = 8;
const mm = (n: number) => Math.round(n * dpmm);

type LabelInput = {
  batchNumber: string | number;
  variety: string;
  family: string;
  quantity: number;
  size: string;
  payload?: string; // DM content; default "BATCH:<batchNumber>"
};

export function buildZpl({ batchNumber, variety, family, quantity, size, payload }: LabelInput) {
  // Canvas
  const W = mm(70); // 560
  const H = mm(50); // 400
  const M = mm(3);  // 24
  const innerW = W - 2 * M; // 512
  const innerH = H - 2 * M; // 352

  // Left column for DM ~ 24mm
  const dmBox = { x: M, y: M, w: mm(24), h: mm(24) };
  // Right text area
  const textX = dmBox.x + dmBox.w + mm(2);
  const textW = W - textX - M;

  // Font choices (Zebra device fonts; ^CF0 is scalable)
  // Sizes tuned by eye to fit 44mm height:
  const fBatch = 72;  // big
  const fVar   = 48;  // medium
  const fInfo  = 32;  // small

  const dmHeight = dmBox.h;
  const module   = 6;
  const dmText   = payload ?? `BATCH:${batchNumber}`;

  return [
    "^XA",
    `^CI28`,
    `^PW${W}`,
    `^LL${H}`,
    "^LH0,0",

    // Data Matrix on left
    `^FO${dmBox.x},${dmBox.y}`,
    `^BXN,${dmHeight},${module},2`,
    `^FD${escapeZpl(dmText)}^FS`,

    // Batch number (top line)
    `^FO${textX},${M}`,
    `^CF0,${fBatch}`,
    `^FB${textW},1,0,L,0`,
    `^FD#${escapeZpl(String(batchNumber))}^FS`,

    // Variety
    `^FO${textX},${M + mm(12) + 10}`,
    `^CF0,${fVar}`,
    `^FB${textW},2,0,L,0`,
    `^FD${escapeZpl(variety)}^FS`,

    // Family
    `^FO${textX},${M + mm(24) + 10}`,
    `^CF0,${fInfo}`,
    `^FB${textW},1,0,L,0`,
    `^FDFamily: ${escapeZpl(family)}^FS`,

    // Qty & Size
    `^FO${textX},${M + mm(31) + 10}`,
    `^CF0,${fInfo}`,
    `^FB${textW},1,0,L,0`,
    `^FDQty: ${quantity}    Size: ${escapeZpl(size)}^FS`,

    "^XZ",
  ].join("\n");
}

function escapeZpl(s: string) {
  return s.replace(/[\^\\~]/g, (m) => "\\" + m);
}
