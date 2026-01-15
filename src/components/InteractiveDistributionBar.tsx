'use client';

import * as React from "react";
import Link from "next/link";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ExternalLink, Loader2 } from "lucide-react";
import type { SimpleDistribution, DetailedDistribution } from "@/lib/history-types";

// Segment configuration with colors and labels
const SEGMENTS = [
  { key: 'available', label: 'Available', color: 'bg-emerald-500', hoverColor: 'hover:bg-emerald-400' },
  { key: 'allocatedPotting', label: 'Allocated (Potting)', color: 'bg-orange-500', hoverColor: 'hover:bg-orange-400' },
  { key: 'allocatedSales', label: 'Allocated (Sales)', color: 'bg-amber-500', hoverColor: 'hover:bg-amber-400' },
  { key: 'sold', label: 'Sold', color: 'bg-sky-500', hoverColor: 'hover:bg-sky-400' },
  { key: 'dumped', label: 'Dumped', color: 'bg-rose-500', hoverColor: 'hover:bg-rose-400' },
  { key: 'transplanted', label: 'Transplanted', color: 'bg-violet-500', hoverColor: 'hover:bg-violet-400' },
] as const;

type SegmentKey = typeof SEGMENTS[number]['key'];

interface InteractiveDistributionBarProps {
  distribution: SimpleDistribution;
  batchId?: string;
  onFetchDetails?: (batchId: string) => Promise<DetailedDistribution>;
}

export function InteractiveDistributionBar({
  distribution,
  batchId,
  onFetchDetails
}: InteractiveDistributionBarProps) {
  const [activeSegment, setActiveSegment] = React.useState<SegmentKey | null>(null);
  const [detailedData, setDetailedData] = React.useState<DetailedDistribution | null>(null);
  const [loading, setLoading] = React.useState(false);

  const total = distribution.totalAccounted;

  if (total === 0) return null;

  const getPercent = (value: number) => (value / total) * 100;

  const segments = SEGMENTS.map(seg => ({
    ...seg,
    value: distribution[seg.key] as number,
    percent: getPercent(distribution[seg.key] as number)
  })).filter(s => s.value > 0);

  const handleSegmentClick = async (segmentKey: SegmentKey) => {
    if (!batchId || !onFetchDetails) return;

    setActiveSegment(segmentKey);

    // Fetch detailed data if not already loaded
    if (!detailedData) {
      setLoading(true);
      try {
        const data = await onFetchDetails(batchId);
        setDetailedData(data);
      } catch (error) {
        console.error('Failed to fetch distribution details:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-2">
        {/* Main bar */}
        <div className="flex h-5 w-full overflow-hidden rounded-full bg-secondary">
          {segments.map((segment) => (
            <Popover key={segment.key} onOpenChange={(open) => {
              if (open) handleSegmentClick(segment.key);
              else setActiveSegment(null);
            }}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "transition-all cursor-pointer relative group",
                    segment.color,
                    segment.hoverColor,
                    batchId && onFetchDetails ? "cursor-pointer" : "cursor-default"
                  )}
                  style={{ width: `${segment.percent}%` }}
                  disabled={!batchId || !onFetchDetails}
                >
                  {/* Hover indicator */}
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <SegmentPopover
                  segment={segment}
                  detailedData={detailedData}
                  loading={loading}
                />
              </PopoverContent>
            </Popover>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {segments.map((segment) => (
            <Tooltip key={segment.key}>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-default">
                  <span className={cn("h-2.5 w-2.5 rounded-sm", segment.color)} />
                  <span className="text-muted-foreground">{segment.label}:</span>
                  <span className="font-semibold">{segment.value.toLocaleString()}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{segment.percent.toFixed(1)}% of {total.toLocaleString()} units</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

interface SegmentPopoverProps {
  segment: {
    key: SegmentKey;
    label: string;
    value: number;
    color: string;
  };
  detailedData: DetailedDistribution | null;
  loading: boolean;
}

function SegmentPopover({ segment, detailedData, loading }: SegmentPopoverProps) {
  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2 border-b pb-2">
        <span className={cn("h-3 w-3 rounded-sm", segment.color)} />
        <span className="font-semibold">{segment.label}</span>
        <span className="text-muted-foreground ml-auto">{segment.value.toLocaleString()} units</span>
      </div>

      {detailedData ? (
        <SegmentDetails segmentKey={segment.key} data={detailedData} />
      ) : (
        <div className="text-sm text-muted-foreground">No details available</div>
      )}
    </div>
  );
}

function SegmentDetails({ segmentKey, data }: { segmentKey: SegmentKey; data: DetailedDistribution }) {
  switch (segmentKey) {
    case 'available':
      return (
        <div className="text-sm text-muted-foreground">
          {data.available.toLocaleString()} units available for allocation
        </div>
      );

    case 'allocatedPotting':
      if (data.allocatedPotting.details.length === 0) {
        return <div className="text-sm text-muted-foreground">No potting allocations</div>;
      }
      return (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {data.allocatedPotting.details.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
              <div>
                <div className="font-medium">{item.planName}</div>
                <div className="text-xs text-muted-foreground">
                  Target: {item.targetDate ? new Date(item.targetDate).toLocaleDateString() : 'Not set'}
                </div>
              </div>
              <span className="font-mono font-semibold">{item.quantity}</span>
            </div>
          ))}
        </div>
      );

    case 'allocatedSales':
      if (data.allocatedSales.details.length === 0) {
        return <div className="text-sm text-muted-foreground">No sales allocations</div>;
      }
      return (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {data.allocatedSales.details.map((item) => (
            <Link
              key={item.id}
              href={`/sales/orders/${item.orderId}`}
              className="flex items-center justify-between text-sm border-b pb-2 last:border-0 hover:bg-muted/50 -mx-1 px-1 rounded"
            >
              <div>
                <div className="font-medium flex items-center gap-1">
                  Order #{item.orderNumber}
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </div>
                <div className="text-xs text-muted-foreground">{item.customerName}</div>
                {item.deliveryDate && (
                  <div className="text-xs text-muted-foreground">
                    Delivery: {new Date(item.deliveryDate).toLocaleDateString()}
                  </div>
                )}
              </div>
              <span className="font-mono font-semibold">{item.quantity}</span>
            </Link>
          ))}
        </div>
      );

    case 'sold':
      if (data.sold.details.length === 0) {
        return <div className="text-sm text-muted-foreground">No sales recorded</div>;
      }
      return (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {data.sold.details.map((item) => (
            <Link
              key={item.id}
              href={`/sales/orders/${item.orderId}`}
              className="flex items-center justify-between text-sm border-b pb-2 last:border-0 hover:bg-muted/50 -mx-1 px-1 rounded"
            >
              <div>
                <div className="font-medium flex items-center gap-1">
                  Order #{item.orderNumber}
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </div>
                <div className="text-xs text-muted-foreground">{item.customerName}</div>
                <div className="text-xs text-muted-foreground">
                  Sold: {new Date(item.soldDate).toLocaleDateString()}
                </div>
              </div>
              <span className="font-mono font-semibold">{item.quantity}</span>
            </Link>
          ))}
        </div>
      );

    case 'dumped':
      if (data.dumped.details.length === 0) {
        return <div className="text-sm text-muted-foreground">No losses recorded</div>;
      }
      return (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {data.dumped.details.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
              <div>
                <div className="font-medium text-rose-600">{item.reason}</div>
                <div className="text-xs text-muted-foreground">
                  {item.dates.length} occurrence{item.dates.length > 1 ? 's' : ''}
                </div>
              </div>
              <span className="font-mono font-semibold">{item.quantity}</span>
            </div>
          ))}
        </div>
      );

    case 'transplanted':
      if (data.transplanted.details.length === 0) {
        return <div className="text-sm text-muted-foreground">No transplants recorded</div>;
      }
      return (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {data.transplanted.details.map((item) => (
            <Link
              key={item.id}
              href={`/production/batches/${item.childBatchId}`}
              className="flex items-center justify-between text-sm border-b pb-2 last:border-0 hover:bg-muted/50 -mx-1 px-1 rounded"
            >
              <div>
                <div className="font-medium flex items-center gap-1">
                  Batch {item.childBatchNumber}
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(item.date).toLocaleDateString()}
                </div>
              </div>
              <span className="font-mono font-semibold">{item.quantity}</span>
            </Link>
          ))}
        </div>
      );

    default:
      return <div className="text-sm text-muted-foreground">No details available</div>;
  }
}

// Export a simpler non-interactive version for use in cards
export function SimpleDistributionBar({ distribution }: { distribution: SimpleDistribution }) {
  const total = distribution.totalAccounted;

  if (total === 0) return null;

  const getPercent = (value: number) => (value / total) * 100;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-secondary cursor-default">
            {SEGMENTS.map((seg) => {
              const value = distribution[seg.key] as number;
              if (value === 0) return null;
              return (
                <div
                  key={seg.key}
                  className={cn("transition-all", seg.color)}
                  style={{ width: `${getPercent(value)}%` }}
                />
              );
            })}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="p-1 space-y-1">
            <p className="font-semibold text-center mb-2">Distribution of {total.toLocaleString()} units</p>
            {SEGMENTS.map((seg) => {
              const value = distribution[seg.key] as number;
              if (value === 0) return null;
              return (
                <div key={seg.key} className="flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 rounded-sm", seg.color)} />
                    <span>{seg.label}:</span>
                  </div>
                  <span className="font-mono font-semibold">{value.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
