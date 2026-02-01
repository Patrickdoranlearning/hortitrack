'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StatCardSkeletonProps {
  /** Custom className */
  className?: string;
}

/**
 * Single stat card skeleton
 */
function SingleStatCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-lg p-3 text-center bg-muted/50',
        className
      )}
    >
      {/* Icon */}
      <Skeleton className="h-5 w-5 mx-auto mb-1 rounded" />
      {/* Value */}
      <Skeleton className="h-8 w-12 mx-auto mb-1" />
      {/* Label */}
      <Skeleton className="h-3 w-16 mx-auto" />
    </div>
  );
}

/**
 * Stats row skeleton (3 cards)
 */
export function StatCardSkeleton({ className }: StatCardSkeletonProps) {
  return (
    <div className={cn('grid grid-cols-3 gap-3', className)}>
      <SingleStatCardSkeleton />
      <SingleStatCardSkeleton />
      <SingleStatCardSkeleton />
    </div>
  );
}

export { SingleStatCardSkeleton };
