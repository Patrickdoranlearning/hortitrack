
"use client"

import * as React from "react"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export function ProfileMenu({ moduleKey, className }: { moduleKey: string; className?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn("rounded-full ring-offset-background focus-visible:ring-2", className)}>
        <Avatar className="h-8 w-8">
          <AvatarFallback>HT</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Profile</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild><Link href="/settings">Data Management</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href="/account">Account</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href="/documents/designer">Document Designer</Link></DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Switch Module</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem asChild className={moduleKey === "production" ? "bg-muted" : ""}><Link href="/production">Production</Link></DropdownMenuItem>
          <DropdownMenuItem asChild className={moduleKey === "plantHealth" ? "bg-muted" : ""}><Link href="/actions">Plant Health</Link></DropdownMenuItem>
          <DropdownMenuItem asChild className={moduleKey === "sales" ? "bg-muted" : ""}><Link href="/sales">Sales</Link></DropdownMenuItem>
          <DropdownMenuItem asChild className={moduleKey === "dispatch" ? "bg-muted" : ""}><Link href="/dispatch">Dispatch</Link></DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link href="/logout">Log out</Link></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
