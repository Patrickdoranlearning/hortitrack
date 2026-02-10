export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { withApiGuard } from "@/server/http/guard";
import { getSupabaseAdmin } from "@/server/db/supabase";
import { logger } from "@/server/utils/logger";

function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return "";
  const text = String(val);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const GET = withApiGuard({
  method: "GET",
  requireRole: "user",
  async handler({ req }) {
    try {
      const { searchParams } = new URL(req.url);
      const limit = Math.min(
        Math.max(Number(searchParams.get("limit") ?? 5000), 1),
        20000
      );

      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("plant_varieties")
        .select("*")
        .order("name", { ascending: true })
        .limit(limit);

      if (error) throw error;

      const header = [
        "id",
        "name",
        "family",
        "category",
        "commonName",
        "rating",
        "floweringPeriod",
        "flowerColour",
        "evergreen",
        "updatedAt",
        "createdAt",
      ];

      const rows = (data ?? []).map((v) =>
        [
          csvEscape(v.id),
          csvEscape(v.name),
          csvEscape(v.family),
          csvEscape(v.category),
          csvEscape(v.common_name),
          csvEscape(v.rating),
          csvEscape(v.flowering_period),
          csvEscape(v.flower_colour),
          csvEscape(
            typeof v.evergreen === "boolean" ? (v.evergreen ? "true" : "false") : ""
          ),
          csvEscape(v.updated_at),
          csvEscape(v.created_at),
        ].join(",")
      );

      const csv = [header.join(","), ...rows].join("\n");
      const filename = `plant_varieties_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.api.error("Plant varieties export failed", message);
      return NextResponse.json(
        { error: "Failed to export plant varieties", details: message },
        { status: 500 }
      );
    }
  },
});
