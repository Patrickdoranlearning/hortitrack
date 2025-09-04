// src/contexts/ReferenceDataContext.tsx
"use client";

import React from "react";
import { fetchReferenceData, type ReferenceData } from "@/lib/referenceData/service";

type Ctx = { data: Omit<ReferenceData, "errors"> | null; loading: boolean; reload: () => void; error?: string };

export const ReferenceDataContext = React.createContext<Ctx>({
  data: null,
  loading: true,
  reload: () => {},
});

export function ReferenceDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = React.useState<Ctx["data"]>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | undefined>(undefined);

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await fetchReferenceData();
    if (res.errors.length) setError(res.errors.join("; "));
    setData({
      varieties: res.varieties,
      sizes: res.sizes,
      locations: res.locations,
      suppliers: res.suppliers,
    });
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return <ReferenceDataContext.Provider value={{ data, loading, reload: load, error }}>{children}</ReferenceDataContext.Provider>;
}
