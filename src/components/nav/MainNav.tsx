
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SALES } from "@/config/nav";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Lightweight client fetch of roles via a small endpoint (fallback to showing all if not available)
async function fetchRoles(): Promise<string[]> {
  try {
    const res = await fetch("/api/me/roles", { cache: "no-store" });
    if (!res.ok) return [];
    const j = await res.json();
    return j?.data?.roles ?? [];
  } catch { return []; }
}

export default function MainNav() {
  const pathname = usePathname();
  const [roles, setRoles] = useState<string[] | null>(null);

  useEffect(() => { fetchRoles().then(setRoles); }, []);

  const visible = NAV_SALES.filter(i => {
    if (!i.requiredRoles || roles === null) return true; // optimistic first paint
    return i.requiredRoles.every(r => roles.includes(r));
  });

  return (
    <nav className="flex items-center space-x-4 lg:space-x-6">
      {visible.map(item => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link 
            key={item.href} 
            href={item.href}
            className={cn(
              "text-sm font-medium transition-colors hover:text-primary",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
