
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
          const active = item.key === 'production' ? pathname === '/' : pathname.startsWith(item.href)
          
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
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        navigationMenuTriggerStyle(),
                        "flex items-center gap-1",
                        active ? "font-semibold text-primary" : ""
                      )}
                      onMouseOver={(e) => (e.target as HTMLElement).click()}
                    >
                      {item.label}
                      <ChevronDown className="h-4 w-4 transition-transform duration-200 group-hover:rotate-180" />
                    </Link>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {item.items.map(subItem => (
                       <DropdownMenuItem key={subItem.href} asChild>
                        <Link href={subItem.href}>{subItem.label}</Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
            </NavigationMenuItem>
          )
        })}
      </NavigationMenuList>
    </NavigationMenu>
  )
}
