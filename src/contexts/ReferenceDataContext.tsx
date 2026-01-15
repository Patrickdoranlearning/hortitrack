// src/contexts/ReferenceDataContext.tsx
"use client";

import React from "react";
import useSWR from "swr";
import { fetchReferenceData, type ReferenceData } from "@/lib/referenceData/service";

type RefData = Omit<ReferenceData, "errors">;
type Ctx = { data: RefData | null; loading: boolean; reload: () => void; error?: string };

export const ReferenceDataContext = React.createContext<Ctx>({
  data: null,
  loading: true,
  reload: () => { },
});

const fetcher = async (): Promise<RefData> => {
  const res = await fetchReferenceData();
  return {
    varieties: res.varieties,
    sizes: res.sizes,
    locations: res.locations,
    suppliers: res.suppliers,
    materials: res.materials,
  };
};

export function ReferenceDataProvider({ children }: { children: React.ReactNode }) {
  const { data, error, isLoading, mutate } = useSWR<RefData>(
    "reference-data",
    fetcher,
    {
      revalidateOnFocus: true,      // Refresh when user returns to tab
      revalidateOnReconnect: true,  // Refresh when network reconnects
      dedupingInterval: 10000,      // Dedupe requests within 10s
      refreshInterval: 0,           // No automatic polling (set to e.g. 60000 for 1min polling)
    }
  );

  const reload = React.useCallback(() => {
    void mutate();
  }, [mutate]);

  const errorMessage = error instanceof Error ? error.message : error ? String(error) : undefined;

  return (
    <ReferenceDataContext.Provider
      value={{
        data: data ?? null,
        loading: isLoading,
        reload,
        error: errorMessage
      }}
    >
      {children}
    </ReferenceDataContext.Provider>
  );
}
