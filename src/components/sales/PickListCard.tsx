'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { 
  Package, 
  Clock, 
  MapPin, 
  User, 
  ChevronRight,
  PlayCircle,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PickListCardData {
  id: string;
  orderNumber?: string;
  customerName?: string;
  requestedDeliveryDate?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  sequence: number;
  totalItems?: number;
  pickedItems?: number;
  totalQty?: number;
  pickedQty?: number;
  teamName?: string;
  assignedTeamId?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  notes?: string;
  startedAt?: string;
  county?: string;
}

interface PickListCardProps {
  pickList: PickListCardData;
  onSelect: (id: string) => void;
  onStart?: (id: string) => void;
  showSequence?: boolean;
  compact?: boolean;
  isAssignedToMe?: boolean;
}

const statusConfig = {
  pending: {
    label: 'Pending',
    variant: 'secondary' as const,
    icon: Clock,
    color: 'text-muted-foreground',
    bg: 'bg-muted/50',
  },
  in_progress: {
    label: 'In Progress',
    variant: 'default' as const,
    icon: PlayCircle,
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950',
  },
  completed: {
    label: 'Completed',
    variant: 'outline' as const,
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-50 dark:bg-green-950',
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'destructive' as const,
    icon: AlertCircle,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
  },
};

export default function PickListCard({
  pickList,
  onSelect,
  onStart,
  showSequence = false,
  compact = false,
  isAssignedToMe = false,
}: PickListCardProps) {
  const config = statusConfig[pickList.status];
  const StatusIcon = config.icon;
  const progress = pickList.totalItems && pickList.pickedItems !== undefined
    ? Math.round((pickList.pickedItems / pickList.totalItems) * 100)
    : 0;

  return (
    <Card
      className={cn(
        'relative overflow-hidden cursor-pointer transition-all duration-200',
        'hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]',
        'border-l-4',
        pickList.status === 'pending' && 'border-l-muted-foreground',
        pickList.status === 'in_progress' && 'border-l-blue-500',
        pickList.status === 'completed' && 'border-l-green-500',
        pickList.status === 'cancelled' && 'border-l-destructive',
        isAssignedToMe && 'ring-2 ring-primary ring-offset-2',
        config.bg
      )}
      onClick={() => onSelect(pickList.id)}
    >
      <div className={cn('p-4', compact && 'p-3')}>
        {/* Priority indicator */}
        {isAssignedToMe && (
          <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-bl">
            ASSIGNED TO YOU
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            {showSequence && (
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm shrink-0",
                isAssignedToMe ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
              )}>
                {pickList.sequence}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-semibold text-lg truncate">
                Order #{pickList.orderNumber || pickList.id.slice(0, 8)}
              </div>
              {pickList.customerName && (
                <div className="text-sm text-muted-foreground truncate">
                  {pickList.customerName}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant={config.variant} className="shrink-0">
              <StatusIcon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
            {pickList.assignedUserName && !isAssignedToMe && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" />
                {pickList.assignedUserName}
              </span>
            )}
          </div>
        </div>

        {/* Info Row */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground mb-3">
          {pickList.requestedDeliveryDate && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{format(new Date(pickList.requestedDeliveryDate), 'EEE, MMM d')}</span>
            </div>
          )}
          {pickList.totalItems !== undefined && (
            <div className="flex items-center gap-1">
              <Package className="h-4 w-4" />
              <span>{pickList.totalItems} items</span>
            </div>
          )}
          {pickList.totalQty !== undefined && (
            <div className="flex items-center gap-1">
              <span>{pickList.totalQty} units</span>
            </div>
          )}
        </div>

        {/* Progress Bar (for in_progress) */}
        {pickList.status === 'in_progress' && pickList.totalItems && (
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{pickList.pickedItems} / {pickList.totalItems} items</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          {pickList.status === 'pending' && onStart ? (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onStart(pickList.id);
              }}
              className="gap-1"
            >
              <PlayCircle className="h-4 w-4" />
              Start Picking
            </Button>
          ) : (
            <div className="text-xs text-muted-foreground">
              {pickList.startedAt && (
                <>Started {format(new Date(pickList.startedAt), 'p')}</>
              )}
            </div>
          )}
          <Button variant="ghost" size="sm" className="gap-1">
            View Details
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

