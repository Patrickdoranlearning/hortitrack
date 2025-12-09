'use client';

import { useState, useMemo } from 'react';
import { format, parseISO, isToday, isTomorrow, isThisWeek, getWeek } from 'date-fns';
import { 
  Truck, 
  User, 
  Calendar as CalendarIcon, 
  GripVertical,
  MapPin,
  Package,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X
} from 'lucide-react';

import { DispatchBoardOrder, ActiveDeliveryRunSummary } from '@/lib/dispatch/types';
import { Haulier } from '@/lib/types';
import type { AttributeOption } from '@/lib/attributeOptions';
import type { GrowerMember } from '@/server/dispatch/queries.server';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import OrderSummaryDialog from './OrderSummaryDialog';

// --- FILTER & SORT OPTIONS ---
type DateFilter = 'all' | 'today' | 'tomorrow' | 'this_week';
type SortField = 'orderNumber' | 'customerName' | 'county' | 'eircode' | 'week' | 'trolleys' | 'route' | 'picker' | 'status';
type SortDirection = 'asc' | 'desc';

interface ColumnFilters {
  county: string;
  eircode: string;
  route: string;
  picker: string;
  status: string;
}

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
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Column filters state
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({
    county: '',
    eircode: '',
    route: '',
    picker: '',
    status: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Order summary modal state
  const [selectedOrder, setSelectedOrder] = useState<DispatchBoardOrder | null>(null);

  // Get route color by looking up in routes array
  const getRouteColor = (routeName?: string) => {
    if (!routeName) return undefined;
    const route = routes.find(r => r.displayLabel === routeName || r.systemCode === routeName);
    return route?.color;
  };

  // Filter and sort orders
  const filteredAndSortedOrders = useMemo(() => {
    let result = [...orders];
    
    // Date filter
    if (dateFilter !== 'all') {
      result = result.filter(order => {
        if (!order.requestedDeliveryDate) return dateFilter === 'all';
        const date = parseISO(order.requestedDeliveryDate);
        
        switch (dateFilter) {
          case 'today': return isToday(date);
          case 'tomorrow': return isTomorrow(date);
          case 'this_week': return isThisWeek(date);
          default: return true;
        }
      });
    }
    
    // Column filters
    if (columnFilters.county) {
      result = result.filter(o => 
        o.county?.toLowerCase().includes(columnFilters.county.toLowerCase())
      );
    }
    if (columnFilters.eircode) {
      result = result.filter(o => 
        o.eircode?.toLowerCase().includes(columnFilters.eircode.toLowerCase())
      );
    }
    if (columnFilters.route) {
      result = result.filter(o => 
        o.routeName?.toLowerCase().includes(columnFilters.route.toLowerCase()) ||
        o.deliveryRunNumber?.toLowerCase().includes(columnFilters.route.toLowerCase())
      );
    }
    if (columnFilters.picker) {
      result = result.filter(o => 
        o.pickerName?.toLowerCase().includes(columnFilters.picker.toLowerCase())
      );
    }
    if (columnFilters.status && columnFilters.status !== 'all') {
      result = result.filter(o => o.stage === columnFilters.status);
    }
    
    // Sorting
    if (sortField) {
      result.sort((a, b) => {
        let aVal: string | number = '';
        let bVal: string | number = '';
        
        switch (sortField) {
          case 'orderNumber':
            aVal = a.orderNumber || '';
            bVal = b.orderNumber || '';
            break;
          case 'customerName':
            aVal = a.customerName || '';
            bVal = b.customerName || '';
            break;
          case 'county':
            aVal = a.county || '';
            bVal = b.county || '';
            break;
          case 'eircode':
            aVal = a.eircode || '';
            bVal = b.eircode || '';
            break;
          case 'week':
            aVal = a.requestedDeliveryDate ? getWeek(parseISO(a.requestedDeliveryDate)) : 0;
            bVal = b.requestedDeliveryDate ? getWeek(parseISO(b.requestedDeliveryDate)) : 0;
            break;
          case 'trolleys':
            aVal = a.trolleysEstimated || 0;
            bVal = b.trolleysEstimated || 0;
            break;
          case 'route':
            aVal = a.routeName || a.deliveryRunNumber || '';
            bVal = b.routeName || b.deliveryRunNumber || '';
            break;
          case 'picker':
            aVal = a.pickerName || '';
            bVal = b.pickerName || '';
            break;
          case 'status':
            aVal = a.stage || '';
            bVal = b.stage || '';
            break;
        }
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        const comparison = String(aVal).localeCompare(String(bVal));
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }
    
    return result;
  }, [orders, dateFilter, columnFilters, sortField, sortDirection]);

  // Select all / none
  const allSelected = filteredAndSortedOrders.length > 0 && filteredAndSortedOrders.every(o => selectedIds.has(o.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedOrders.map(o => o.id)));
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

  // Handle sort toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Get sort icon
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  // Clear all filters
  const clearFilters = () => {
    setColumnFilters({
      county: '',
      eircode: '',
      route: '',
      picker: '',
      status: ''
    });
  };

  const hasActiveFilters = Object.values(columnFilters).some(v => v !== '');

  // Dispatch selected orders
  const handleDispatchSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.error('No orders selected');
      return;
    }

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

  // Drag and drop handlers with improved visual feedback
  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    setDraggedId(orderId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', orderId);
    
    // Add drag image
    const target = e.target as HTMLElement;
    target.style.opacity = '0.5';
  };

  const handleDragOver = (e: React.DragEvent, orderId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(orderId);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetOrder: DispatchBoardOrder) => {
    e.preventDefault();
    const draggedOrderId = e.dataTransfer.getData('text/plain');
    
    setDraggedId(null);
    setDragOverId(null);
    
    if (draggedOrderId === targetOrder.id) {
      return;
    }

    // If target has a route, assign dragged order to same route
    if (targetOrder.deliveryRunId) {
      toast.promise(
        assignOrderToRun(draggedOrderId, targetOrder.deliveryRunId),
        {
          loading: 'Assigning to route...',
          success: `Added to ${targetOrder.routeName || targetOrder.deliveryRunNumber || 'route'}`,
          error: 'Failed to assign'
        }
      );
    } else {
      toast.info('Drop on an order with a route to assign');
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
    setDraggedId(null);
    setDragOverId(null);
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
      const parts = value.split(':');
      const haulierId = parts[1];
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
      case 'to_pick': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case 'picking': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'ready_to_load': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'on_route': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
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

  // Render route badge with color
  const renderRouteBadge = (order: DispatchBoardOrder) => {
    const displayName = order.routeName || order.deliveryRunNumber;
    if (!displayName) return <span className="text-muted-foreground">—</span>;
    
    const color = order.routeColor || getRouteColor(order.routeName);
    
    return (
      <Badge 
        variant="secondary" 
        className="font-normal"
        style={color ? { 
          backgroundColor: color, 
          color: getContrastColor(color),
          borderColor: color 
        } : undefined}
      >
        {displayName}
      </Badge>
    );
  };

  // Helper to determine text color based on background
  const getContrastColor = (hexColor: string) => {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  };

  // Sortable header component
  const SortableHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead className={cn("cursor-pointer select-none hover:bg-muted/80", className)} onClick={() => handleSort(field)}>
      <div className="flex items-center">
        {children}
        {getSortIcon(field)}
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
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

          {/* Toggle Filters */}
          <Button 
            variant={showFilters ? "secondary" : "outline"} 
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <Badge variant="default" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                {Object.values(columnFilters).filter(v => v !== '').length}
              </Badge>
            )}
          </Button>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
              <X className="h-3 w-3" />
              Clear
            </Button>
          )}

          <span className="text-sm text-muted-foreground">
            {filteredAndSortedOrders.length} orders
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

      {/* Filter Row */}
      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-3 bg-muted/50 rounded-lg border">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">County</label>
            <Input
              placeholder="Filter..."
              value={columnFilters.county}
              onChange={(e) => setColumnFilters(prev => ({ ...prev, county: e.target.value }))}
              className="h-8"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Eircode</label>
            <Input
              placeholder="Filter..."
              value={columnFilters.eircode}
              onChange={(e) => setColumnFilters(prev => ({ ...prev, eircode: e.target.value }))}
              className="h-8"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Route</label>
            <Input
              placeholder="Filter..."
              value={columnFilters.route}
              onChange={(e) => setColumnFilters(prev => ({ ...prev, route: e.target.value }))}
              className="h-8"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Picker</label>
            <Input
              placeholder="Filter..."
              value={columnFilters.picker}
              onChange={(e) => setColumnFilters(prev => ({ ...prev, picker: e.target.value }))}
              className="h-8"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Status</label>
            <Select 
              value={columnFilters.status || 'all'} 
              onValueChange={(v) => setColumnFilters(prev => ({ ...prev, status: v === 'all' ? '' : v }))}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="to_pick">To Pick</SelectItem>
                <SelectItem value="picking">Picking</SelectItem>
                <SelectItem value="ready_to_load">Ready</SelectItem>
                <SelectItem value="on_route">On Route</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

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

        {filteredAndSortedOrders.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            No orders found
          </div>
        ) : (
          filteredAndSortedOrders.map((order) => {
            const routeColor = order.routeColor || getRouteColor(order.routeName);
            return (
              <Card 
                key={order.id}
                className={cn(
                  "transition-colors overflow-hidden",
                  selectedIds.has(order.id) && "ring-2 ring-primary"
                )}
                style={routeColor ? { borderLeftColor: routeColor, borderLeftWidth: '4px' } : undefined}
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
                      <button 
                        className="font-semibold hover:underline text-left"
                        onClick={() => setSelectedOrder(order)}
                      >
                        #{order.orderNumber}
                      </button>
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

                  {/* Info Row: Week, County, Eircode, Trolleys */}
                  <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
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

                    {order.eircode && (
                      <Badge variant="outline" className="text-xs font-mono">
                        {order.eircode}
                      </Badge>
                    )}
                    
                    <span className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {order.trolleysEstimated || 0}
                    </span>
                  </div>

                  {/* Route badge with color */}
                  {(order.routeName || order.deliveryRunNumber) && (
                    <div className="flex items-center gap-2">
                      <Truck className="h-3 w-3 text-muted-foreground" />
                      {renderRouteBadge(order)}
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
            );
          })
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
              <SortableHeader field="orderNumber" className="w-[100px]">Order</SortableHeader>
              <SortableHeader field="customerName" className="min-w-[150px]">Store</SortableHeader>
              <SortableHeader field="county" className="w-[100px]">County</SortableHeader>
              <SortableHeader field="eircode" className="w-[100px]">Eircode</SortableHeader>
              <SortableHeader field="week" className="w-[80px] text-center">Week</SortableHeader>
              <SortableHeader field="trolleys" className="w-[80px] text-center">Trolleys</SortableHeader>
              <SortableHeader field="route" className="w-[140px]">Route</SortableHeader>
              <SortableHeader field="picker" className="w-[150px]">Picker</SortableHeader>
              <SortableHeader field="status" className="w-[100px]">Status</SortableHeader>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-32 text-center text-muted-foreground">
                  No orders found
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedOrders.map((order) => (
                <TableRow 
                  key={order.id}
                  className={cn(
                    "group transition-all duration-150",
                    draggedId === order.id && "opacity-50 bg-muted",
                    dragOverId === order.id && order.deliveryRunId && "bg-primary/10 ring-2 ring-primary ring-inset",
                    dragOverId === order.id && !order.deliveryRunId && "bg-muted/50",
                    selectedIds.has(order.id) && "bg-primary/5"
                  )}
                  draggable
                  onDragStart={(e) => handleDragStart(e, order.id)}
                  onDragOver={(e) => handleDragOver(e, order.id)}
                  onDragLeave={handleDragLeave}
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

                  {/* Order Number - Clickable */}
                  <TableCell className="font-medium">
                    <button 
                      className="hover:underline text-primary"
                      onClick={() => setSelectedOrder(order)}
                    >
                      #{order.orderNumber}
                    </button>
                  </TableCell>

                  {/* Store */}
                  <TableCell className="min-w-[150px] max-w-[200px] truncate font-medium" title={order.customerName}>
                    {order.customerName || <span className="text-muted-foreground">—</span>}
                  </TableCell>

                  {/* County */}
                  <TableCell>
                    {order.county ? (
                      <Badge variant="outline" className="font-normal">
                        {order.county}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Eircode */}
                  <TableCell>
                    {order.eircode ? (
                      <span className="font-mono text-sm">{order.eircode}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
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

                  {/* Route with color */}
                  <TableCell>
                    {(deliveryRuns.length > 0 || routes.length > 0 || hauliers.length > 0) ? (
                      <Select 
                        value={order.deliveryRunId || 'none'} 
                        onValueChange={(v) => handleRouteChange(order.id, v, order.requestedDeliveryDate)}
                      >
                        <SelectTrigger className="h-8 w-full border-transparent bg-transparent hover:bg-muted">
                          {order.deliveryRunId ? (
                            renderRouteBadge(order)
                          ) : (
                            <SelectValue placeholder="— None —" />
                          )}
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
                    ) : (
                      <span className="text-xs text-muted-foreground">No routes</span>
                    )}
                  </TableCell>

                  {/* Picker */}
                  <TableCell>
                    {order.pickerName ? (
                      <Badge variant="secondary" className="font-normal">
                        {order.pickerName}
                      </Badge>
                    ) : growers.length > 0 ? (
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
                    ) : (
                      <span className="text-xs text-muted-foreground">No pickers</span>
                    )}
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

      {/* Order Summary Dialog */}
      <OrderSummaryDialog
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
}
