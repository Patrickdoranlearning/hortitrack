// src/lib/passport.ts
import type { BatchSummary } from "@/types/batch";

export type ComputedPassport = {
  aFamily: string | null;
  bProducerCode: string | null;
  cBatchNumber: string;
  dCountryCode: string | null;
  warnings: string[];
};

/**
 * Computes A–D passport fields without extra API calls.
 * Tolerates older field names and incomplete supplier data.
 */
export function computePassportFromBatch(
  batch: Partial<BatchSummary> & Record<string, any>,
  opts?: { fallbackProducer?: string; fallbackCountry?: string }
): ComputedPassport {
  const fallbackProducer =
    opts?.fallbackProducer ?? "IE2727 Doran Nurseries Producer Code";
  const fallbackCountry = opts?.fallbackCountry ?? "IE";

  const aFamily =
    (batch.family ?? batch.plantFamily ?? batch.varietyFamily ?? null) as string | null;

  const cBatchNumber =
    (batch.batchNumber ?? batch.batch_number ?? batch.id ?? "—") as string;

  // Supplier can be embedded or referenced/flattened
  const supplier = (batch.supplier ?? batch.supplierData ?? {}) as Record<string, any>;

  let bProducerCode = (supplier.producerCode ?? null) as string | null;
  let dCountryCode = (supplier.countryCode ?? null) as string | null;

  const warnings: string[] = [];
  if (!bProducerCode) {
    bProducerCode = fallbackProducer;
    warnings.push("B defaulted to fallback producer code.");
  }
  if (!dCountryCode) {
    dCountryCode = fallbackCountry;
    warnings.push("D defaulted to fallback country code.");
  }

  return {
    aFamily,
    bProducerCode,
    cBatchNumber,
    dCountryCode,
    warnings,
  };
}
