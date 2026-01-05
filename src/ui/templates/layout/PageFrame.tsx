"use client";

import * as React from "react"
import { AppHeader } from "./AppHeader"
import { useCompanyName } from "@/lib/org/context"

type PageFrameProps = {
  companyName?: string
  moduleKey: string
  children: React.ReactNode
}

/**
 * PageFrame Template
 * 
 * The foundational layout wrapper for all application pages.
 * It provides the AppHeader and centers the main content area.
 * 
 * @example
 * ```tsx
 * <PageFrame moduleKey="production">
 *   <YourPageContent />
 * </PageFrame>
 * ```
 */
export function PageFrame({ companyName, moduleKey, children }: PageFrameProps) {
  const contextCompanyName = useCompanyName();
  const resolvedCompanyName = companyName ?? contextCompanyName;

  return (
    <div className="min-h-dvh">
      <AppHeader companyName={resolvedCompanyName} moduleKey={moduleKey} />
      <main className="relative z-0 mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  )
}
