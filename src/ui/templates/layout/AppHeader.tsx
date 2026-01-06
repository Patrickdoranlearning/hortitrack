"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { ModuleTabs } from "@/ui/layout/ModuleTabs"
import { HorizontalNav } from "@/ui/layout/HorizontalNav"
import { ProfileMenu } from "@/ui/layout/ProfileMenu"
import { CreateButton } from "@/ui/layout/CreateButton"
import { Logo } from "@/components/logo"
import { APP_NAV } from "@/config/nav"

type AppHeaderProps = {
  companyName: string
  moduleKey: string
  className?: string
}

export function AppHeader({ companyName, moduleKey, className }: AppHeaderProps) {
  return (
    <header className={cn(
      "sticky top-0 z-[999] w-full bg-background",
      className
    )}>
      {/* Row 1: Brand + company + profile */}
      <div className="border-b">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2">
          <Link href="/" className="flex items-center gap-3">
            <Logo companyName={companyName} />
          </Link>
          <div className="flex items-center justify-end gap-2 ml-auto">
            <ProfileMenu moduleKey={moduleKey} />
          </div>
        </div>
      </div>

      {/* Row 2: Main navigation (modules) with hover dropdowns + Create button */}
      <div className="border-b">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2">
          <span className="sr-only">App navigation</span>
          {/* Mobile: full module picker */}
          <div className="md:hidden flex-1">
            <ModuleTabs items={APP_NAV} ariaLabel="Main application navigation" />
          </div>
          {/* Desktop: modules link bar with hover dropdowns */}
          <HorizontalNav
            items={APP_NAV}
            currentModuleKey={moduleKey}
          />
          {/* Create button */}
          <CreateButton />
        </div>
      </div>
    </header>
  )
}
