import useSWR from "swr";
import { defaultOptionsFor, type AttributeKey, type AttributeOption } from "@/lib/attributeOptions";

type ResponseShape = { options: AttributeOption[]; source: "custom" | "default"; meta?: unknown };

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return res.json();
};

export function useAttributeOptions(attributeKey: AttributeKey, opts?: { includeInactive?: boolean }) {
  const includeInactive = opts?.includeInactive ?? false;
  const query = includeInactive ? "?includeInactive=1" : "";
  const { data, error, isLoading, mutate } = useSWR<ResponseShape>(
    attributeKey ? `/api/options/${attributeKey}${query}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const options = data?.options ?? (error ? defaultOptionsFor(attributeKey, includeInactive) : []);

  return {
    options,
    source: data?.source,
    meta: data?.meta,
    loading: isLoading,
    error,
    refresh: mutate,
  };
}

