/* eslint-disable no-restricted-globals */
import { readBarcodes, type ReaderOptions, setZXingModuleOverrides } from "zxing-wasm/reader";

// Load wasm from /public/zxing; copy script runs on postinstall
setZXingModuleOverrides({ locateFile: (path: string) => `/zxing/${path}` });

const options: ReaderOptions = {
  tryHarder: true,
  tryInvert: true,
  tryDownscale: true,
  maxNumberOfSymbols: 1,
  formats: ["DataMatrix", "QRCode"],
  textMode: "Plain",
};

(self as any).postMessage({ type: "READY", ok: true });

self.onmessage = async (ev: MessageEvent) => {
  const { type, imageData } = (ev.data || {}) as { type?: string; imageData?: ImageData };
  try {
    if (type === "PING") { (self as any).postMessage({ type: "PONG", ok: true }); return; }
    if (type !== "DECODE" || !imageData) { (self as any).postMessage({ ok: false, error: "bad-message" }); return; }

    const t0 = Date.now();
    const results = await readBarcodes(imageData, options);
    const first = results.find((r) => !r.error && r.text) || results[0];
    if (first?.text) {
      (self as any).postMessage({ ok: true, result: { text: first.text, format: first.format, ms: Date.now() - t0 } });
    } else {
      (self as any).postMessage({ ok: false, error: first?.error || "not-found" });
    }
  } catch (e: any) {
    (self as any).postMessage({ ok: false, error: e?.message || "decode-failed" });
  }
};
