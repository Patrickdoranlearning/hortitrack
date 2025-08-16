
// src/server/labels/build-batch-label.ts
const dpmm = 8; // 203dpi ≈ 8 dots/mm
const mm = (n: number) => Math.round(n * dpmm);

type LabelInput = {
  batchNumber: string | number;
  variety: string;
  family: string;
  quantity: number;
  size: string;
  payload?: string; // DataMatrix content
};

export function buildZpl({ batchNumber, variety, family, quantity, size, payload }: LabelInput) {
  const dmPayload = payload ?? `ht:batch:${batchNumber}`;
  // Label size: 70x50mm, margin 3mm
  const W = mm(70); // 560
  const H = mm(50); // 400
  const M = mm(3);  // 24
  const innerW = W - 2 * M; // 512
  const innerH = H - 2 * M; // 352

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

    // Data Matrix top-left
    `^FO${M},${M}`,
    `^BXN,${dmSide},${dmModule},2`,
    `^FD${escapeZpl(dmPayload)}^FS`,

    // Details BELOW the Data Matrix (Family / Size / Qty)
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
  ].join("\n");
}

function escapeZpl(s: string) {
  return s.replace(/[\^\\~]/g, (m) => "\\" + m);
}
