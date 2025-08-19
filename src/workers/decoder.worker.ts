/* eslint-disable no-restricted-globals */
import { readBarcodes, type ReaderOptions } from "zxing-wasm/reader";

// tuned for DM + QR on labels
const options: ReaderOptions = {
  tryHarder: true,
  tryInvert: true,
  tryDownscale: true,
  maxNumberOfSymbols: 1,
  formats: ["DataMatrix", "QRCode"], // string formats, not enums
  textMode: "Plain", // keep raw control chars like GS for GS1
};

self.onmessage = async (ev: MessageEvent) => {
  const { type, imageData } = (ev.data || {}) as { type?: string; imageData?: ImageData };
  if (type !== "DECODE" || !imageData) {
    (self as any).postMessage({ ok: false, error: "bad-message" });
    return;
  }
  const t0 = Date.now();
  try {
    const results = await readBarcodes(imageData, options);
    const first = results.find((r) => !r.error && r.text) || results[0];
    if (first && first.text) {
      (self as any).postMessage({
        ok: true,
        result: { text: first.text, format: first.format, ms: Date.now() - t0 },
      });
    } else {
      (self as any).postMessage({ ok: false, error: first?.error || "not-found" });
    }
  } catch (e: any) {
    (self as any).postMessage({ ok: false, error: e?.message || "decode-failed" });
  }
};
