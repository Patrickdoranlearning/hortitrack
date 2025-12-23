"use client";

import Link from "next/link";
import { Truck, LayoutDashboard, UserCircle } from "lucide-react";
import { PageFrame } from '@/ui/templates';

export default function DispatchDriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageFrame moduleKey="dispatch">
      <div className="flex flex-col h-full -mx-4 -mt-6">
        {/* Tab Navigation */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between px-4">
            {/* Driver Title */}
            <div className="flex items-center gap-2 py-3">
              <Truck className="h-5 w-5 text-primary" />
              <span className="font-semibold">Driver View</span>
            </div>

            {/* View Switcher */}
            <div className="flex items-center gap-2 border-l pl-4">
              <span className="text-xs text-muted-foreground">Switch to:</span>
              <Link
                href="/dispatch/picker"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <UserCircle className="h-3.5 w-3.5" />
                Picker View
              </Link>
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
