
/* eslint-disable no-restricted-globals */
import { BarcodeReader, BarcodeFormat, DecodeHintType } from "zxing-wasm";

let reader: BarcodeReader | null = null;

async function ensureReader() {
  if (reader) return reader;
  reader = await BarcodeReader.createInstance();
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.DATA_MATRIX, BarcodeFormat.QR_CODE]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  hints.set(DecodeHintType.ASSUME_GS1, true);
  hints.set(DecodeHintType.ALSO_INVERTED, true); // supports light-on-dark labels
  reader.setHints(hints);
  return reader;
}

self.onmessage = async (ev: MessageEvent) => {
  const { type, imageData } = ev.data || {};
  try {
    if (type !== "DECODE" || !imageData) {
      (self as any).postMessage({ ok: false, error: "bad-message" });
      return;
    }
    const r = await ensureReader();
    const started = Date.now();
    const result = r.decodeBitmap(imageData); // throws if none
    const elapsed = Date.now() - started;
    (self as any).postMessage({
      ok: true,
      result: { text: result.text, format: result.barcodeFormat, ms: elapsed },
    });
  } catch (e: any) {
    (self as any).postMessage({ ok: false, error: e?.message || "decode-failed" });
  }
};
