'use client';

import { getStatusDisplay } from '@/lib/b2b/varietyStatus';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'plenty' | 'low' | 'out';
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

/**
 * Traffic light status indicator for variety stock levels
 * Shows green/orange/red indicator based on stock availability
 */
export function StatusBadge({
  status,
  size = 'md',
  showLabel = false,
  className,
}: StatusBadgeProps) {
  const display = getStatusDisplay(status);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            data-status={status}
            className={cn(
              'flex items-center gap-1.5',
              showLabel && 'rounded-full px-2 py-1 border',
              showLabel && display.bgColor,
              showLabel && display.borderColor,
              className
            )}
          >
            <div
              className={cn(
                'rounded-full flex items-center justify-center font-bold',
                display.color,
                size === 'sm' ? 'w-3 h-3 text-[8px]' : 'w-4 h-4 text-[10px]'
              )}
              style={{ color: 'white' }}
            >
              {display.icon}
            </div>
            {showLabel && (
              <span
                className={cn(
                  'font-medium',
                  display.textColor,
                  size === 'sm' ? 'text-xs' : 'text-sm'
                )}
              >
                {display.label}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-semibold">{display.label}</p>
          <p className="text-xs text-muted-foreground">{display.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
