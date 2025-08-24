
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SALES } from "@/config/nav";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Lightweight client fetch of roles via a small endpoint
async function fetchRoles(): Promise<string[] | null> {
  try {
    const res = await fetch("/api/me/roles", { cache: "no-store" });
    if (!res.ok) {
        // If API returns 401/403, it means no valid user, so roles are empty.
        // For other errors, we could return null to show a loading/error state.
        if (res.status === 401 || res.status === 403) return [];
        return null;
    }
    const j = await res.json();
    // Ensure we have an array, even if the API response is malformed.
    return Array.isArray(j?.roles) ? j.roles : [];
  } catch (e) {
    console.error("[MainNav] fetchRoles failed:", e);
    return null; // Return null on network error
  }
}

export default function MainNav() {
  const pathname = usePathname();
  const [roles, setRoles] = useState<string[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    fetchRoles().then(fetchedRoles => {
      if (isMounted) {
        setRoles(fetchedRoles);
        setIsLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, []);

  // Determine which nav items are visible based on roles
  const visible = NAV_SALES.filter(i => {
    // If roles haven't loaded yet, don't show any role-protected items.
    if (!i.requiredRoles) return true;
    if (roles === null) return false;
    return i.requiredRoles.every(r => roles.includes(r));
  });

  return (
    <nav className="space-y-1 p-2">
      <div className="px-2 text-xs uppercase text-muted-foreground">Sales</div>
      {isLoading ? (
        <div className="space-y-1 p-2">
            <div className="h-8 w-full rounded-md bg-muted animate-pulse" />
            <div className="h-8 w-full rounded-md bg-muted animate-pulse" />
        </div>
      ) : (
        visible.map(item => {
          const active = pathname === item.href || (item.href !== '/sales' && pathname.startsWith(item.href + "/"));
          const Icon = item.icon!;
          return (
            <Link key={item.href} href={item.href} className="block">
              <Button variant={active ? "secondary" : "ghost"} className={cn("w-full justify-start gap-2")}>
                {Icon && <Icon className="h-4 w-4" />}
                <span>{item.label}</span>
              </Button>
            </Link>
          );
        })
      )}
    </nav>
  );
}
