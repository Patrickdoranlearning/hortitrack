import type { PlantPassport, PassportSource } from "@/types/batch";

const DEFAULT_PRODUCER = "IE2727 Doran Nurseries Producer Code";
const DEFAULT_COUNTRY = "IE";

export function makeInternalPassport(args: {
  family: string | null | undefined;
  ourBatchNumber: string;
  userId?: string | null;
}): PlantPassport {
  return {
    source: "Internal",
    aFamily: args.family ?? null,
    bProducerCode: DEFAULT_PRODUCER,
    cBatchNumber: args.ourBatchNumber,
    dCountryCode: DEFAULT_COUNTRY,
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
