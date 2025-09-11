"use client";
import { OrgProvider } from "@/server/org/context";

export default function OrgBoundary({
  orgId,
  children,
}: {
  orgId: string | null;
  children: React.ReactNode;
}) {
  return <OrgProvider orgId={orgId}>{children}</OrgProvider>;
}
