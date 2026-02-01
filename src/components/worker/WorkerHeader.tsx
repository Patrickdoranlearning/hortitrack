"use client";

import { useState } from "react";
import { Leaf, Menu } from "lucide-react";
import { OfflineIndicator } from "@/components/worker/OfflineIndicator";
import { MoreMenuSheet } from "@/components/worker/MoreMenuSheet";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface WorkerHeaderProps {
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Worker App Header
 *
 * Branded header with:
 * - HortiTrack logo (Leaf icon + text in brand green)
 * - Online/Offline status indicator
 * - More menu button (hamburger) that opens side sheet
 */
export function WorkerHeader({ className }: WorkerHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-inset-top",
          className
        )}
      >
        <div className="flex h-14 items-center justify-between px-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Leaf className="h-6 w-6 text-green-600" strokeWidth={2.5} />
            <span className="text-lg font-semibold text-green-600">
              HortiTrack
            </span>
          </div>

          {/* Right side: Status + Menu button */}
          <div className="flex items-center gap-2">
            {/* Online/Offline indicator badge */}
            <OfflineIndicator />

            {/* More menu button */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className={cn(
                "flex items-center justify-center",
                "h-10 w-10 rounded-lg", // Touch target 40px
                "transition-colors",
                "hover:bg-accent active:bg-accent/80"
              )}
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      {/* More Menu Sheet */}
      <MoreMenuSheet open={menuOpen} onOpenChange={setMenuOpen} />
    </>
  );
}
