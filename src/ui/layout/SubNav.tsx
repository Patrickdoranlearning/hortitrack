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
}

export function SubNav({ items, className }: SubNavProps) {
  const pathname = usePathname()

  if (!items || items.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        "border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}
    >
      <div className="mx-auto max-w-7xl px-4">
        <nav className="flex items-center gap-1 overflow-x-auto py-2" aria-label="Secondary navigation">
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
                  isActive && "bg-accent text-accent-foreground"
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
