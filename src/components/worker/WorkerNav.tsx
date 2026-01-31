"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  href: string;
  icon: typeof Home;
  exact?: boolean;
}

const navItems: NavItem[] = [
  {
    name: "Home",
    href: "/worker",
    icon: Home,
    exact: true,
  },
  {
    name: "Schedule",
    href: "/worker/schedule",
    icon: Calendar,
  },
  {
    name: "Stats",
    href: "/worker/stats",
    icon: BarChart3,
  },
];

export function WorkerNav() {
  const pathname = usePathname();

  const isActive = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center min-h-[56px] min-w-[72px] px-3 py-2 transition-colors",
                "active:bg-accent/50", // Touch feedback
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-6 w-6 mb-1",
                  active && "stroke-[2.5px]"
                )}
              />
              <span
                className={cn(
                  "text-xs",
                  active && "font-medium"
                )}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
