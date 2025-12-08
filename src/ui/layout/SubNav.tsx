"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { type NavSubItem } from "@/config/nav"
import { Button } from "@/components/ui/button"

type SubNavProps = {
  items: NavSubItem[]
  className?: string
  /** When hovering a different module, show its name as context */
  moduleLabel?: string
}

export function SubNav({ items, className, moduleLabel }: SubNavProps) {
  const pathname = usePathname()

  if (!items || items.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        "border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        moduleLabel && "bg-muted/50",
        className
      )}
    >
      <div className="mx-auto max-w-7xl px-4">
        <nav className="flex items-center gap-1 overflow-x-auto py-2" aria-label="Secondary navigation">
          {moduleLabel && (
            <span className="shrink-0 text-xs font-medium text-muted-foreground mr-2 px-2 py-1 bg-muted rounded">
              {moduleLabel}
            </span>
          )}
          {items.map((item) => {
            const isActive = pathname === item.href ||
                           (item.href !== '/' && pathname.startsWith(item.href))

            return (
              <Button
                key={item.href}
                variant="ghost"
                size="sm"
                asChild
                className={cn(
                  "shrink-0 text-sm font-medium transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  isActive && !moduleLabel && "bg-accent text-accent-foreground"
                )}
              >
                <Link href={item.href}>
                  {item.label}
                </Link>
              </Button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
