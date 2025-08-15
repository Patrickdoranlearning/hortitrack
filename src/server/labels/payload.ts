// src/server/labels/payload.ts
export function encodeBatchDataMatrixPayload(batch: { id: string; batchNumber?: string }) {
  // Minimal, fast, robust:
  return batch.id;
  // or: return `B:${batch.batchNumber}`;
}
