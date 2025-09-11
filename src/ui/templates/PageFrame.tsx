
import * as React from "react"
import { AppHeader } from "@/ui/layout/AppHeader"

type PageFrameProps = {
  companyName: string
  moduleKey: string
  children: React.ReactNode
}

export function PageFrame({ companyName, moduleKey, children }: PageFrameProps) {
  return (
    <div className="min-h-dvh">
      <AppHeader companyName={companyName} moduleKey={moduleKey} />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  )
}
