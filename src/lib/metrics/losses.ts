
import { z } from "zod";

// Accept slightly messy input and coerce to a clean shape.
const LossEventBase = z.object({
  family: z.string().trim().optional().nullable(),
  quantity: z.coerce.number().nonnegative().optional(), // "3" -> 3, undefined -> 0
  // accept a few timestamp field names
  happenedAt: z.union([z.string(), z.number(), z.date()]).optional(),
  createdAt: z.union([z.string(), z.number(), z.date()]).optional(),
  timestamp: z.union([z.string(), z.number(), z.date()]).optional(),
});

export type LossEvent = {
  family?: string;
  quantity: number;
  date?: Date;
};

function toDate(v: unknown): Date | undefined {
  if (!v) return undefined;
  const d = v instanceof Date ? v : new Date(v as any);
  return isNaN(d.getTime()) ? undefined : d;
}

export const LossEventSchema = LossEventBase.transform((i): LossEvent => ({
  family: i.family ?? undefined,
  quantity: i.quantity ?? 0,
  date: toDate(i.happenedAt ?? i.createdAt ?? i.timestamp),
}));

export const LossEventsSchema = z.array(LossEventSchema).catch([]);

/** Output shape consumed by charts/widgets */
export type LossMetrics = {
  totalLost: number;
  lossByFamily: { label: string; value: number }[];
  last30Days: { date: string; lost: number }[]; // YYYY-MM-DD
};

export function calculateLosses(input: unknown): LossMetrics {
  const events = LossEventsSchema.parse(input);

  let totalLost = 0;
  const familyMap = new Map<string, number>();
  const dayMap = new Map<string, number>();

  for (const e of events) {
    const qty = Number.isFinite(e.quantity) ? (e.quantity as number) : 0;
    totalLost += qty;

    const fam = (e.family && e.family.length ? e.family : "Unknown")!;
    familyMap.set(fam, (familyMap.get(fam) ?? 0) + qty);

    if (e.date) {
      const ymd = e.date.toISOString().slice(0, 10); // UTC YYYY-MM-DD
      dayMap.set(ymd, (dayMap.get(ymd) ?? 0) + qty);
    }
  }

  // Produce sorted arrays for charts
  const lossByFamily = Array.from(familyMap.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // Last 30 days timeline (fill gaps as zero to keep chart stable)
  const last30Days: { date: string; lost: number }[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - i);
    const ymd = d.toISOString().slice(0, 10);
    last30Days.push({ date: ymd, lost: dayMap.get(ymd) ?? 0 });
  }

  return { totalLost, lossByFamily, last30Days };
}
