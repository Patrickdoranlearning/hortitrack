
"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export type ModuleTabItem = { label: string; href: string; exact?: boolean }

export function ModuleTabs({ items, ariaLabel }: { items: ModuleTabItem[]; ariaLabel?: string }) {
  const pathname = usePathname()
  return (
    <nav aria-label={ariaLabel} className="overflow-x-auto">
      <ul className="flex items-center gap-2">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1.5 text-sm transition",
                  active
                    ? "bg-horti-green/15 text-foreground ring-1 ring-horti-green/30"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
