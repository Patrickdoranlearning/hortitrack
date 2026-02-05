'use client';

/**
 * AllocationTimeline - Inventory Event Audit Trail
 *
 * Displays the history of allocation events for an order or order item.
 * Shows the full audit trail from the inventory_events table.
 *
 * Event types:
 * - PRODUCT_RESERVED: Tier 1 allocation created
 * - PRODUCT_UNRESERVED: Tier 1 allocation cancelled
 * - BATCH_ALLOCATED: Tier 2 allocation (batch selected)
 * - BATCH_DEALLOCATED: Tier 2 allocation cancelled
 * - BATCH_PICKED: Items physically picked
 * - BATCH_SHIPPED: Order dispatched
 * - SHORTAGE_RECORDED: Short pick recorded
 * - OVERSELL_RECORDED: Oversell warning logged
 */

import { useState, useEffect } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Package,
  ArrowRight,
  Check,
  X,
  Truck,
  AlertTriangle,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  History,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAllocationEvents } from '@/app/sales/allocation-actions';

type InventoryEventType =
  | 'PRODUCT_RESERVED'
  | 'PRODUCT_UNRESERVED'
  | 'BATCH_ALLOCATED'
  | 'BATCH_DEALLOCATED'
  | 'BATCH_PICKED'
  | 'BATCH_PICK_REVERSED'
  | 'BATCH_SHIPPED'
  | 'MANUAL_ADJUSTMENT'
  | 'SHORTAGE_RECORDED'
  | 'OVERSELL_RECORDED';

interface TimelineEvent {
  id: string;
  eventType: InventoryEventType;
  quantityChange: number;
  occurredAt: string;
  metadata: Record<string, any>;
  actorId: string | null;
}

interface AllocationTimelineProps {
  /** Order ID to show events for */
  orderId?: string;
  /** Order Item ID to show events for (more specific) */
  orderItemId?: string;
  /** Allocation ID to show events for (most specific) */
  allocationId?: string;
  /** Title for the timeline section */
  title?: string;
  /** Maximum number of events to show initially */
  initialLimit?: number;
  /** Show as collapsible section */
  collapsible?: boolean;
  /** Start collapsed */
  defaultCollapsed?: boolean;
  /** Additional class names */
  className?: string;
}

const eventConfig: Record<
  InventoryEventType,
  {
    label: string;
    icon: typeof Package;
    color: string;
    bgColor: string;
  }
> = {
  PRODUCT_RESERVED: {
    label: 'Product Reserved',
    icon: Package,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  PRODUCT_UNRESERVED: {
    label: 'Reservation Released',
    icon: X,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  BATCH_ALLOCATED: {
    label: 'Batch Selected',
    icon: ArrowRight,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  BATCH_DEALLOCATED: {
    label: 'Batch Released',
    icon: X,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  BATCH_PICKED: {
    label: 'Items Picked',
    icon: Check,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  BATCH_PICK_REVERSED: {
    label: 'Pick Reversed',
    icon: RefreshCw,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
  BATCH_SHIPPED: {
    label: 'Shipped',
    icon: Truck,
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  MANUAL_ADJUSTMENT: {
    label: 'Manual Adjustment',
    icon: User,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  SHORTAGE_RECORDED: {
    label: 'Shortage Recorded',
    icon: AlertTriangle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
  OVERSELL_RECORDED: {
    label: 'Oversell Warning',
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
};

export function AllocationTimeline({
  orderId,
  orderItemId,
  allocationId,
  title = 'Allocation History',
  initialLimit = 5,
  collapsible = true,
  defaultCollapsed = false,
  className,
}: AllocationTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [isOpen, setIsOpen] = useState(!defaultCollapsed);

  // Fetch events
  useEffect(() => {
    async function fetchEvents() {
      if (!orderId && !orderItemId && !allocationId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await getAllocationEvents({
          orderId,
          orderItemId,
          allocationId,
        });

        if (result.error) {
          setError(result.error);
          setEvents([]);
        } else {
          setEvents((result.data || []) as TimelineEvent[]);
        }
      } catch (err) {
        setError('Failed to load events');
        setEvents([]);
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, [orderId, orderItemId, allocationId]);

  // Displayed events (limited unless expanded)
  const displayedEvents = showAll ? events : events.slice(0, initialLimit);
  const hasMore = events.length > initialLimit;

  // Format the event description
  const formatEventDescription = (event: TimelineEvent): string => {
    const { eventType, quantityChange, metadata } = event;

    switch (eventType) {
      case 'PRODUCT_RESERVED':
        return `Reserved ${Math.abs(quantityChange)} units at product level`;
      case 'PRODUCT_UNRESERVED':
        return `Released ${quantityChange} units from product reservation`;
      case 'BATCH_ALLOCATED':
        return `Allocated ${Math.abs(quantityChange)} units from batch ${metadata.batch_number || 'unknown'}`;
      case 'BATCH_DEALLOCATED':
        return `Released ${quantityChange} units from batch allocation`;
      case 'BATCH_PICKED':
        return `Picked ${Math.abs(quantityChange)} units`;
      case 'BATCH_PICK_REVERSED':
        return `Reversed pick of ${quantityChange} units`;
      case 'BATCH_SHIPPED':
        return `Shipped ${Math.abs(quantityChange)} units`;
      case 'SHORTAGE_RECORDED':
        return `Short by ${quantityChange} units`;
      case 'OVERSELL_RECORDED':
        return `Oversold by ${quantityChange} units`;
      case 'MANUAL_ADJUSTMENT':
        return `Manual adjustment: ${quantityChange > 0 ? '+' : ''}${quantityChange} units`;
      default:
        return `${eventType}: ${quantityChange} units`;
    }
  };

  const content = (
    <div className="space-y-1">
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="text-sm text-destructive flex items-center gap-2 py-2">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      ) : events.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No allocation events yet
        </div>
      ) : (
        <>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

            {/* Events */}
            <div className="space-y-0">
              {displayedEvents.map((event, index) => {
                const config = eventConfig[event.eventType] || {
                  label: event.eventType,
                  icon: Package,
                  color: 'text-gray-600',
                  bgColor: 'bg-gray-100',
                };
                const Icon = config.icon;
                const isLast = index === displayedEvents.length - 1;

                return (
                  <div
                    key={event.id}
                    className={cn(
                      'relative pl-10 pb-4',
                      isLast && 'pb-0'
                    )}
                  >
                    {/* Icon */}
                    <div
                      className={cn(
                        'absolute left-0 w-8 h-8 rounded-full flex items-center justify-center',
                        config.bgColor
                      )}
                    >
                      <Icon className={cn('h-4 w-4', config.color)} />
                    </div>

                    {/* Content */}
                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{config.label}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatEventDescription(event)}
                          </p>
                        </div>
                        <time
                          className="text-xs text-muted-foreground whitespace-nowrap"
                          title={format(new Date(event.occurredAt), 'PPpp')}
                        >
                          {formatDistanceToNow(new Date(event.occurredAt), {
                            addSuffix: true,
                          })}
                        </time>
                      </div>

                      {/* Metadata badges */}
                      {event.metadata && Object.keys(event.metadata).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {event.metadata.batch_number && (
                            <Badge variant="outline" className="text-xs">
                              Batch: {event.metadata.batch_number}
                            </Badge>
                          )}
                          {event.metadata.is_oversell && (
                            <Badge variant="destructive" className="text-xs">
                              Oversell
                            </Badge>
                          )}
                          {event.metadata.shortage_quantity && (
                            <Badge variant="secondary" className="text-xs">
                              Short: {event.metadata.shortage_quantity}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Show more / less */}
          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Show {events.length - initialLimit} more
                </>
              )}
            </Button>
          )}
        </>
      )}
    </div>
  );

  if (!collapsible) {
    return (
      <div className={cn('space-y-3', className)}>
        <h3 className="text-sm font-medium flex items-center gap-2">
          <History className="h-4 w-4" />
          {title}
        </h3>
        {content}
      </div>
    );
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn('space-y-2', className)}
    >
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between px-2">
          <span className="flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4" />
            {title}
            {events.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {events.length}
              </Badge>
            )}
          </span>
          {isOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2">{content}</CollapsibleContent>
    </Collapsible>
  );
}

export default AllocationTimeline;
