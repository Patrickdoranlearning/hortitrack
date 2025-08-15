// src/server/labels/build-batch-label.ts
// Tiny ZPL template for a 50mm x 70mm (203dpi) batch label
import { encodeBatchDataMatrixPayload } from "./payload";

type BatchForLabel = {
  id: string;
  batchNumber: string;
  plantVariety: string;
  plantFamily: string;
  size: string;
  initialQuantity: number;
};

type BuildOpts = {
  copies?: number;        // default 1
  module?: number;        // DataMatrix module size (1..10) - tweak for print density
  left?: number;          // left padding in dots
  top?: number;           // top padding in dots
};

export function buildBatchLabelZpl(batch: BatchForLabel, opts: BuildOpts = {}) {
  const PW = 400;   // print width in dots (≈50mm)
  const LL = 560;   // label length in dots (≈70mm)

  const copies = Math.max(1, Math.floor(opts.copies ?? 1));
  const left   = opts.left ?? 20;
  const top    = opts.top ?? 20;
  const mod    = Math.min(10, Math.max(3, Math.floor(opts.module ?? 5))); // DM module size

  const payload = encodeBatchDataMatrixPayload(batch);

  // Layout:
  // - Data Matrix in the top-right
  // - Key text at left
  //
  // ^BX parameters: ^BXo,m,s
  // o = orientation (N = normal)
  // m = module width (1..10)
  // s = rows/height in dots (Zebra lets this act as a target symbol height; we give a roomy value)
  const dmX = 220; // move Data Matrix to right side
  const dmY = top;

  // Fonts: ^A0N,h,w  (h=height, w=width)
  const h1 = 32; // headline size
  const h2 = 26;

  return [
    "^XA",
    "^CI28",                          // UTF-8
    `^PW${PW}`,
    `^LL${LL}`,
    "^LH0,0",
    `^PQ${copies}`,
    // Headline
    `^FO${left},${top}^A0N,${h1},${h1}^FDbatch #${batch.batchNumber}^FS`,
    `^FO${left},${top+40}^A0N,${h2},${h2}^FDVariety: ${batch.plantVariety}^FS`,
    `^FO${left},${top+75}^A0N,${h2},${h2}^FDFamily: ${batch.plantFamily}^FS`,
    `^FO${left},${top+110}^A0N,${h2},${h2}^FDSize: ${batch.size}^FS`,
    `^FO${left},${top+145}^A0N,${h2},${h2}^FDQty: ${batch.initialQuantity}^FS`,
    // Data Matrix (right)
    `^FO${dmX},${dmY}^BXN,${mod},200^FD${payload}^FS`,
    "^XZ",
  ].join("\n");
}
