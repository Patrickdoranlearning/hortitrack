'use client';

import { format, parseISO } from 'date-fns';
import { GripVertical } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { DispatchBoardOrder, ActiveDeliveryRunSummary } from '@/lib/dispatch/types';
import type { GrowerMember } from '@/server/dispatch/queries.server';

interface OrderCardFullProps {
  order: DispatchBoardOrder;
  loads: ActiveDeliveryRunSummary[];
  growers: GrowerMember[];
  selected: boolean;
  isDragging: boolean;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onClick: () => void;
  onPickerChange: (orderId: string, pickerId: string) => void;
  onLoadChange: (orderId: string, loadId: string) => void;
  getStatusColor: (stage: string) => string;
  getStageLabel: (stage: string) => string;
}

export function OrderCardFull({
  order,
  loads,
  growers,
  selected,
  isDragging,
  onSelect,
  onDragStart,
  onDragEnd,
  onClick,
  onPickerChange,
  onLoadChange,
  getStatusColor,
  getStageLabel,
}: OrderCardFullProps) {
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
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selected}
              onCheckedChange={onSelect}
              onClick={(e) => e.stopPropagation()}
            />
            <GripVertical className="h-4 w-4 text-muted-foreground/50" />
          </div>
          <Badge
            variant="secondary"
            className={cn('text-xs', getStatusColor(order.stage))}
          >
            {getStageLabel(order.stage)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <button className="text-left w-full" onClick={onClick}>
          <p className="font-semibold">{order.customerName}</p>
          <p className="text-sm text-muted-foreground">{order.orderNumber}</p>
        </button>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Date</p>
            <p>{orderDate ? format(orderDate, 'MMM d') : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Trolleys</p>
            <p>{order.trolleysEstimated || 0}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">County</p>
            <p>{order.county || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Eircode</p>
            <p className="font-mono text-xs">{order.eircode || '—'}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Select
            value={order.deliveryRunId || 'none'}
            onValueChange={(v) => onLoadChange(order.id, v)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Assign to load..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— No Load —</SelectItem>
              {loads.map((load) => (
                <SelectItem key={load.id} value={load.id}>
                  {load.loadName || load.runNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={order.pickerId || 'none'}
            onValueChange={(v) => onPickerChange(order.id, v)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Assign picker..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— No Picker —</SelectItem>
              {growers.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
