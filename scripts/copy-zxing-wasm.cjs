
/* Copies zxing-wasm reader .wasm files to public/zxing */
const fs = require("fs");
const path = require("path");

const SRC_DIRS = [
  "node_modules/zxing-wasm/dist/reader",
  "node_modules/zxing-wasm/reader", // alt layout on some versions
  "node_modules/zxing-wasm/dist/es/reader",
];

const DEST = path.join(process.cwd(), "public", "zxing");
fs.mkdirSync(DEST, { recursive: true });

let copied = 0;
for (const dir of SRC_DIRS) {
  const abs = path.join(process.cwd(), dir);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs)) {
    if (!f.endsWith(".wasm")) continue;
    const src = path.join(abs, f);
    const dst = path.join(DEST, f);
    fs.copyFileSync(src, dst);
    copied++;
  }
}
if (!copied) {
  console.warn("[copy-zxing-wasm] No .wasm files found. Check zxing-wasm version/paths.");
} else {
  console.log(`[copy-zxing-wasm] Copied ${copied} wasm file(s) to /public/zxing`);
}
