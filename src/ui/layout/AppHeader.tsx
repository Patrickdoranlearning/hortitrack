
"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { ModuleTabs, type ModuleTabItem } from "./ModuleTabs"
import { ProfileMenu } from "./ProfileMenu"
import { Logo } from "@/components/logo"

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
      {/* Top bar: Logo, Search, Profile */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2">
        <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
            <Logo />
            </Link>
        </div>

        <div className="flex items-center justify-end gap-2">
          {/* SearchInput removed from here */}
          <ProfileMenu moduleKey={moduleKey} />
        </div>
      </div>
      
      {/* Bottom bar: Module Tabs */}
      <div className="border-t bg-background/50">
        <div className="mx-auto max-w-7xl px-4">
             <ModuleTabs items={moduleTabs} ariaLabel={`${moduleKey} module navigation`} />
        </div>
      </div>

    </header>
  )
}
