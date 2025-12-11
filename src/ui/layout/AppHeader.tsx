
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
  const [isDesktop, setIsDesktop] = React.useState(false)
  const HOVER_HIDE_DELAY = 150

  // Find the current module's sub-items (always shown as fallback)
  const currentModuleData = APP_NAV.find(item => item.key === moduleKey)
  const currentSubNavItems = currentModuleData?.items || []

  // Find the hovered module's sub-items (shown on hover)
  const hoveredModuleData = hoveredModule ? APP_NAV.find(item => item.key === hoveredModule) : null
  const hoveredSubNavItems = hoveredModuleData?.items || []

  // Show hovered module's items if hovering, otherwise show current module's items
  const displaySubNavItems = hoveredModule ? hoveredSubNavItems : currentSubNavItems
  const showSubNav = isDesktop && displaySubNavItems.length > 0

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
      // Delay resetting to current module to allow smooth transitions
      hoverTimeoutRef.current = setTimeout(() => {
        setHoveredModule(null)
      }, HOVER_HIDE_DELAY)
    }
  }, [])

  const handleSubNavMouseEnter = React.useCallback(() => {
    // Cancel the reset timeout when entering SubNav
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
  }, [])

  const handleSubNavMouseLeave = React.useCallback(() => {
    // Reset to current module when leaving SubNav
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

  // Track viewport to toggle desktop-only subnav rendering
  React.useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)")
    const handleChange = () => setIsDesktop(media.matches)
    handleChange()
    media.addEventListener("change", handleChange)
    return () => media.removeEventListener("change", handleChange)
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
            <Logo companyName={companyName} />
          </Link>
          <div className="flex items-center justify-end gap-2 ml-auto">
            <ProfileMenu moduleKey={moduleKey} />
          </div>
        </div>
      </div>

      {/* Row 2: Main navigation (modules) + subnav - wrapped for hover continuity */}
      <div 
        className="relative"
        onMouseLeave={handleSubNavMouseLeave}
      >
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

        {/* Row 3: Sub navigation (pages) - always visible on desktop */}
        {showSubNav && (
          <div 
            onMouseEnter={handleSubNavMouseEnter}
            className="transition-all duration-150"
          >
            <SubNav 
              items={displaySubNavItems} 
              moduleLabel={hoveredModule ? hoveredModuleData?.label : undefined}
            />
          </div>
        )}
      </div>
    </header>
  )
}

