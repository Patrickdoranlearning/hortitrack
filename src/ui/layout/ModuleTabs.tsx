
"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown } from "lucide-react"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { NavItem } from "@/config/nav"


export function ModuleTabs({ items, ariaLabel }: { items: NavItem[]; ariaLabel?: string }) {
  const pathname = usePathname()

  return (
    <NavigationMenu aria-label={ariaLabel}>
      <NavigationMenuList>
        {items.map((item) => {
          const active = item.key === 'production' ? pathname === '/' || pathname.startsWith('/production') || pathname.startsWith('/batches') : pathname.startsWith(item.href)
          
          if (!item.items || item.items.length === 0) {
            return (
              <NavigationMenuItem key={item.key}>
                <Link href={item.href} legacyBehavior passHref>
                  <NavigationMenuLink active={active} className={navigationMenuTriggerStyle()}>
                    {item.label}
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            )
          }

          return (
             <NavigationMenuItem key={item.key}>
               <div className={cn(navigationMenuTriggerStyle(), "flex items-center p-0", active ? "bg-accent/50" : "")}>
                 <Link href={item.href} legacyBehavior passHref>
                    <NavigationMenuLink active={active} className="px-3 py-2">
                      {item.label}
                    </NavigationMenuLink>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div
                        className="h-full px-2 flex items-center border-l border-transparent hover:border-border"
                      >
                        <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                        <span className="sr-only">Open module menu</span>
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {item.items.map(subItem => (
                        <DropdownMenuItem key={subItem.href} asChild>
                          <Link href={subItem.href}>{subItem.label}</Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
               </div>
            </NavigationMenuItem>
          )
        })}
      </NavigationMenuList>
    </NavigationMenu>
  )
}
