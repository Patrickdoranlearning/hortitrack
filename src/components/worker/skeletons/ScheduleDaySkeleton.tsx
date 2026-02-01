'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ScheduleDaySkeletonProps {
  /** Number of days to render */
  count?: number;
  /** Custom className */
  className?: string;
}

/**
 * Single schedule day section skeleton
 */
function SingleDaySkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {/* Day header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-16" />
      </div>

      {/* Task cards for the day */}
      <div className="space-y-2">
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}

/**
 * Schedule day skeleton list
 */
export function ScheduleDaySkeleton({ count = 3, className }: ScheduleDaySkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SingleDaySkeleton key={i} />
      ))}
    </div>
  );
}

export { SingleDaySkeleton };
