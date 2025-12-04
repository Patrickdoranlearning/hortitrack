"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { type NavItem } from "@/config/nav"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"

type HorizontalNavProps = {
  items: NavItem[]
  currentModuleKey?: string
}

export function HorizontalNav({ items, currentModuleKey }: HorizontalNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <NavigationMenu className="hidden md:flex">
      <NavigationMenuList>
        {items.map((item) => {
          const isActive = item.key === currentModuleKey || pathname.startsWith(item.href)
          const Icon = item.icon
          const navContentId = `nav-content-${item.key}`

          return (
            <NavigationMenuItem key={item.key}>
              {item.items && item.items.length > 0 ? (
                <>
                  <NavigationMenuTrigger
                    aria-expanded={isActive}
                    aria-controls={navContentId}
                    onClick={(event) => {
                      event.preventDefault()
                      router.push(item.href)
                    }}
                    className={cn(
                      "group inline-flex w-max items-center justify-center rounded-md focus:outline-none disabled:pointer-events-none disabled:opacity-50",
                      "h-10 px-4 py-2 text-sm font-medium transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus:bg-accent focus:text-accent-foreground",
                      isActive && "bg-[#4CAF50] text-white"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {Icon && <Icon className="h-4 w-4" />}
                      <span>{item.label}</span>
                    </div>
                  </NavigationMenuTrigger>
                  <NavigationMenuContent
                    id={navContentId}
                    className="min-w-[220px]"
                  >
                    <ul className="flex flex-col py-1">
                      {item.items.map((subItem) => (
                        <li key={subItem.href}>
                          <NavigationMenuLink asChild>
                            <Link
                              href={subItem.href}
                              className={cn(
                                "flex w-full items-center gap-2 px-4 py-2 text-sm font-medium text-foreground transition-colors",
                                "hover:bg-muted focus:bg-muted focus:outline-none",
                                pathname === subItem.href && "bg-muted text-foreground"
                              )}
                            >
                              <span>{subItem.label}</span>
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </>
              ) : (
                <Link href={item.href} legacyBehavior passHref>
                  <NavigationMenuLink
                    className={cn(
                      "inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus:bg-accent focus:text-accent-foreground focus:outline-none",
                      "disabled:pointer-events-none disabled:opacity-50",
                      isActive && "bg-[#4CAF50] text-white"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {Icon && <Icon className="h-4 w-4" />}
                      <span>{item.label}</span>
                    </div>
                  </NavigationMenuLink>
                </Link>
              )}
            </NavigationMenuItem>
          )
        })}
      </NavigationMenuList>
    </NavigationMenu>
  )
}
