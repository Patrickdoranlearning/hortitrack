"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Users,
  ClipboardCheck,
  UserCircle,
  Car,
} from "lucide-react";
import { PageFrame } from '@/ui/templates';

const managerTabs = [
  {
    name: "Overview",
    href: "/dispatch/manager",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    name: "Orders",
    href: "/dispatch/manager/orders",
    icon: Package,
  },
  {
    name: "Picking",
    href: "/dispatch/manager/picking",
    icon: Users,
  },
  {
    name: "QC Review",
    href: "/dispatch/manager/qc",
    icon: ClipboardCheck,
  },
];

const viewTabs = [
  {
    name: "Picker View",
    href: "/dispatch/picker",
    icon: UserCircle,
  },
  {
    name: "Driver View",
    href: "/dispatch/driver",
    icon: Car,
  },
];

export default function DispatchManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isTabActive = (tab: { href: string; exact?: boolean }) => {
    if (tab.exact) {
      return pathname === tab.href;
    }
    return pathname.startsWith(tab.href);
  };

  return (
    <PageFrame moduleKey="dispatch">
      <div className="flex flex-col h-full -mx-4 -mt-6">
        {/* Tab Navigation */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between px-4">
            {/* Main Manager Tabs */}
            <nav className="flex space-x-1" aria-label="Dispatch Manager Tabs">
              {managerTabs.map((tab) => {
                const isActive = isTabActive(tab);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                      "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                      isActive
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
                    )}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.name}
                  </Link>
                );
              })}
            </nav>

            {/* View Switcher */}
            <div className="flex items-center gap-2 border-l pl-4">
              <span className="text-xs text-muted-foreground">Switch to:</span>
              {viewTabs.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.name}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </PageFrame>
  );
}
