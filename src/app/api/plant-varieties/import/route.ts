export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/server/db/supabase";
import { withApiGuard } from "@/server/http/guard";

type CsvRow = Record<string, unknown> & { id?: string; name?: string };

type ResultEntry = {
  index: number;
  id?: string;
  name?: string;
  matchedBy?: "id" | "name";
  op?: "create" | "update";
  error?: string;
};

const TRUE_SET = new Set(["true", "t", "1", "yes", "y"]);
const FALSE_SET = new Set(["false", "f", "0", "no", "n"]);

const stringOrNull = (value: unknown) => {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
};

const normalizeName = (value: unknown) => stringOrNull(value) ?? "";

const normalizeBool = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;
  if (value == null) return null;
  const match = String(value).trim().toLowerCase();
  if (TRUE_SET.has(match)) return true;
  if (FALSE_SET.has(match)) return false;
  return null;
};

const normalizeRating = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const int = Math.round(num);
  return int >= 1 && int <= 6 ? int : null;
};

async function findVarietyByName(
  supabase: SupabaseClient,
  name: string
): Promise<{ id: string; name: string } | null> {
  const { data, error } = await supabase
    .from("plant_varieties")
    .select("id, name")
    .ilike("name", name)
    .limit(2);

  if (error) throw error;
  if (!data || data.length === 0) return null;
  if (data.length > 1) {
    throw new Error(
      `Multiple existing varieties match "${name}". Please resolve duplicates before importing.`
    );
  }
  return data[0];
}

function buildPayload(row: CsvRow, targetId: string | null, name: string) {
  const payload: Record<string, unknown> = {
    name,
    family: stringOrNull(row.family),
    genus: stringOrNull(row["genus"]),
    species: stringOrNull(row["species"]),
    category: stringOrNull(row.category ?? row["Category"]),
    colour: stringOrNull(row["colour"]),
    common_name: stringOrNull(row.commonName ?? row["common_name"]),
    grouping: stringOrNull(row["grouping"]),
    flowering_period: stringOrNull(row.floweringPeriod ?? row["flowering_period"]),
    flower_colour: stringOrNull(row.flowerColour ?? row["flower_colour"]),
    evergreen: normalizeBool(row.evergreen),
    plant_breeders_rights: normalizeBool(
      row.plantBreedersRights ?? row["plant_breeders_rights"]
    ),
    rating: normalizeRating(row.rating),
    updated_at: new Date().toISOString(),
  };

  if (targetId) {
    payload.id = targetId;
  } else {
    payload.id = randomUUID();
  }

  return payload;
}

export const POST = withApiGuard({
  method: "POST",
  requireRole: "user",
  async handler({ req }) {
    try {
      const form = await req.formData();
      const file = form.get("file");
      const dryRun = (form.get("dryRun") ?? "false").toString() === "true";
      const upsertBy = (form.get("upsertBy") ?? "name").toString().toLowerCase();

      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "CSV file is required (form field 'file')" },
          { status: 400 }
        );
      }

      const text = Buffer.from(await file.arrayBuffer()).toString("utf8");
      const records = parse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as CsvRow[];

      const admin = getSupabaseAdmin();
      const cacheByName = new Map<string, { id: string; name: string } | null>();
      const mutations: Record<string, unknown>[] = [];
      const results: ResultEntry[] = [];

      for (let i = 0; i < records.length; i++) {
        const row = records[i] ?? {};
        const name = normalizeName(row.name);
        const explicitId = stringOrNull(row.id);

        if (upsertBy === "name" && !name) {
          results.push({
            index: i,
            error: "Missing 'name' (required for upsertBy=name)",
          });
          continue;
        }

        if (upsertBy === "id" && !explicitId) {
          results.push({
            index: i,
            name,
            error: "Missing 'id' (required for upsertBy=id)",
          });
          continue;
        }

        let targetId: string | null = null;
        let matchedBy: "id" | "name" = "name";

        if (upsertBy === "id" && explicitId) {
          targetId = explicitId;
          matchedBy = "id";
        } else if (name) {
          const cacheKey = name.toLowerCase();
          let existing = cacheByName.get(cacheKey);
          if (existing === undefined) {
            existing = await findVarietyByName(admin, name);
            cacheByName.set(cacheKey, existing);
          }
          if (existing) {
            targetId = existing.id;
          }
        }

        const payload = buildPayload(row, targetId, name);
        const operation = targetId ? "update" : "create";

        results.push({
          index: i,
          id: payload.id as string,
          name,
          matchedBy,
          op: operation,
        });

        if (!dryRun) {
          mutations.push(payload);
        }
      }

      if (!dryRun && mutations.length) {
        const { error } = await admin.from("plant_varieties").upsert(mutations);
        if (error) throw error;
      }

      const summary = {
        total: records.length,
        created: results.filter((r) => r.op === "create").length,
        updated: results.filter((r) => r.op === "update").length,
        errors: results.filter((r) => r.error).length,
      };

      return NextResponse.json({ ok: true, summary, results });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[varieties/import] error", message);
      return NextResponse.json(
        { error: "Failed to import CSV", details: message },
        { status: 500 }
      );
    }
  },
});
