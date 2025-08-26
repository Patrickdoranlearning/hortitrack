
"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { ModuleTabs, type ModuleTabItem } from "./ModuleTabs"
import { SearchInput } from "@/components/ui/search-input"
import { ProfileMenu } from "./ProfileMenu"
import { LogoHortitrack } from "./LogoHortitrack"

type AppHeaderProps = {
  companyName: string
  moduleKey: string
  moduleTabs: ModuleTabItem[]
  className?: string
}

export function AppHeader({ companyName, moduleKey, moduleTabs, className }: AppHeaderProps) {
  return (
    <header className={cn(
      "sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      className
    )}>
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-2 px-4 py-2 md:grid-cols-[auto_1fr_auto] md:items-end">
        {/* Left: Logo + Company */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <LogoHortitrack className="h-8 w-8" />
            <div className="leading-tight">
              <div className="font-display text-base">Hortitrack</div>
              <div className="text-[11px] text-muted-foreground">{companyName}</div>
            </div>
          </Link>
        </div>

        {/* Middle: Module tabs (between logo and search) */}
        <div className="md:px-4">
          <ModuleTabs items={moduleTabs} ariaLabel={`${moduleKey} module navigation`} />
        </div>

        {/* Right: Search + Profile */}
        <div className="flex items-center justify-end gap-2">
          <SearchInput placeholder="Search batches, varieties, locations…" />
          <ProfileMenu moduleKey={moduleKey} />
        </div>
      </div>
    </header>
  )
}
