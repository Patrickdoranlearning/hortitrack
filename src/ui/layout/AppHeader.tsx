
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
  const HOVER_HIDE_DELAY = 300

  // Find the hovered module's sub-items (hover/focus driven only on desktop)
  const hoveredModuleData = hoveredModule ? APP_NAV.find(item => item.key === hoveredModule) : null
  const hoveredSubNavItems = hoveredModuleData?.items || []

  // Show subnav only when hovering/focusing a module on desktop
  const displaySubNavItems = hoveredSubNavItems
  const showSubNav = isDesktop && hoveredModule !== null && hoveredSubNavItems.length > 0

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
      }, HOVER_HIDE_DELAY)
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

        {/* Row 3: Sub navigation (pages) - shows on hover, desktop only */}
        {showSubNav && (
          <div onMouseEnter={handleSubNavMouseEnter}>
            <SubNav items={displaySubNavItems} />
          </div>
        )}
      </div>
    </header>
  )
}

