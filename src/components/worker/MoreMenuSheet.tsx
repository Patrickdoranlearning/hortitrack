"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  BarChart3,
  Printer,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

// =============================================================================
// TYPES
// =============================================================================

interface MoreMenuItem {
  name: string;
  href: string;
  icon: typeof Calendar;
  description: string;
}

interface MoreMenuSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// =============================================================================
// MENU ITEMS
// =============================================================================

const moreMenuItems: MoreMenuItem[] = [
  {
    name: "Team",
    href: "/worker/team",
    icon: Users,
    description: "See team activity",
  },
  {
    name: "My Stats",
    href: "/worker/stats",
    icon: BarChart3,
    description: "View your productivity",
  },
  {
    name: "Locations",
    href: "/worker/locations",
    icon: MapPin,
    description: "Browse polytunnels and zones",
  },
  {
    name: "Print Labels",
    href: "/worker/print",
    icon: Printer,
    description: "Print batch, location labels",
  },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function MoreMenuSheet({ open, onOpenChange }: MoreMenuSheetProps) {
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[300px] sm:w-[340px]">
        <SheetHeader className="text-left">
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription className="sr-only">
            Additional navigation options
          </SheetDescription>
        </SheetHeader>
        <nav className="mt-6 flex flex-col gap-1">
          {moreMenuItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-lg transition-colors",
                  "min-h-[48px]", // Touch target
                  "active:scale-[0.98]",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-accent text-foreground"
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full shrink-0",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className={cn("font-medium text-sm", isActive && "text-primary")}>
                    {item.name}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
