import useSWR from "swr";
import type { BatchDetail } from "@/server/batch-detail";
import { fetchJson } from "@/lib/http";

const fetcher = async (url: string) => {
  const { data, res } = await fetchJson<BatchDetail>(url);
  if (!data) throw new Error(`Empty response ${res.status}`);
  return data;
};

export function useBatchDetail(batchId?: string) {
  const canFetch = Boolean(batchId);
  const { data, error, isLoading, mutate } = useSWR(
    canFetch ? `/api/batches/${batchId}/detail` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  return { data, error, isLoading, mutate };
}
