
"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { NavItem, NavSubItem } from "@/config/nav"


function ListItem({ item, active }: { item: NavSubItem, active: boolean }) {
    return (
      <li>
        <NavigationMenuLink asChild>
          <a
            href={item.href}
            className={cn(
              "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
              active && "bg-accent/50 text-accent-foreground"
            )}
          >
            <div className="text-sm font-medium leading-none">{item.label}</div>
            <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
              {item.description}
            </p>
          </a>
        </NavigationMenuLink>
      </li>
    )
}

export function ModuleTabs({ items, ariaLabel }: { items: NavItem[]; ariaLabel?: string }) {
  const pathname = usePathname()

  return (
    <NavigationMenu aria-label={ariaLabel}>
      <NavigationMenuList>
        {items.map((item) => {
          const isModuleActive = item.key === 'production' 
            ? pathname === '/' || pathname.startsWith('/production') || pathname.startsWith('/batches') 
            : pathname.startsWith(item.href);

          if (!item.items || item.items.length === 0) {
            return (
              <NavigationMenuItem key={item.key}>
                <Link href={item.href} legacyBehavior passHref>
                  <NavigationMenuLink className={cn(navigationMenuTriggerStyle(), isModuleActive && "bg-accent/50 font-semibold text-primary")}>
                    {item.label}
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            );
          }

          return (
             <NavigationMenuItem key={item.key}>
                <NavigationMenuTrigger className={cn(isModuleActive && "bg-accent/50 font-semibold text-primary")}>
                    <Link href={item.href} className="mr-2">{item.label}</Link>
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px] ">
                    {item.items.map((subItem) => (
                      <ListItem
                        key={subItem.label}
                        item={subItem}
                        active={pathname === subItem.href}
                      />
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
          )
        })}
      </NavigationMenuList>
    </NavigationMenu>
  )
}
