"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ClipboardList, Scan, LayoutDashboard } from "lucide-react";
import { PickerFeedbackBadge } from "@/components/dispatch/picker/PickerFeedbackBadge";
import { PageFrame } from '@/ui/templates';

const pickerTabs = [
  {
    name: "My Tasks",
    href: "/dispatch/picker",
    icon: ClipboardList,
    exact: true,
  },
  {
    name: "Scan to Pick",
    href: "/dispatch/picker/scan",
    icon: Scan,
  },
];

export default function DispatchPickerLayout({
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
            {/* Picker Tabs */}
            <nav className="flex space-x-1" aria-label="Picker Tabs">
              {pickerTabs.map((tab) => {
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

            {/* Notifications & Manager Link */}
            <div className="flex items-center gap-3">
              <PickerFeedbackBadge />

              <Link
                href="/dispatch/manager"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Manager View
              </Link>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </PageFrame>
  );
}
