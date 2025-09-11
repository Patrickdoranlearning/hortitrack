// src/server/labels/build-sale-label.ts
// Pre-pricing label (58x35mm default) – Code128 or EAN-13 compatible.
// Uses ^PQ for quantity.
const dpmm = 8; // 203dpi
const mm = (n: number) => Math.round(n * dpmm);

type Symbology = "code128" | "ean13";
export type SaleLabelInput = {
  productTitle: string;      // e.g., "Veronica 'Blue Bomb'"
  size: string;              // "10.5cm"
  priceText: string;         // "€5.99"
  barcode: string;           // data-to-encode
  symbology?: Symbology;     // default code128
  footerSmall?: string;      // e.g., "Grown in Ireland – Doran Nurseries"
  qty?: number;              // copies to print with ^PQ
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
    `^FO${M},${M}^FB${labelW},1,0,L,0^FD${escape(productTitle)}^FS`,
    // Size
    `^CF0,22`,
    `^FO${M},${lineY}^FD${escape(size)}^FS`,
    // Price
    `^CF0,32`,
    `^FO${M},${priceY}^FD${escape(priceText)}^FS`,
    // Barcode + HRI
    `^BY2,3,60`,
    `^FO${M},${barcodeY}${barcodeCmd}`,
    `^FD${escape(barcode)}^FS`,
    // Footer
    footerSmall
      ? `^CF0,18^FO${M},${footerY}^FB${labelW},1,0,L,0^FD${escape(footerSmall)}^FS`
      : "",
    "^XZ",
  ].filter(Boolean).join("\n");
}

function escape(s: string) {
  return s.replace(/[\^\\~]/g, (m) => "\\" + m);
}
