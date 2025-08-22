import useSWR from "swr";
import type { BatchDetail } from "@/server/batch-detail";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
  return (await res.json()) as BatchDetail;
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
