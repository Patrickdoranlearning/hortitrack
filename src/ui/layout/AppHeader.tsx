
"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { ModuleTabs } from "./ModuleTabs"
import { HorizontalNav } from "./HorizontalNav"
import { ProfileMenu } from "./ProfileMenu"
import { Logo } from "@/components/logo"
import { APP_NAV } from "@/config/nav";

type AppHeaderProps = {
  companyName: string
  moduleKey: string
  className?: string
}

export function AppHeader({ companyName, moduleKey, className }: AppHeaderProps) {
  // Find the current module and its sub-items
  const currentModule = APP_NAV.find(item => item.key === moduleKey)
  const subNavItems = currentModule?.items || []

  return (
    <header className={cn(
      "sticky top-0 z-[999] w-full bg-background overflow-visible",
      className
    )}>
      {/* Row 1: Brand + company + profile */}
      <div className="border-b">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2">
          <Link href="/" className="flex items-center gap-3">
            <Logo />
            <div className="hidden sm:flex flex-col leading-tight">
              <span className="text-sm font-semibold">HortiTrack</span>
              <span className="text-xs text-muted-foreground truncate max-w-[220px]">{companyName}</span>
            </div>
          </Link>
          <div className="flex items-center justify-end gap-2 ml-auto">
            <ProfileMenu moduleKey={moduleKey} />
          </div>
        </div>
      </div>

      {/* Row 2: Main navigation (modules) */}
      <div className="border-b overflow-visible">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2 overflow-visible">
          <span className="sr-only">App navigation</span>
          {/* Mobile: full module picker */}
          <div className="md:hidden">
            <ModuleTabs items={APP_NAV} ariaLabel="Main application navigation" />
          </div>
          {/* Desktop: modules with dropdown sub-pages */}
          <HorizontalNav items={APP_NAV} currentModuleKey={moduleKey} />
        </div>
      </div>
    </header>
  )
}
