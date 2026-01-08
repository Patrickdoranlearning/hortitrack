import type { PlantPassport, PassportSource } from "@/types/batch";

/**
 * NOTE: These defaults are used only for client-side previews.
 * The actual passport creation in the database should fetch the producer_code
 * from the organizations table dynamically. See perform_transplant RPC and
 * the API routes in /api/production/batches/ for the server-side implementation.
 */
const DEFAULT_PRODUCER = "UNKNOWN";
const DEFAULT_COUNTRY = "IE";

export function makeInternalPassport(args: {
  family: string | null | undefined;
  ourBatchNumber: string;
  userId?: string | null;
  producerCode?: string | null;  // Pass org's producer_code when available
  countryCode?: string | null;   // Pass org's country_code when available
}): PlantPassport {
  return {
    source: "Internal",
    aFamily: args.family ?? null,
    bProducerCode: args.producerCode ?? DEFAULT_PRODUCER,
    cBatchNumber: args.ourBatchNumber,
    dCountryCode: args.countryCode ?? DEFAULT_COUNTRY,
    createdAt: new Date().toISOString(),
    createdBy: args.userId ?? null,
  };
}

export function makeSupplierPassport(args: {
  family: string | null | undefined;
  producerCode: string | null | undefined;
  supplierBatchNo: string;
  countryCode: string | null | undefined;
  userId?: string | null;
}): PlantPassport {
  return {
    source: "Supplier",
    aFamily: args.family ?? null,
    bProducerCode: args.producerCode ?? DEFAULT_PRODUCER,
    cBatchNumber: args.supplierBatchNo,
    dCountryCode: args.countryCode ?? DEFAULT_COUNTRY,
    createdAt: new Date().toISOString(),
    createdBy: args.userId ?? null,
  };
}

export function isSupplierPassport(passport: PlantPassport) {
  return passport.source === "Supplier";
}
