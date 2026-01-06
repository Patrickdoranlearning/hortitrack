"use client";

import * as React from "react"
import { AppHeader } from "./AppHeader"
import { useCompanyName } from "@/lib/org/context"

type PageFrameProps = {
  companyName?: string
  moduleKey: string
  children: React.ReactNode
}

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
