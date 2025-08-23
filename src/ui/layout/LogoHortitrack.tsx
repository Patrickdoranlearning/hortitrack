import * as React from "react"
import { cn } from "@/lib/utils"

export function LogoHortitrack({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn(className)} aria-hidden>
      <circle cx="16" cy="16" r="16" />
      <path d="M16 6c3 3 3 6 0 12-3-6-3-9 0-12z" fill="white" />
    </svg>
  )
}