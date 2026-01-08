
"use client";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { updateActiveOrgAction } from "@/app/actions/auth";
import { useToast } from "@/components/ui/use-toast";

export type OrgContextValue = {
  orgId: string | null;
  companyName: string;
  setOrgId: (id: string | null) => void;
  switchOrg: (id: string) => Promise<void>;
};

const DEFAULT_COMPANY_NAME = "HortiTrack";

const Ctx = createContext<OrgContextValue | undefined>(undefined);

export function OrgProvider({
  initialOrgId = null,
  initialCompanyName = DEFAULT_COMPANY_NAME,
  children,
}: {
  initialOrgId?: string | null;
  initialCompanyName?: string;
  children: React.ReactNode;
}) {
  const [orgId, setOrgId] = useState<string | null>(initialOrgId);
  const [companyName, setCompanyName] = useState<string>(initialCompanyName);
  const { toast } = useToast();

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

  const switchOrg = async (newOrgId: string) => {
    // Optimistic update
    setOrgId(newOrgId);

    const res = await updateActiveOrgAction(newOrgId);
    if (!res.success) {
      toast({
        title: "Failed to switch organization",
        description: res.error,
        variant: "destructive",
      });
      // Revert if needed, but for now just warn
    }
  };

  const value = useMemo(
    () => ({ orgId, companyName, setOrgId, switchOrg }),
    [orgId, companyName]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActiveOrg(): OrgContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("useActiveOrg called outside of OrgProvider. This is a bug.");
    }
    // Return a safe, non-null object so destructuring never crashes.
    return {
      orgId: null,
      companyName: DEFAULT_COMPANY_NAME,
      setOrgId: () => {},
      switchOrg: async () => {},
    };
  }
  return ctx;
}

/**
 * Hook to get just the company name from org context
 */
export function useCompanyName(): string {
  const { companyName } = useActiveOrg();
  return companyName;
}
