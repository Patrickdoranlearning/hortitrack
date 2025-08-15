import { NextResponse } from "next/server";
import net from "net";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as null | {
    zpl?: string;
    copies?: number;
    host?: string;
    port?: number;
  };

  const host = body?.host || process.env.ZPL_PRINTER_HOST;
  const port = Number(body?.port || process.env.ZPL_PRINTER_PORT || 9100);
  const copies = Math.max(1, Math.floor(body?.copies ?? 1));
  let zpl = (body?.zpl || "").trim();

  if (!host) return NextResponse.json({ error: "Printer host not configured" }, { status: 400 });
  if (!zpl) return NextResponse.json({ error: "Missing ZPL" }, { status: 400 });

  // Ensure exactly one ^XA ... ^XZ with ^PQ
  zpl = zpl.replace(/^\^XA|\^XZ$/gm, "");
  const payload = `^XA\n^PQ${copies}\n${zpl}\n^XZ\n`;

  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.write(payload);
      socket.end();
    });
    socket.once("error", reject);
    socket.once("close", () => resolve());
  });

  return NextResponse.json({ ok: true });
}
