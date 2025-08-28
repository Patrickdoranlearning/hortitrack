"use client";
import React, {createContext, useContext, useEffect, useMemo, useState} from "react";

type OrgContextValue = {
  orgId: string | null;
  setOrgId: (id: string | null) => void;
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ initialOrgId, children }: { initialOrgId?: string | null; children: React.ReactNode }) {
  const [orgId, setOrgId] = useState<string | null>(initialOrgId ?? null);

  // hydrate from localStorage if nothing provided
  useEffect(() => {
    if (!orgId) {
      const stored = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
      if (stored) setOrgId(stored);
    }
  }, [orgId]);

  // persist for next loads
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (orgId) localStorage.setItem("activeOrgId", orgId);
      else localStorage.removeItem("activeOrgId");
    }
  }, [orgId]);

  const value = useMemo(() => ({ orgId, setOrgId }), [orgId]);
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useActiveOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) {
    // Do not crash; warn once. Components will treat null as "no active org"
    if (process.env.NODE_ENV !== "production") {
      console.warn("OrgContext missing orgId; ensure OrgProvider is mounted");
    }
    return { orgId: null, setOrgId: (_: string | null) => {} };
  }
  return ctx;
}
