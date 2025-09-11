"use client";
import { ReactNode } from "react";
import { isEnabled, FeatureKey } from "@/config/features";

export function FeatureGate({ name, children }: { name: FeatureKey; children: ReactNode }) {
  return isEnabled(name) ? <>{children}</> : null;
}
