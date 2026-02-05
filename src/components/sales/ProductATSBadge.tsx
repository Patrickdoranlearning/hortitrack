'use client';

/**
 * ProductATSBadge - Stock Status Indicator
 *
 * Displays the Available-to-Sell (ATS) status for a product using
 * the two-tier allocation system.
 *
 * States:
 * - In Stock (green): effective_ats > low_stock_threshold
 * - Low Stock (yellow): 0 < effective_ats <= low_stock_threshold
 * - Out of Stock (red): effective_ats <= 0
 *
 * For B2B visibility, shows indicators only (not exact numbers).
 */

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Package, AlertTriangle, XCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StockStatus, ProductATS } from '@/app/sales/allocation-actions';

export interface ProductATSBadgeProps {
  /**
   * Stock status: 'in_stock' | 'low_stock' | 'out_of_stock'
   */
  status: StockStatus;
  /**
   * Effective Available-to-Sell quantity (optional, for internal use)
   */
  effectiveAts?: number;
  /**
   * Whether to show exact numbers (internal) or just status (B2B)
   */
  showQuantity?: boolean;
  /**
   * Size of the badge
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Show tooltip with details
   */
  showTooltip?: boolean;
  /**
   * Full ATS details for tooltip (optional)
   */
  atsDetails?: ProductATS;
  /**
   * Additional CSS classes
   */
  className?: string;
}

const statusConfig: Record<
  StockStatus,
  {
    label: string;
    icon: typeof CheckCircle;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    className: string;
  }
> = {
  in_stock: {
    label: 'In Stock',
    icon: CheckCircle,
    variant: 'default',
    className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100',
  },
  low_stock: {
    label: 'Low Stock',
    icon: AlertTriangle,
    variant: 'secondary',
    className: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100',
  },
  out_of_stock: {
    label: 'Out of Stock',
    icon: XCircle,
    variant: 'destructive',
    className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
  },
};

const sizeConfig = {
  sm: {
    badge: 'text-xs px-1.5 py-0.5',
    icon: 'h-3 w-3',
  },
  md: {
    badge: 'text-sm px-2 py-1',
    icon: 'h-4 w-4',
  },
  lg: {
    badge: 'text-base px-3 py-1.5',
    icon: 'h-5 w-5',
  },
};

export function ProductATSBadge({
  status,
  effectiveAts,
  showQuantity = false,
  size = 'md',
  showTooltip = false,
  atsDetails,
  className,
}: ProductATSBadgeProps) {
  const config = statusConfig[status];
  const sizeStyles = sizeConfig[size];
  const Icon = config.icon;

  const badge = (
    <Badge
      variant="outline"
      className={cn(config.className, sizeStyles.badge, className)}
    >
      <Icon className={cn(sizeStyles.icon, 'mr-1')} />
      <span>{config.label}</span>
      {showQuantity && effectiveAts !== undefined && (
        <span className="ml-1 font-mono">({effectiveAts})</span>
      )}
    </Badge>
  );

  if (!showTooltip || !atsDetails) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-2 text-sm">
            <div className="font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Stock Details
            </div>
            <div className="space-y-1 text-muted-foreground">
              <div className="flex justify-between">
                <span>Calculated Stock:</span>
                <span className="font-mono">{atsDetails.calculatedAts}</span>
              </div>
              {atsDetails.overrideAts !== null && (
                <div className="flex justify-between">
                  <span>Override:</span>
                  <span className="font-mono">{atsDetails.overrideAts}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Reserved (Tier 1):</span>
                <span className="font-mono text-amber-600">-{atsDetails.tier1Reserved}</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-medium text-foreground">
                <span>Available to Sell:</span>
                <span className="font-mono">{atsDetails.effectiveAts}</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground border-t pt-2">
              Low stock threshold: {atsDetails.lowStockThreshold}
              {atsDetails.allowOversell && ' | Overselling allowed'}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Simple status indicator for B2B portal (no numbers)
 */
export function StockStatusIndicator({
  status,
  size = 'sm',
}: {
  status: StockStatus;
  size?: 'sm' | 'md';
}) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center justify-center rounded-full p-1',
              status === 'in_stock' && 'text-green-600 bg-green-100',
              status === 'low_stock' && 'text-amber-600 bg-amber-100',
              status === 'out_of_stock' && 'text-red-600 bg-red-100'
            )}
          >
            <Icon className={iconSize} />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Oversell warning banner
 */
export function OversellWarning({
  quantityRequested,
  quantityAvailable,
  className,
}: {
  quantityRequested: number;
  quantityAvailable: number;
  className?: string;
}) {
  const shortage = quantityRequested - quantityAvailable;

  if (shortage <= 0) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 p-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm',
        className
      )}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        <strong>Warning:</strong> Requesting {quantityRequested} but only{' '}
        {quantityAvailable} available. Order may be short by {shortage} units.
      </span>
    </div>
  );
}

export default ProductATSBadge;
