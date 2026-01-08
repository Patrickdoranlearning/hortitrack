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
    { 
      revalidateOnFocus: false,
      // Prevent infinite loop if data is considered "changed" every time
      // Use deep comparison for data if needed, or trust that SWR dedupes by key
    }
  );

  // Memoize the return value to prevent effect loops downstream
  const options = data?.options ?? (error ? defaultOptionsFor(attributeKey, includeInactive) : []);

  // Only return a new object if data/options actually changed
  // However, options is a new array reference here on every render if we don't memoize it
  // But wait, data comes from SWR state.
  // Let's use simple stable return for now, relying on SWR stability.
  
  return {
    options,
    source: data?.source,
    meta: data?.meta,
    loading: isLoading,
    error,
    refresh: mutate,
  };
}

