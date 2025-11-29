import { fetchJson } from "@/lib/http/fetchJson";

export type UUID = string & { __brand: "uuid" };

export type PropagationInput = {
  plant_variety_id: UUID;
  size_id: UUID;
  location_id: UUID;
  containers: number;
  planted_at?: string;   // YYYY-MM-DD
  notes?: string;
};

export type CheckInInput = {
  plant_variety_id: UUID;
  size_id: UUID;
  location_id: UUID;
  phase: "propagation" | "plug" | "potted";
  supplier_id: UUID;
  containers: number;
  supplier_batch_number: string;
  incoming_date: string; // YYYY-MM-DD
  quality_rating?: number;
  pest_or_disease?: boolean;
  notes?: string;
  photo_urls?: string[];
  passport_override?: {
    operator_reg_no?: string;
    origin_country?: string;     // "IE", "NL", ...
    traceability_code?: string;
  };
};

export type TransplantInput = {
  parent_batch_id: UUID;
  size_id: UUID;
  location_id: UUID;
  containers: number;
  planted_at?: string;   // YYYY-MM-DD
  notes?: string;
  archive_parent_if_empty?: boolean;
};

type ApiResponse<T> = { requestId?: string } & T;

export const ProductionAPI = {
  propagate(input: PropagationInput) {
    return fetchJson<ApiResponse<{ batch: any }>>("/api/production/batches/propagate", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  checkIn(input: CheckInInput) {
    return fetchJson<ApiResponse<{ batch: any }>>("/api/production/batches/checkin", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  transplant(input: TransplantInput) {
    return fetchJson<ApiResponse<{ child_batch: any; parent_new_quantity: number }>>(
      "/api/production/batches/transplant",
      { method: "POST", body: JSON.stringify(input) }
    );
  },
  move(batchId: string, payload: { location_id: string; notes?: string }) {
    return fetchJson<ApiResponse<{ ok: true }>>(`/api/production/batches/${batchId}/move`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  setStatus(batchId: string, payload: { status: "Growing"|"Ready"|"Archived"|"Sold"; notes?: string }) {
    return fetchJson<ApiResponse<{ ok: true }>>(`/api/production/batches/${batchId}/status`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateBatch(batchId: string, payload: Record<string, unknown>) {
    return fetchJson<ApiResponse<{ ok: true }>>(`/api/batches/${batchId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  dump(batchId: string, payload: { units: number; reason: string; archive_if_empty?: boolean; notes?: string }) {
    return fetchJson<ApiResponse<{ ok: true; new_quantity: number }>>(`/api/production/batches/${batchId}/dump`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
