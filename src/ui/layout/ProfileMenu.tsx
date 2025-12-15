"use client"

import * as React from "react"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useActiveOrg } from "@/lib/org/context"
import {
  User,
  Settings,
  FileText,
  Building2,
  Users,
  LogOut,
  ChevronDown
} from "lucide-react"

export function ProfileMenu({ moduleKey, className }: { moduleKey: string; className?: string }) {
  const { companyName } = useActiveOrg()

  // Get initials from company name
  const getInitials = () => {
    if (companyName) {
      return companyName.substring(0, 2).toUpperCase()
    }
    return "HT"
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(
        "flex items-center gap-2 rounded-full px-2 py-1 hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}>
        <Avatar className="h-8 w-8 border-2 border-primary/20">
          <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
            {getInitials()}
          </AvatarFallback>
        </Avatar>
        <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Organization Header */}
        <div className="px-3 py-3 border-b">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{companyName}</p>
            </div>
          </div>
        </div>

        {/* Account Section */}
        <DropdownMenuGroup className="py-1">
          <DropdownMenuItem asChild>
            <Link href="/settings/account" className="flex items-center gap-3 cursor-pointer">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>My Account</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings/organization" className="flex items-center gap-3 cursor-pointer">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span>Organization</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings/team" className="flex items-center gap-3 cursor-pointer">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>Team Members</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Tools Section */}
        <DropdownMenuGroup className="py-1">
          <DropdownMenuItem asChild>
            <Link href="/settings" className="flex items-center gap-3 cursor-pointer">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span>Settings & Data</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/documents/designer" className="flex items-center gap-3 cursor-pointer">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>Document Designer</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Logout */}
        <DropdownMenuGroup className="py-1">
          <DropdownMenuItem asChild>
            <Link href="/logout" className="flex items-center gap-3 cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" />
              <span>Log out</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
