"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAV } from "@/config/nav";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

export default function SubNav() {
  const pathname = usePathname();
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);

  return (
    <nav className="flex items-center gap-0 flex-1">
      {APP_NAV.map((module) => {
        // Check if current page is within this module
        const isActive =
          module.href === "/"
            ? pathname === "/" || pathname.startsWith("/batches") || pathname.startsWith("/production")
            : pathname.startsWith(module.href);

        return (
          <div
            key={module.key}
            className="relative group"
            onMouseEnter={() => setHoveredModule(module.key)}
            onMouseLeave={() => setHoveredModule(null)}
          >
            <Link
              href={module.href}
              className={cn(
                "flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors hover:text-foreground relative",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {module.icon && <module.icon className="h-4 w-4" />}
              <span>{module.label}</span>
              {module.items && module.items.length > 0 && (
                <ChevronDown className="h-3 w-3" />
              )}
              {/* Active indicator - bottom border */}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </Link>

            {/* Dropdown Menu - appears on hover */}
            {module.items && module.items.length > 0 && hoveredModule === module.key && (
              <div className="absolute left-0 top-full pt-1 z-50">
                <div className="min-w-[320px] rounded-md border bg-popover p-3 shadow-lg">
                  <div className="space-y-1">
                    {module.items.map((item) => {
                      const isItemActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "block rounded-md px-3 py-2.5 transition-colors hover:bg-accent",
                            isItemActive && "bg-accent"
                          )}
                        >
                          <div className="font-medium text-sm">{item.label}</div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                              {item.description}
                            </div>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
