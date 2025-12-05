
"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { type NavItem } from "@/config/nav"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"

type HorizontalNavProps = {
  items: NavItem[]
  currentModuleKey?: string
  onModuleHover?: (moduleKey: string | null) => void
}

export function HorizontalNav({ items, currentModuleKey, onModuleHover }: HorizontalNavProps) {
  const pathname = usePathname()

  return (
    <NavigationMenu className="hidden md:flex">
      <NavigationMenuList>
        {items.map((item) => {
          const isActive = item.key === currentModuleKey || pathname.startsWith(item.href)
          const Icon = item.icon
          const hasSubItems = item.items && item.items.length > 0

          return (
            <NavigationMenuItem key={item.key}>
              <NavigationMenuLink asChild>
                <Link
                  href={item.href}
                  onMouseEnter={() => hasSubItems && onModuleHover?.(item.key)}
                  onMouseLeave={() => onModuleHover?.(null)}
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
              </NavigationMenuLink>
            </NavigationMenuItem>
          )
        })}
      </NavigationMenuList>
    </NavigationMenu>
  )
}
