
"use client";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type OrgContextValue = {
  orgId: string | null;
  setOrgId: (id: string | null) => void;
};

const Ctx = createContext<OrgContextValue | undefined>(undefined);

export function OrgProvider({
  initialOrgId = null,
  children,
}: { initialOrgId?: string | null; children: React.ReactNode }) {
  const [orgId, setOrgId] = useState<string | null>(initialOrgId);

  useEffect(() => {
    if (!orgId && typeof window !== "undefined") {
      const stored = localStorage.getItem("activeOrgId");
      if (stored) setOrgId(stored);
    }
  }, [orgId]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (orgId) localStorage.setItem("activeOrgId", orgId);
      else localStorage.removeItem("activeOrgId");
    }
  }, [orgId]);

  const value = useMemo(() => ({ orgId, setOrgId }), [orgId, setOrgId]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActiveOrg(): OrgContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("useActiveOrg called outside of OrgProvider. This is a bug.");
    }
    // Return a safe, non-null object so destructuring never crashes.
    return { orgId: null, setOrgId: () => {} };
  }
  return ctx;
}
