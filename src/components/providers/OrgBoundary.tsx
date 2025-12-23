"use client";
import { OrgProvider } from "@/lib/org/context";

export default function OrgBoundary({
  orgId,
  companyName,
  children,
}: {
  orgId: string | null;
  companyName?: string;
  children: React.ReactNode;
}) {
  return (
    <OrgProvider initialOrgId={orgId} initialCompanyName={companyName}>
      {children}
    </OrgProvider>
  );
}
