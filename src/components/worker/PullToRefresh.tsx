'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface PullToRefreshProps {
  /** Callback when refresh is triggered */
  onRefresh: () => Promise<void>;
  /** Whether refresh is currently in progress (controlled mode) */
  refreshing?: boolean;
  /** Children to render (scrollable content) */
  children: React.ReactNode;
  /** Pull distance required to trigger refresh (default: 80) */
  threshold?: number;
  /** Maximum pull distance (default: 120) */
  maxPull?: number;
  /** Custom className for container */
  className?: string;
  /** Whether pull to refresh is enabled (default: true) */
  enabled?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PullToRefresh({
  onRefresh,
  refreshing: controlledRefreshing,
  children,
  threshold = 80,
  maxPull = 120,
  className,
  enabled = true,
}: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [internalRefreshing, setInternalRefreshing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const currentYRef = useRef<number>(0);

  const isRefreshing = controlledRefreshing ?? internalRefreshing;

  // Calculate pull progress (0 to 1)
  const pullProgress = Math.min(pullDistance / threshold, 1);

  // Check if we can pull (only when at top of scroll)
  const canPull = useCallback(() => {
    if (!enabled || isRefreshing) return false;
    const container = containerRef.current;
    if (!container) return false;
    return container.scrollTop <= 0;
  }, [enabled, isRefreshing]);

  // Handle touch start
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!canPull()) return;
    startYRef.current = e.touches[0].clientY;
    currentYRef.current = e.touches[0].clientY;
  }, [canPull]);

  // Handle touch move
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!canPull() && !pulling) return;

    currentYRef.current = e.touches[0].clientY;
    const diff = currentYRef.current - startYRef.current;

    // Only start pulling if moving down and at top
    if (diff > 0 && canPull()) {
      setPulling(true);

      // Apply resistance as we pull further
      const resistance = Math.min(diff * 0.5, maxPull);
      setPullDistance(resistance);

      // Prevent default scroll when pulling
      if (diff > 10) {
        e.preventDefault();
      }
    }
  }, [canPull, pulling, maxPull]);

  // Handle touch end
  const handleTouchEnd = useCallback(async () => {
    if (!pulling) return;

    setPulling(false);

    // If pulled past threshold, trigger refresh
    if (pullDistance >= threshold) {
      setInternalRefreshing(true);
      setPullDistance(threshold); // Keep indicator visible during refresh

      try {
        await onRefresh();
      } finally {
        setInternalRefreshing(false);
        setPullDistance(0);
      }
    } else {
      // Animate back to 0
      setPullDistance(0);
    }
  }, [pulling, pullDistance, threshold, onRefresh]);

  // Attach touch event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Reset when controlled refreshing ends
  useEffect(() => {
    if (!controlledRefreshing && pullDistance > 0) {
      setPullDistance(0);
    }
  }, [controlledRefreshing, pullDistance]);

  return (
    <div
      ref={containerRef}
      className={cn('overflow-auto', className)}
    >
      {/* Pull indicator */}
      <div
        className={cn(
          'flex items-center justify-center overflow-hidden',
          'transition-[height] duration-200 ease-out',
          !pulling && !isRefreshing && 'duration-300'
        )}
        style={{
          height: pullDistance > 0 || isRefreshing ? Math.max(pullDistance, isRefreshing ? 60 : 0) : 0,
        }}
      >
        <div
          className={cn(
            'flex items-center justify-center',
            'h-10 w-10 rounded-full',
            'bg-primary/10 text-primary',
            'transition-transform duration-200'
          )}
          style={{
            transform: `rotate(${pullProgress * 360}deg) scale(${0.5 + pullProgress * 0.5})`,
          }}
        >
          <RefreshCw
            className={cn(
              'h-5 w-5',
              isRefreshing && 'animate-spin'
            )}
          />
        </div>
      </div>

      {/* Content */}
      <div
        className="transition-transform duration-200 ease-out"
        style={{
          transform: pulling && pullDistance > 0 ? `translateY(0)` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
