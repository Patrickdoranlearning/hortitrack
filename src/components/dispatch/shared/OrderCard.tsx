'use client';

import { format, parseISO } from 'date-fns';
import { GripVertical } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { DispatchBoardOrder } from '@/lib/dispatch/types';

interface OrderCardProps {
  order: DispatchBoardOrder;
  selected: boolean;
  isDragging: boolean;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onClick: () => void;
  getStatusColor: (stage: string) => string;
  getStageLabel: (stage: string) => string;
  compact?: boolean;
}

export function OrderCard({
  order,
  selected,
  isDragging,
  onSelect,
  onDragStart,
  onDragEnd,
  onClick,
  getStatusColor,
  getStageLabel,
  compact = false,
}: OrderCardProps) {
  const orderDate = order.requestedDeliveryDate
    ? parseISO(order.requestedDeliveryDate)
    : null;

  return (
    <Card
      className={cn(
        'cursor-grab active:cursor-grabbing transition-all',
        selected && 'ring-2 ring-primary',
        isDragging && 'opacity-50'
      )}
      draggable
      onDragStart={(e) => onDragStart(e, order.id)}
      onDragEnd={onDragEnd}
    >
      <CardContent className={cn('space-y-1', compact ? 'p-2' : 'p-3')}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selected}
              onCheckedChange={onSelect}
              onClick={(e) => e.stopPropagation()}
              className="h-3.5 w-3.5"
            />
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
          </div>
          <Badge
            variant="secondary"
            className={cn(
              'text-[10px] px-1.5 py-0',
              getStatusColor(order.stage)
            )}
          >
            {getStageLabel(order.stage)}
          </Badge>
        </div>

        <button className="text-left w-full" onClick={onClick}>
          <p className="font-medium text-sm truncate">{order.customerName}</p>
          <p className="text-xs text-muted-foreground truncate">
            {order.orderNumber} • {order.county || 'No county'}
          </p>
        </button>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>
            {orderDate ? format(orderDate, 'EEE, MMM d') : 'No date'}
          </span>
          <span className="font-mono">{order.eircode || '—'}</span>
          <span>{order.trolleysEstimated || 0}t</span>
        </div>
      </CardContent>
    </Card>
  );
}
