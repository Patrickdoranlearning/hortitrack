"use client";

import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WeekSelectorProps {
  weekStart: string;
  weekEnd: string;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onThisWeek: () => void;
  isCurrentWeek: boolean;
}

/**
 * Week navigation selector with prev/next buttons and "This Week" shortcut
 */
export function WeekSelector({
  weekStart,
  weekEnd,
  onPreviousWeek,
  onNextWeek,
  onThisWeek,
  isCurrentWeek,
}: WeekSelectorProps) {
  // Format dates for display
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  const startFormatted = formatDate(weekStart);
  const endFormatted = formatDate(weekEnd);

  return (
    <div className="flex flex-col gap-3 mb-4">
      {/* Main navigation row */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={onPreviousWeek}
          className="min-h-[44px] min-w-[44px] shrink-0"
          aria-label="Previous week"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-2 text-center flex-1 justify-center">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium text-sm sm:text-base">
            {startFormatted} - {endFormatted}
          </span>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={onNextWeek}
          className="min-h-[44px] min-w-[44px] shrink-0"
          aria-label="Next week"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* This Week button */}
      {!isCurrentWeek && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onThisWeek}
          className="w-full min-h-[44px]"
        >
          <Calendar className="h-4 w-4 mr-2" />
          Jump to This Week
        </Button>
      )}
    </div>
  );
}
