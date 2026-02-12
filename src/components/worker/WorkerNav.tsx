"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sprout,
  Truck,
  ScanLine,
  HeartPulse,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isEnabled } from "@/config/features";

// =============================================================================
// TYPES
// =============================================================================

interface NavItem {
  name: string;
  href: string;
  icon: typeof Sprout;
  /** Additional paths that should mark this nav item as active */
  additionalMatches?: string[];
  /** If true, renders as a prominent center FAB-style button */
  isScanButton?: boolean;
}

// =============================================================================
// NAV ITEMS
// =============================================================================

const allNavItems: NavItem[] = [
  {
    name: "Production",
    href: "/worker/production",
    icon: Sprout,
    additionalMatches: ["/worker/batches"],
  },
  {
    name: "Dispatch",
    href: "/worker/dispatch",
    icon: Truck,
    additionalMatches: ["/worker/picking", "/worker/orders"],
  },
  {
    name: "Scan",
    href: "/worker/scan",
    icon: ScanLine,
    isScanButton: true,
  },
  {
    name: "Plant Health",
    href: "/worker/plant-health",
    icon: HeartPulse,
    additionalMatches: ["/worker/scout"],
  },
  ...(isEnabled("materials")
    ? [{ name: "Materials" as const, href: "/worker/materials", icon: Package }]
    : []),
];

// =============================================================================
// COMPONENT
// =============================================================================

export function WorkerNav() {
  const pathname = usePathname();

  const isActive = (item: NavItem): boolean => {
    // Check main href
    if (pathname === item.href || pathname.startsWith(item.href + "/")) {
      return true;
    }
    // Check additional matches
    if (item.additionalMatches) {
      return item.additionalMatches.some(
        (match) => pathname === match || pathname.startsWith(match + "/")
      );
    }
    return false;
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex items-center justify-around">
        {allNavItems.map((item) => {
          const active = isActive(item);

          // Render scan button with special FAB styling
          if (item.isScanButton) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex flex-col items-center justify-center",
                  "min-h-[56px] min-w-[72px] px-3 py-2 transition-colors",
                  "active:scale-95" // Touch feedback
                )}
              >
                {/* FAB circle with icon */}
                <div
                  className={cn(
                    "flex items-center justify-center",
                    "h-14 w-14 -mt-6 rounded-full shadow-lg",
                    "transition-all",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/90 text-primary-foreground hover:bg-primary"
                  )}
                >
                  <item.icon className="h-7 w-7" />
                </div>
                <span
                  className={cn(
                    "text-xs mt-1",
                    active ? "font-medium text-primary" : "text-muted-foreground"
                  )}
                >
                  {item.name}
                </span>
              </Link>
            );
          }

          // Regular nav item
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center min-h-[56px] min-w-[60px] px-2 py-2 transition-colors",
                "active:bg-accent/50", // Touch feedback
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon
                className={cn("h-6 w-6 mb-1", active && "stroke-[2.5px]")}
              />
              <span className={cn("text-[10px] leading-tight text-center", active && "font-medium")}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
