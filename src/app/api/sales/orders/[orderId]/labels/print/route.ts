export const runtime = "nodejs";
import { NextRequest } from "next/server";
import net from "net";
import { ok, fail } from "@/server/utils/envelope";
import { supabaseAdmin } from "@/server/db/supabaseAdmin";
import { buildSaleLabelZpl } from "@/server/labels/build-sale-label";
import { formatCurrency } from "@/lib/format-currency";
import { logger } from "@/server/utils/logger";

const PRINTER_HOST = process.env.PRINTER_HOST!;
const PRINTER_PORT = Number(process.env.PRINTER_PORT || 9100);

export async function POST(
  _: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    if (!PRINTER_HOST) return fail(500, "printer_not_configured", "PRINTER_HOST is missing.");

    const { orderId } = await params;
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) return fail(404, "not_found", "Order not found.");

    const { data: lines, error: linesErr } = await supabaseAdmin
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    if (linesErr || !lines || lines.length === 0) return fail(400, "no_lines", "Order has no lines.");

    // Look up human-readable variety and size names for labels
    const varietyIds = Array.from(
      new Set(
        lines
          .map((l: any) => l.plant_variety_id)
          .filter((id: unknown): id is string => typeof id === "string")
      )
    );
    const sizeIds = Array.from(
      new Set(
        lines
          .map((l: any) => l.size_id)
          .filter((id: unknown): id is string => typeof id === "string")
      )
    );

    const [{ data: varieties }, { data: sizes }] = await Promise.all([
      varietyIds.length
        ? supabaseAdmin
            .from("plant_varieties")
            .select("id, name")
            .in("id", varietyIds)
        : { data: [] as any[] },
      sizeIds.length
        ? supabaseAdmin
            .from("plant_sizes")
            .select("id, name")
            .in("id", sizeIds)
        : { data: [] as any[] },
    ]);

    const varietyNameById = Object.fromEntries(
      (varieties || []).map((v: any) => [v.id, v.name] as const)
    );
    const sizeNameById = Object.fromEntries(
      (sizes || []).map((s: any) => [s.id, s.name] as const)
    );

    // MVP label rule: 1 label per plant (per unit)
    const zpls: string[] = [];
    lines.forEach((line) => {
      const qty = Number(line?.allocations?.reduce((a: number, b: any) => a + (b.qty || 0), 0)) || Number(line.qty) || 0;
      if (qty <= 0) return;

      const varietyName =
        varietyNameById[String(line.plant_variety_id)] ??
        String(line.plant_variety_name ?? "Unknown variety");
      const sizeName =
        sizeNameById[String(line.size_id)] ??
        String(line.size_name ?? "Unknown size");

      // Encoded barcode preference (MVP: internal SKU pattern based on variety + size)
      const barcode = `PLU:${varietyName}|${sizeName}`.slice(0, 40);

      const zpl = buildSaleLabelZpl({
        productTitle: varietyName,
        size: sizeName,
        priceText: line.unit_price != null ? formatCurrency(Number(line.unit_price)) : formatCurrency(0),
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
    logger.sales.error("Sales label print failed", err);
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
