
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
  const [hoveredModule, setHoveredModule] = React.useState<string | null>(null)
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  // Find the current module and its sub-items
  const currentModule = APP_NAV.find(item => item.key === moduleKey)
  const currentSubNavItems = currentModule?.items || []

  // Find the hovered module's sub-items (for hover preview)
  const hoveredModuleData = hoveredModule ? APP_NAV.find(item => item.key === hoveredModule) : null
  const hoveredSubNavItems = hoveredModuleData?.items || []

  // Determine which sub-items to show: hovered module takes priority, else current module
  const displaySubNavItems = hoveredModule ? hoveredSubNavItems : currentSubNavItems
  const showSubNav = displaySubNavItems.length > 0

  const handleModuleHover = React.useCallback((key: string | null) => {
    // Clear any pending timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }

    if (key) {
      // Immediately show on hover
      setHoveredModule(key)
    } else {
      // Delay hiding to allow moving to SubNav
      hoverTimeoutRef.current = setTimeout(() => {
        setHoveredModule(null)
      }, 150)
    }
  }, [])

  const handleSubNavMouseEnter = React.useCallback(() => {
    // Cancel the hide timeout when entering SubNav
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
  }, [])

  const handleSubNavMouseLeave = React.useCallback(() => {
    // Hide SubNav when leaving it
    setHoveredModule(null)
  }, [])

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

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
          {/* Desktop: modules link bar */}
          <HorizontalNav 
            items={APP_NAV} 
            currentModuleKey={moduleKey}
            onModuleHover={handleModuleHover}
          />
        </div>
      </div>

      {/* Row 3: Sub navigation (pages) - shows on hover or for current module, desktop only */}
      {showSubNav && (
        <div 
          className="hidden md:block"
          onMouseEnter={handleSubNavMouseEnter}
          onMouseLeave={handleSubNavMouseLeave}
        >
          <SubNav items={displaySubNavItems} />
        </div>
      )}
    </header>
  )
}

