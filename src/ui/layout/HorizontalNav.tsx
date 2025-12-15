"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { type NavItem } from "@/config/nav"
import { ChevronDown } from "lucide-react"

type HorizontalNavProps = {
  items: NavItem[]
  currentModuleKey?: string
}

export function HorizontalNav({ items, currentModuleKey }: HorizontalNavProps) {
  const pathname = usePathname()
  const [hoveredModule, setHoveredModule] = React.useState<string | null>(null)
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const HOVER_DELAY = 150

  const handleMouseEnter = React.useCallback((key: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setHoveredModule(key)
  }, [])

  const handleMouseLeave = React.useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredModule(null)
    }, HOVER_DELAY)
  }, [])

  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  return (
    <nav className="hidden md:flex flex-1" aria-label="Main navigation">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const isActive = item.key === currentModuleKey ||
            (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href))
          const Icon = item.icon
          const hasSubItems = item.items && item.items.length > 0
          const isHovered = hoveredModule === item.key

          return (
            <li
              key={item.key}
              className="relative"
              onMouseEnter={() => handleMouseEnter(item.key)}
              onMouseLeave={handleMouseLeave}
            >
              <Link
                href={item.href}
                className={cn(
                  "group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50",
                  isActive
                    ? "!bg-[#4CAF50] !text-white shadow-sm"
                    : "bg-background text-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  {Icon && <Icon className="h-4 w-4" />}
                  <span>{item.label}</span>
                  {hasSubItems && (
                    <ChevronDown className={cn(
                      "h-3 w-3 transition-transform duration-200",
                      isHovered && "rotate-180"
                    )} />
                  )}
                </div>
              </Link>

              {/* Dropdown Menu */}
              {hasSubItems && isHovered && (
                <div
                  className="absolute left-0 top-full pt-1 z-50"
                  onMouseEnter={() => handleMouseEnter(item.key)}
                  onMouseLeave={handleMouseLeave}
                >
                  <div className="w-[200px] rounded-lg border bg-popover shadow-lg overflow-hidden">
                    <div className="py-1">
                      {item.items!.map((subItem) => {
                        const isSubActive = pathname === subItem.href ||
                          (subItem.href !== '/' && pathname.startsWith(subItem.href))

                        return (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            className={cn(
                              "block px-4 py-2 text-sm transition-colors hover:bg-accent",
                              isSubActive && "bg-accent font-medium"
                            )}
                          >
                            {subItem.label}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
