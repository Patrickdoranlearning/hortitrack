
"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { ModuleTabs } from "./ModuleTabs"
import { ProfileMenu } from "./ProfileMenu"
import { Logo } from "@/components/logo"
import { APP_NAV } from "@/config/nav";

type AppHeaderProps = {
  companyName: string
  moduleKey: string
  className?: string
}

export function AppHeader({ companyName, moduleKey, className }: AppHeaderProps) {
  return (
    <header className={cn(
      "sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      className
    )}>
      {/* Top bar: Burger Menu, Logo, Search, Profile */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2">
        <div className="flex items-center gap-3">
            <ModuleTabs items={APP_NAV} ariaLabel="Main application navigation" />
            <Link href="/" className="flex items-center gap-3">
              <Logo />
            </Link>
        </div>

        <div className="flex items-center justify-end gap-2">
          {/* SearchInput removed from here */}
          <ProfileMenu moduleKey={moduleKey} />
        </div>
      </div>
    </header>
  )
}
