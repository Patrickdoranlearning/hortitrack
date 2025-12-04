import type { ProductionProtocolRoute } from "@/lib/protocol-types";

export type PlanningBatch = {
  id: string;
  batchNumber: string | null;
  status: string;
  phase: string | null;
  quantity: number;
  reservedQuantity: number;
  readyDate: string | null;
  startDate: string | null;
  varietyName: string | null;
  varietyId: string | null;
  sizeName: string | null;
  sizeId: string | null;
  parentBatchId: string | null;
  protocolId: string | null;
  locationName: string | null;
  isGhost: boolean;
};

export type PlanningBucket = {
  label: string;
  month: string;
  physical: number;
  incoming: number;
  planned: number;
};

export type PlanningSnapshot = {
  buckets: PlanningBucket[];
  batches: PlanningBatch[];
  generatedAt: string;
};

export type ProtocolSummary = {
  id: string;
  name: string;
  description: string | null;
  targetVarietyId: string | null;
  targetVarietyName: string | null;
  targetSizeId: string | null;
  targetSizeName: string | null;
  route: ProductionProtocolRoute | null;
  definition: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

