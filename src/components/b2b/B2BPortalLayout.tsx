'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Home, ShoppingCart, Package, FileText, BookOpen, User, LogOut, Menu, Sprout } from 'lucide-react';
import { logoutCustomer } from '@/app/b2b/login/actions';
import { endImpersonation } from '@/app/b2b/impersonate/actions';
import type { B2BAuthContext } from '@/lib/auth/b2b-guard';

type B2BPortalLayoutProps = {
  authContext: B2BAuthContext;
  children: React.ReactNode;
};

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/b2b/dashboard', icon: Home },
  { label: 'New Order', href: '/b2b/orders/new', icon: ShoppingCart },
  { label: 'My Orders', href: '/b2b/orders', icon: Package },
  { label: 'Invoices', href: '/b2b/invoices', icon: FileText },
  { label: 'Resources', href: '/b2b/resources', icon: BookOpen },
  { label: 'Account', href: '/b2b/account', icon: User },
];

export function B2BPortalLayout({ authContext, children }: B2BPortalLayoutProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const { customer, isImpersonating } = authContext;

  return (
    <div className="min-h-dvh">
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2 text-sm font-medium flex items-center justify-center gap-2">
          <span>Placing order on behalf of: {customer.name}</span>
          <form action={endImpersonation} className="inline">
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="h-6 text-amber-950 hover:bg-amber-600 hover:text-white"
            >
              End Session
            </Button>
          </form>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-[999] border-b bg-background">
        {/* Row 1: Logo, Company Name, Profile */}
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Sprout className="h-8 w-8 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold text-sm leading-tight">
                <span className="text-primary font-bold font-headline">hortitrack</span>
                <span className="text-muted-foreground font-normal ml-1.5">Customer Portal</span>
              </div>
              <div className="text-xs text-muted-foreground truncate">{customer.name}</div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Profile Menu (Desktop) */}
          <div className="hidden md:block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{customer.name}</p>
                    <p className="text-xs text-muted-foreground">{authContext.user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/b2b/account" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Account Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <form action={logoutCustomer} className="w-full">
                    <button type="submit" className="flex w-full items-center cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="border-t md:hidden">
            <nav className="flex flex-col p-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
              <div className="border-t my-2" />
              <form action={logoutCustomer}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </form>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="relative z-0 mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
