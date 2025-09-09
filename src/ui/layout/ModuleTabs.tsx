
"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { NavItem } from "@/config/nav"
import { Logo } from "@/components/logo"

export function ModuleTabs({ items, ariaLabel }: { items: NavItem[]; ariaLabel?: string }) {
  const pathname = usePathname()

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Menu className="h-6 w-6" />
          <span className="sr-only">Open main menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 flex flex-col">
        <div className="flex items-center gap-4 px-6 py-3 border-b shrink-0">
          <Logo />
        </div>
        <ScrollArea className="flex-1">
          <nav className="py-4 px-6">
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.key}>
                  <h4 className="py-2 font-semibold text-lg">{item.label}</h4>
                  {item.items && (
                    <ul className="space-y-1">
                      {item.items.map((subItem) => (
                        <li key={subItem.href}>
                          <Link
                            href={subItem.href}
                            className={cn(
                              "block rounded-md px-2 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                              pathname.startsWith(subItem.href) && "bg-accent/50 text-accent-foreground"
                            )}
                          >
                            {subItem.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
