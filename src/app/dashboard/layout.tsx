
import React from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LogOut,
  Settings,
  Users,
  ShoppingCart,
} from 'lucide-react';
import Link from "next/link";
import SubNav from "@/components/nav/SubNav";
import CreateMenu from "@/components/nav/CreateMenu";
import MobileNav from "@/components/nav/MobileNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full">
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
          <MobileNav />
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Logo />
          </Link>
          <div className="w-full flex-1">
            {/* Search or other header content can go here */}
          </div>
          {/* Create button for mobile */}
          <div className="md:hidden">
            <CreateMenu />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full">
                <Users className="h-5 w-5" />
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                My Account
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
               <DropdownMenuItem asChild>
                <Link href="/">
                  Nursery Stock
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/sales">
                  <ShoppingCart />
                  Sales
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings />
                  Data Management
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <LogOut />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <div className="hidden md:flex items-center justify-between border-b bg-background">
          <SubNav />
          <div className="px-4 lg:px-6 py-2">
            <CreateMenu />
          </div>
        </div>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
            {children}
        </main>
      </div>
    </div>
  );
}
