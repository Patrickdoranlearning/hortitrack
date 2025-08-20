
// src/lib/batches/ids.ts
import { z } from "zod";

/** Domain phases */
export type BatchPhase = "PROPAGATION" | "PLUGS" | "POTTING";

/** Phase → leading digit */
export const phasePrefix = (p: BatchPhase): "1" | "2" | "3" => {
  switch (p) {
    case "PROPAGATION": return "1";
    case "PLUGS":       return "2";
    case "POTTING":     return "3";
  }
};

/** ISO week (Mon-based). Returns [yy, ww] with zero-padding. */
export function computeYYWW(date = new Date(), tz: string = "Europe/Dublin"): { yy: string; ww: string; yyww: string } {
  // Convert to target tz without extra deps
  const fmt = new Intl.DateTimeFormat("en-IE", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric" });
  const parts = fmt.formatToParts(date).reduce<Record<string, number>>((acc, p) => {
    if (p.type === "year" || p.type === "month" || p.type === "day") acc[p.type] = Number(p.value);
    return acc;
  }, {});
  const d = new Date(Date.UTC(parts.year, (parts.month ?? 1) - 1, parts.day ?? 1));

  // ISO week algorithm
  const day = d.getUTCDay() || 7;            // 1..7 (Mon..Sun)
  d.setUTCDate(d.getUTCDate() + 4 - day);    // nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.floor(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7) + 1;

  const year = d.getUTCFullYear();           // ISO week-year
  const yy = String(year % 100).padStart(2, "0");
  const ww = String(week).padStart(2, "0");
  return { yy, ww, yyww: `${yy}${ww}` };
}

/** Format final ID */
export function formatBatchId(phase: BatchPhase, seq: number, at = new Date()): string {
  const { yyww } = computeYYWW(at);
  return `${phasePrefix(phase)}-${yyww}-${String(seq).padStart(5, "0")}`;
}

/** Strict validator */
export const BatchIdSchema = z.string().regex(/^(1|2|3)-\d{4}-\d{5}$/, "Invalid batch id shape");
/** Narrow + semantic checks (week 01..53, seq ≥ 1) */
export function validateBatchId(id: string) {
  BatchIdSchema.parse(id);
  const [, , yyww, seq] = id.match(/^([123])-(\d{4})-(\d{5})$/) || [];
  const ww = Number(yyww?.slice(2));
  if (ww < 1 || ww > 53) throw new Error("Invalid ISO week in batch id");
  if (Number(seq) < 1) throw new Error("Sequence must be ≥ 1");
  return true;
}
