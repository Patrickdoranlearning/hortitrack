'use client';

import { useState, useMemo } from 'react';
import { format, parseISO, isToday, isTomorrow, isThisWeek, getWeek } from 'date-fns';
import { 
  Truck, 
  User, 
  Calendar as CalendarIcon, 
  GripVertical,
  MapPin,
  Package
} from 'lucide-react';

import { DispatchBoardOrder, ActiveDeliveryRunSummary } from '@/lib/dispatch/types';
import { Haulier } from '@/lib/types';
import type { AttributeOption } from '@/lib/attributeOptions';
import type { GrowerMember } from '@/server/dispatch/queries.server';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import { 
  assignOrderToPicker, 
  assignOrderToRun, 
  createRunAndAssign, 
  updateOrderDate,
  dispatchOrders
} from '@/server/dispatch/board-actions';
import { toast } from 'sonner';

// --- FILTER OPTIONS ---
type DateFilter = 'all' | 'today' | 'tomorrow' | 'this_week';

// --- MAIN COMPONENT ---

interface DispatchTableProps {
  orders: DispatchBoardOrder[];
  hauliers: Haulier[];
  growers: GrowerMember[];
  routes: AttributeOption[];
  deliveryRuns: ActiveDeliveryRunSummary[];
}

export default function DispatchTable({
  orders,
  hauliers,
  growers,
  routes,
  deliveryRuns,
}: DispatchTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Filter orders by date
  const filteredOrders = useMemo(() => {
    if (dateFilter === 'all') return orders;
    
    return orders.filter(order => {
      if (!order.requestedDeliveryDate) return dateFilter === 'all';
      const date = parseISO(order.requestedDeliveryDate);
      
      switch (dateFilter) {
        case 'today': return isToday(date);
        case 'tomorrow': return isTomorrow(date);
        case 'this_week': return isThisWeek(date);
        default: return true;
      }
    });
  }, [orders, dateFilter]);

  // Select all / none
  const allSelected = filteredOrders.length > 0 && filteredOrders.every(o => selectedIds.has(o.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // Dispatch selected orders
  const handleDispatchSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.error('No orders selected');
      return;
    }

    // Get first available haulier for new route
    const haulierId = hauliers[0]?.id;

    toast.promise(
      dispatchOrders(ids, undefined, haulierId),
      {
        loading: `Dispatching ${ids.length} orders...`,
        success: (result) => {
          setSelectedIds(new Set());
          if (result.warning) {
            return result.warning;
          }
          return `${ids.length} orders dispatched`;
        },
        error: (err) => err.error || 'Failed to dispatch orders'
      }
    );
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    setDraggedId(orderId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', orderId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetOrder: DispatchBoardOrder) => {
    e.preventDefault();
    const draggedOrderId = e.dataTransfer.getData('text/plain');
    
    if (draggedOrderId === targetOrder.id) {
      setDraggedId(null);
      return;
    }

    // If target has a route, assign dragged order to same route
    if (targetOrder.deliveryRunId) {
      toast.promise(
        assignOrderToRun(draggedOrderId, targetOrder.deliveryRunId),
        {
          loading: 'Assigning to route...',
          success: `Added to ${targetOrder.deliveryRunNumber || 'route'}`,
          error: 'Failed to assign'
        }
      );
    }

    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  // Inline handlers
  const handleDateChange = async (orderId: string, date: Date | undefined) => {
    if (!date) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    toast.promise(updateOrderDate(orderId, dateStr), {
      loading: 'Updating...',
      success: 'Date updated',
      error: 'Failed'
    });
  };

  const handlePickerChange = async (orderId: string, pickerId: string) => {
    toast.promise(assignOrderToPicker(orderId, pickerId === 'none' ? null : pickerId), {
      loading: 'Assigning...',
      success: 'Picker assigned',
      error: 'Failed'
    });
  };

  const handleRouteChange = async (orderId: string, value: string, requestedDate?: string) => {
    if (value.startsWith('new:')) {
      const haulierId = value.split(':')[1];
      const date = requestedDate || format(new Date(), 'yyyy-MM-dd');
      toast.promise(createRunAndAssign(orderId, haulierId, date), {
        loading: 'Creating route...',
        success: 'Route created',
        error: 'Failed'
      });
    } else if (value !== 'none') {
      toast.promise(assignOrderToRun(orderId, value), {
        loading: 'Assigning...',
        success: 'Route assigned',
        error: 'Failed'
      });
    }
  };

  // Status badge color
  const getStatusColor = (stage: string) => {
    switch (stage) {
      case 'to_pick': return 'bg-orange-100 text-orange-700';
      case 'picking': return 'bg-blue-100 text-blue-700';
      case 'ready_to_load': return 'bg-purple-100 text-purple-700';
      case 'on_route': return 'bg-green-100 text-green-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStageLabel = (stage: string) => {
    switch (stage) {
      case 'to_pick': return 'To Pick';
      case 'picking': return 'Picking';
      case 'ready_to_load': return 'Ready';
      case 'on_route': return 'On Route';
      default: return stage;
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          {/* Date Filter */}
          <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
            <SelectTrigger className="w-[140px]">
              <CalendarIcon className="h-4 w-4 mr-2 opacity-50" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="tomorrow">Tomorrow</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-sm text-muted-foreground">
            {filteredOrders.length} orders
          </span>
        </div>

        {/* Bulk Action */}
        <Button 
          onClick={handleDispatchSelected}
          disabled={selectedIds.size === 0}
          className="gap-2"
        >
          <Truck className="h-4 w-4" />
          <span className="hidden sm:inline">Dispatch Selected</span>
          <span className="sm:hidden">Dispatch</span>
          ({selectedIds.size})
        </Button>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {/* Select All for Mobile */}
        <div className="flex items-center gap-2 px-1">
          <Checkbox 
            checked={allSelected}
            onCheckedChange={toggleSelectAll}
            aria-label="Select all"
          />
          <span className="text-sm text-muted-foreground">Select all</span>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            No orders found
          </div>
        ) : (
          filteredOrders.map((order) => (
            <Card 
              key={order.id}
              className={cn(
                "transition-colors",
                selectedIds.has(order.id) && "ring-2 ring-primary"
              )}
            >
              <CardContent className="p-4 space-y-3">
                {/* Header Row: Checkbox, Order #, Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox 
                      checked={selectedIds.has(order.id)}
                      onCheckedChange={() => toggleSelect(order.id)}
                      aria-label={`Select order ${order.orderNumber}`}
                    />
                    <span className="font-semibold">#{order.orderNumber}</span>
                  </div>
                  <Badge 
                    variant="secondary" 
                    className={cn("font-normal", getStatusColor(order.stage))}
                  >
                    {getStageLabel(order.stage)}
                  </Badge>
                </div>

                {/* Store Name */}
                <div className="font-medium text-lg">
                  {order.customerName || <span className="text-muted-foreground">—</span>}
                </div>

                {/* Info Row: Week, County, Trolleys */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 px-2 gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {order.requestedDeliveryDate 
                          ? `W${getWeek(parseISO(order.requestedDeliveryDate))}`
                          : '—'
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={order.requestedDeliveryDate ? parseISO(order.requestedDeliveryDate) : undefined}
                        onSelect={(date) => handleDateChange(order.id, date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  
                  {order.county && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {order.county}
                    </span>
                  )}
                  
                  <span className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {order.trolleysEstimated || 0} trolleys
                  </span>
                </div>

                {/* Haulier if assigned */}
                {order.haulierName && (
                  <div className="text-sm flex items-center gap-2">
                    <Truck className="h-3 w-3 text-muted-foreground" />
                    <span>{order.haulierName}</span>
                  </div>
                )}

                {/* Dropdowns: Route & Picker */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Select 
                    value={order.deliveryRunId || 'none'} 
                    onValueChange={(v) => handleRouteChange(order.id, v, order.requestedDeliveryDate)}
                  >
                    <SelectTrigger className="h-9">
                      <Truck className="h-3 w-3 mr-1 opacity-50" />
                      <SelectValue placeholder="Route" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-muted-foreground">
                        — None —
                      </SelectItem>
                      {deliveryRuns.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Active Runs</SelectLabel>
                          {deliveryRuns.map(run => (
                            <SelectItem key={run.id} value={run.id}>
                              {run.runNumber}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {routes.length > 0 && (
                        <>
                          <Separator className="my-1" />
                          <SelectGroup>
                            <SelectLabel>Create Route</SelectLabel>
                            {routes.map(route => (
                              <SelectItem key={route.id} value={`new:${hauliers[0]?.id || 'default'}:${route.systemCode}`}>
                                + {route.displayLabel}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </>
                      )}
                      {hauliers.length > 0 && (
                        <>
                          <Separator className="my-1" />
                          <SelectGroup>
                            <SelectLabel>New Run (by Haulier)</SelectLabel>
                            {hauliers.map(h => (
                              <SelectItem key={h.id} value={`new:${h.id}`}>
                                + {h.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </>
                      )}
                    </SelectContent>
                  </Select>

                  <Select 
                    value={order.pickerId || 'none'} 
                    onValueChange={(v) => handlePickerChange(order.id, v)}
                  >
                    <SelectTrigger className="h-9">
                      <User className="h-3 w-3 mr-1 opacity-50" />
                      <SelectValue placeholder="Picker" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-muted-foreground">
                        — None —
                      </SelectItem>
                      {growers.map(grower => (
                        <SelectItem key={grower.id} value={grower.id}>
                          {grower.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[50px]">
                <Checkbox 
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="w-[100px]">Order</TableHead>
              <TableHead className="min-w-[150px]">Store</TableHead>
              <TableHead className="w-[100px]">County</TableHead>
              <TableHead className="w-[80px] text-center">Week</TableHead>
              <TableHead className="w-[80px] text-center">Trolleys</TableHead>
              <TableHead className="w-[150px]">Haulier</TableHead>
              <TableHead className="w-[180px]">Route</TableHead>
              <TableHead className="w-[150px]">Picker</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-32 text-center text-muted-foreground">
                  No orders found
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <TableRow 
                  key={order.id}
                  className={cn(
                    "group transition-colors",
                    draggedId === order.id && "opacity-50",
                    selectedIds.has(order.id) && "bg-primary/5"
                  )}
                  draggable
                  onDragStart={(e) => handleDragStart(e, order.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, order)}
                  onDragEnd={handleDragEnd}
                >
                  {/* Checkbox */}
                  <TableCell>
                    <Checkbox 
                      checked={selectedIds.has(order.id)}
                      onCheckedChange={() => toggleSelect(order.id)}
                      aria-label={`Select order ${order.orderNumber}`}
                    />
                  </TableCell>

                  {/* Drag Handle */}
                  <TableCell className="cursor-grab active:cursor-grabbing">
                    <GripVertical className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground" />
                  </TableCell>

                  {/* Order Number */}
                  <TableCell className="font-medium">
                    #{order.orderNumber}
                  </TableCell>

                  {/* Store */}
                  <TableCell className="min-w-[150px] max-w-[200px] truncate font-medium" title={order.customerName}>
                    {order.customerName || <span className="text-muted-foreground">—</span>}
                  </TableCell>

                  {/* County */}
                  <TableCell>
                    {order.county && (
                      <Badge variant="outline" className="font-normal">
                        {order.county}
                      </Badge>
                    )}
                  </TableCell>

                  {/* Week Number */}
                  <TableCell className="text-center">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-2 font-medium hover:bg-muted"
                        >
                          {order.requestedDeliveryDate 
                            ? `W${getWeek(parseISO(order.requestedDeliveryDate))}`
                            : '—'
                          }
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={order.requestedDeliveryDate ? parseISO(order.requestedDeliveryDate) : undefined}
                          onSelect={(date) => handleDateChange(order.id, date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </TableCell>

                  {/* Trolleys */}
                  <TableCell className="text-center text-muted-foreground">
                    {order.trolleysEstimated || '—'}
                  </TableCell>

                  {/* Haulier */}
                  <TableCell>
                    {order.haulierName ? (
                      <span className="text-sm">{order.haulierName}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Route */}
                  <TableCell>
                    <Select 
                      value={order.deliveryRunId || 'none'} 
                      onValueChange={(v) => handleRouteChange(order.id, v, order.requestedDeliveryDate)}
                    >
                      <SelectTrigger className="h-8 w-full border-transparent bg-transparent hover:bg-muted">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-muted-foreground">
                          — None —
                        </SelectItem>
                        {deliveryRuns.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>Active Runs</SelectLabel>
                            {deliveryRuns.map(run => (
                              <SelectItem key={run.id} value={run.id}>
                                {run.runNumber}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                        {routes.length > 0 && (
                          <>
                            <Separator className="my-1" />
                            <SelectGroup>
                              <SelectLabel>Create Route</SelectLabel>
                              {routes.map(route => (
                                <SelectItem key={route.id} value={`new:${hauliers[0]?.id || 'default'}:${route.systemCode}`}>
                                  + {route.displayLabel}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </>
                        )}
                        {hauliers.length > 0 && (
                          <>
                            <Separator className="my-1" />
                            <SelectGroup>
                              <SelectLabel>New Run (by Haulier)</SelectLabel>
                              {hauliers.map(h => (
                                <SelectItem key={h.id} value={`new:${h.id}`}>
                                  + {h.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  {/* Picker */}
                  <TableCell>
                    <Select 
                      value={order.pickerId || 'none'} 
                      onValueChange={(v) => handlePickerChange(order.id, v)}
                    >
                      <SelectTrigger className="h-8 w-full border-transparent bg-transparent hover:bg-muted">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-muted-foreground">
                          — None —
                        </SelectItem>
                        {growers.map(grower => (
                          <SelectItem key={grower.id} value={grower.id}>
                            {grower.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Badge 
                      variant="secondary" 
                      className={cn("font-normal", getStatusColor(order.stage))}
                    >
                      {getStageLabel(order.stage)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
