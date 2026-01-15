'use client';

import { format, parseISO, getWeek } from 'date-fns';
import { GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { DispatchBoardOrder, ActiveDeliveryRunSummary } from '@/lib/dispatch/types';
import type { GrowerMember } from '@/server/dispatch/queries.server';

interface ListViewProps {
  orders: DispatchBoardOrder[];
  loads: ActiveDeliveryRunSummary[];
  growers: GrowerMember[];
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  allSelected: boolean;
  onDateChange: (orderId: string, date: Date | undefined) => void;
  onPickerChange: (orderId: string, pickerId: string) => void;
  onLoadChange: (orderId: string, loadId: string) => void;
  onDragStart: (e: React.DragEvent, orderId: string) => void;
  onDragEnd: () => void;
  onViewOrder: (order: DispatchBoardOrder) => void;
  getStatusColor: (stage: string) => string;
  getStageLabel: (stage: string) => string;
}

export function ListView({
  orders,
  loads,
  growers,
  selectedIds,
  toggleSelect,
  toggleSelectAll,
  allSelected,
  onDateChange,
  onPickerChange,
  onLoadChange,
  onDragStart,
  onDragEnd,
  onViewOrder,
  getStatusColor,
  getStageLabel,
}: ListViewProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="w-[100px]">Date</TableHead>
              <TableHead className="w-[60px] text-center">Wk</TableHead>
              <TableHead className="w-[100px]">Order</TableHead>
              <TableHead className="min-w-[180px]">Customer</TableHead>
              <TableHead className="w-[100px]">County</TableHead>
              <TableHead className="w-[90px]">Eircode</TableHead>
              <TableHead className="w-[50px] text-center">DC</TableHead>
              <TableHead className="w-[160px]">Load</TableHead>
              <TableHead className="w-[140px]">Picker</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={12}
                  className="h-32 text-center text-muted-foreground"
                >
                  No orders found
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => {
                const orderDate = order.requestedDeliveryDate
                  ? parseISO(order.requestedDeliveryDate)
                  : null;
                const week = orderDate ? getWeek(orderDate) : null;

                return (
                  <TableRow
                    key={order.id}
                    className={cn(
                      'group',
                      selectedIds.has(order.id) && 'bg-primary/5'
                    )}
                    draggable
                    onDragStart={(e) => onDragStart(e, order.id)}
                    onDragEnd={onDragEnd}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(order.id)}
                        onCheckedChange={() => toggleSelect(order.id)}
                      />
                    </TableCell>
                    <TableCell className="cursor-grab">
                      <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                    </TableCell>
                    <TableCell>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 font-normal"
                          >
                            {orderDate ? format(orderDate, 'dd/MM') : '—'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={orderDate || undefined}
                            onSelect={(date) => onDateChange(order.id, date)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {week || '—'}
                    </TableCell>
                    <TableCell>
                      <button
                        className="font-medium text-primary hover:underline"
                        onClick={() => onViewOrder(order)}
                      >
                        {order.orderNumber}
                      </button>
                    </TableCell>
                    <TableCell className="font-medium truncate max-w-[200px]">
                      {order.customerName || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {order.county || '—'}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">
                        {order.eircode || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {order.trolleysEstimated || '—'}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={order.deliveryRunId || 'none'}
                        onValueChange={(v) => onLoadChange(order.id, v)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="— None —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          {loads.map((load) => (
                            <SelectItem key={load.id} value={load.id}>
                              {load.loadCode || load.runNumber}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={order.pickerId || 'none'}
                        onValueChange={(v) => onPickerChange(order.id, v)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="— None —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          {growers.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn('text-xs', getStatusColor(order.stage))}
                      >
                        {getStageLabel(order.stage)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
