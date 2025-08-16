// NEW - WebWorker
import { BarcodeReader, BarcodeFormat, DecodeHintType } from "zxing-wasm";

let reader: BarcodeReader | null = null;

async function ensureReader() {
  if (reader) return reader;
  reader = await BarcodeReader.createInstance();
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.QR_CODE,
    BarcodeFormat.DATA_MATRIX,
  ]);
  reader.setHints(hints);
  return reader;
}

self.onmessage = async (ev: MessageEvent) => {
  const { type, data } = ev.data || {};
  try {
    if (type === "DECODE") {
      const r = await ensureReader();
      const { imageData } = data;
      const result = r.decodeBitmap(imageData);
      // { text, format, rawBytes }
      (self as any).postMessage({ ok: true, result });
    }
  } catch (e: any) {
    (self as any).postMessage({ ok: false, error: e?.message || "decode-failed" });
  }
};
