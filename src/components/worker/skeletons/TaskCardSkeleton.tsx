'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface TaskCardSkeletonProps {
  /** Number of skeleton cards to render */
  count?: number;
  /** Custom className */
  className?: string;
}

/**
 * Single task card skeleton
 */
function SingleTaskCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4 space-y-3',
        className
      )}
    >
      {/* Header row: badge + priority */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>

      {/* Title */}
      <Skeleton className="h-5 w-3/4" />

      {/* Description line */}
      <Skeleton className="h-4 w-full" />

      {/* Meta row: location, count, time */}
      <div className="flex items-center gap-4 pt-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20 ml-auto" />
      </div>
    </div>
  );
}

/**
 * Task card skeleton list
 */
export function TaskCardSkeleton({ count = 3, className }: TaskCardSkeletonProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SingleTaskCardSkeleton key={i} />
      ))}
    </div>
  );
}

export { SingleTaskCardSkeleton };
