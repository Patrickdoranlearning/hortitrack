"use client";
import { createContext, useContext } from "react";

type OrgContextValue = { orgId: string | null };
const OrgContext = createContext<OrgContextValue>({ orgId: null });

export function OrgProvider({ orgId, children }: { orgId: string; children: React.ReactNode }) {
  return <OrgContext.Provider value={{ orgId }}>{children}</OrgContext.Provider>;
}

export function useActiveOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx?.orgId) console.warn("OrgContext missing orgId; ensure OrgProvider is mounted");
  return ctx.orgId;
}
