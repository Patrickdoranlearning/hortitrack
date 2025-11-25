export const runtime = "nodejs";
import { NextRequest } from "next/server";
import net from "net";
import { ok, fail } from "@/server/utils/envelope";
import { supabaseAdmin } from "@/server/db/supabaseAdmin";
import { buildSaleLabelZpl } from "@/server/labels/build-sale-label";

const PRINTER_HOST = process.env.PRINTER_HOST!;
const PRINTER_PORT = Number(process.env.PRINTER_PORT || 9100);

export async function POST(_: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    if (!PRINTER_HOST) return fail(500, "printer_not_configured", "PRINTER_HOST is missing.");

    const orderId = params.orderId;
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("sales_orders")
      .select("id")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) return fail(404, "not_found", "Order not found.");

    const { data: lines, error: linesErr } = await supabaseAdmin
      .from("sales_order_lines")
      .select("*")
      .eq("order_id", orderId);

    if (linesErr || !lines || lines.length === 0) return fail(400, "no_lines", "Order has no lines.");

    // MVP label rule: 1 label per plant (per unit)
    const zpls: string[] = [];
    lines.forEach((line) => {
      const qty = Number(line?.allocations?.reduce((a: number, b: any) => a + (b.qty || 0), 0)) || Number(line.qty) || 0;
      if (qty <= 0) return;

      // Encoded barcode preference (MVP: internal SKU pattern: "PLU-" + variety + "-" + size)
      const barcode = `PLU:${String(line.plant_variety_id)}|${String(line.size_id)}`.slice(0, 40);

      const zpl = buildSaleLabelZpl({
        productTitle: String(line.plant_variety_id),
        size: String(line.size_id),
        priceText: line.unit_price != null ? `€${Number(line.unit_price).toFixed(2)}` : "€0.00",
        barcode,
        symbology: "code128",
        footerSmall: "Grown in Ireland – Doran Nurseries",
        qty,
      });
      zpls.push(zpl);
    });

    if (zpls.length === 0) return fail(400, "nothing_to_print", "No printable labels.");

    // Send one concatenated job (Zebra accepts back-to-back ^XA/^XZ)
    const payload = zpls.join("\n");

    await sendRawToPrinter(payload);
    return ok({ printed: zpls.length });
  } catch (err: any) {
    console.error("[sales:labels:print] error", err);
    return fail(500, "server_error", err?.message ?? "Printer error");
  }
}

function sendRawToPrinter(data: string) {
  return new Promise<void>((resolve, reject) => {
    const client = new net.Socket();
    client.connect(PRINTER_PORT, PRINTER_HOST, () => {
      client.write(data, "utf8", () => client.end());
    });
    client.on("close", () => resolve());
    client.on("error", (e) => reject(e));
    client.setTimeout(10_000, () => {
      client.destroy();
      reject(new Error("Printer connection timed out"));
    });
  });
}
