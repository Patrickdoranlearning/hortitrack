
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
      <ul className="-mb-px flex h-10 items-center gap-4 text-sm">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "inline-flex items-center border-b-2 px-1 pt-1 font-medium transition",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
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
