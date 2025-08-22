import { z } from "zod";
import { AncestryResponseSchema, BatchSummarySchema, AncestryNode, BatchSummary } from "@/types/batch";
import { logError } from "@/lib/log";

async function safeFetch<T>(
  url: string,
  schema: z.ZodSchema<T>,
  opts?: RequestInit
): Promise<T> {
  const res = await fetch(url, { ...opts, credentials: "include" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logError("api_error", { url, status: res.status, text });
    throw new Error(`API error ${res.status}`);
  }
  const data = await res.json();
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    logError("api_validate_error", { url, issues: parsed.error.issues });
    throw new Error("Invalid API response");
  }
  return parsed.data;
}

export async function getBatchAncestry(batchNumber: string): Promise<AncestryNode[]> {
  return safeFetch(`/api/batches/${encodeURIComponent(batchNumber)}/ancestry`, AncestryResponseSchema, { method: "GET" });
}

export async function getBatchSummary(batchNumber: string): Promise<BatchSummary> {
  return safeFetch(`/api/batches/${encodeURIComponent(batchNumber)}`, BatchSummarySchema, { method: "GET" });
}
