
"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { ModuleTabs } from "./ModuleTabs"
import { HorizontalNav } from "./HorizontalNav"
import { SubNav } from "./SubNav"
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
      "sticky top-0 z-40 w-full bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      className
    )}>
      {/* Top bar: Logo, Navigation, Profile */}
      <div className="border-b">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2">
          <div className="flex items-center gap-6">
            {/* Mobile hamburger menu - only visible on mobile */}
            <div className="md:hidden">
              <ModuleTabs items={APP_NAV} ariaLabel="Main application navigation" />
            </div>

            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
              <Logo />
            </Link>

            {/* Horizontal navigation for desktop */}
            <HorizontalNav items={APP_NAV} currentModuleKey={moduleKey} />
          </div>

          <div className="flex items-center justify-end gap-2 ml-auto">
            <ProfileMenu moduleKey={moduleKey} />
          </div>
        </div>
      </div>

      {/* Second tier: Sub-navigation for current module */}
      <SubNav items={subNavItems} />
    </header>
  )
}
