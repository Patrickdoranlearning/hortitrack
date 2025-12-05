
"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { type NavItem } from "@/config/nav"
type HorizontalNavProps = {
  items: NavItem[]
  currentModuleKey?: string
  onModuleHover?: (moduleKey: string | null) => void
}

export function HorizontalNav({ items, currentModuleKey, onModuleHover }: HorizontalNavProps) {
  const pathname = usePathname()

  return (
    <nav className="hidden md:flex" aria-label="Main navigation">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const isActive = item.key === currentModuleKey || pathname.startsWith(item.href)
          const Icon = item.icon
          const hasSubItems = item.items && item.items.length > 0

          const handleItemEnter = () => {
            if (hasSubItems) {
              onModuleHover?.(item.key)
            } else {
              onModuleHover?.(null)
            }
          }

          return (
            <li
              key={item.key}
              onMouseEnter={handleItemEnter}
              onFocus={handleItemEnter}
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
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
