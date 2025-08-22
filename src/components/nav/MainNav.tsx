
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
    <nav className="space-y-1 p-2">
      <div className="px-2 text-xs uppercase text-muted-foreground">Sales</div>
      {visible.map(item => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon!;
        return (
          <Link key={item.href} href={item.href} className="block">
            <Button variant={active ? "secondary" : "ghost"} className={cn("w-full justify-start gap-2")}>
              {Icon && <Icon className="h-4 w-4" />}
              <span>{item.label}</span>
            </Button>
          </Link>
        );
      })}
    </nav>
  );
}
