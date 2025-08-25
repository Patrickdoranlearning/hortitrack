"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ShoppingCart,
  Users,
  Truck,
  FileText,
  Receipt,
  Settings,
} from "lucide-react";

type Item = { href: string; label: string; icon: React.ComponentType<any> };

const items: Item[] = [
  { href: "/sales", label: "Orders", icon: ShoppingCart },
  { href: "/sales/customers", label: "Customers", icon: Users },
  { href: "/sales/deliveries", label: "Deliveries", icon: Truck },
  { href: "/sales/invoices", label: "Invoices", icon: FileText },
  { href: "/sales/credits", label: "Credit Notes", icon: Receipt },
  { href: "/sales/settings", label: "Settings", icon: Settings },
];

export function SalesSidebar() {
  const pathname = usePathname();

  return (
    <aside className="h-full w-64 border-r bg-white">
      <div className="p-4">
        <h2 className="font-semibold text-lg">Sales</h2>
      </div>
      <nav className="px-2">
        <ul className="space-y-1">
          {items.map((it) => {
            const active =
              pathname === it.href || (it.href !== "/sales" && pathname?.startsWith(it.href));
            const Icon = it.icon;
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-green-50 text-green-800"
                      : "text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{it.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
