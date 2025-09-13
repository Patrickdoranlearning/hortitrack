
"use client"

import * as React from "react"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { useRouter } from "next/navigation"

export function ProfileMenu({ moduleKey, className }: { moduleKey: string; className?: string }) {
  const { user } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
  };
  
  const getInitials = (email?: string | null) => {
    if (!email) return 'U';
    return email.substring(0, 2).toUpperCase();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn("rounded-full ring-offset-background focus-visible:ring-2", className)}>
        <Avatar className="h-8 w-8">
          <AvatarFallback>{user ? getInitials(user.email) : '?'}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild><Link href="/account">Account Settings</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href="/settings">Manage Data</Link></DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Switch Module</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem asChild className={moduleKey === "production" ? "bg-muted" : ""}><Link href="/">Production</Link></DropdownMenuItem>
          <DropdownMenuItem asChild className={moduleKey === "plantHealth" ? "bg-muted" : ""}><Link href="/actions">Plant Health</Link></DropdownMenuItem>
          <DropdownMenuItem asChild className={moduleKey === "sales" ? "bg-muted" : ""}><Link href="/sales">Sales</Link></DropdownMenuItem>
          <DropdownMenuItem asChild className={moduleKey === "dispatch" ? "bg-muted" : ""}><Link href="/dispatch">Dispatch</Link></DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
