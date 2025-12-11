'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { format, parseISO, getWeek, getYear } from 'date-fns';
import {
  Truck,
  User,
  Calendar as CalendarIcon,
  GripVertical,
  Plus,
  LayoutList,
  LayoutGrid,
  Grid3X3,
  Filter,
  X,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  MapPin,
  Package,
  TrendingUp,
  Send,
  Undo2,
  CheckCircle2,
} from 'lucide-react';

import { DispatchBoardOrder, ActiveDeliveryRunSummary } from '@/lib/dispatch/types';
import type { HaulierWithVehicles, HaulierVehicle } from '@/lib/types';
import type { AttributeOption } from '@/lib/attributeOptions';
import type { GrowerMember } from '@/server/dispatch/queries.server';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import {
  assignOrderToPicker,
  assignOrderToRun,
  createEmptyRoute,
  updateLoad,
  deleteLoad,
  removeOrderFromLoad,
  updateOrderDate,
  dispatchOrders,
  dispatchLoad,
  recallLoad
} from '@/server/dispatch/board-actions';
import { toast } from 'sonner';
import OrderSummaryDialog from './OrderSummaryDialog';

// Types
type ViewMode = 'list' | 'loads' | 'cards';
type DateFilter = 'all' | 'today' | 'tomorrow' | 'this_week' | 'next_week';

interface ColumnFilters {
  search: string;
  county: string;
  week: string;
  picker: string;
  status: string;
}

interface DispatchBoardProps {
  orders: DispatchBoardOrder[];
  hauliers: HaulierWithVehicles[];
  growers: GrowerMember[];
  routes: AttributeOption[];
  deliveryRuns: ActiveDeliveryRunSummary[];
}

const UNASSIGNED_BIN = '__unassigned__';

export default function DispatchBoard({
  orders,
  hauliers,
  growers,
  routes,
  deliveryRuns,
}: DispatchBoardProps) {
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('loads');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [weekFilter, setWeekFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({
    search: '',
    county: '',
    week: '',
    picker: '',
    status: '',
  });

  // Drag state
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [dragOverBin, setDragOverBin] = useState<string | null>(null);

  // Load management state
  const [collapsedLoads, setCollapsedLoads] = useState<Set<string>>(new Set());
  const [editingLoad, setEditingLoad] = useState<ActiveDeliveryRunSummary | null>(null);
  const [deletingLoadId, setDeletingLoadId] = useState<string | null>(null);

  // Dialog state
  const [selectedOrder, setSelectedOrder] = useState<DispatchBoardOrder | null>(null);
  const [newLoadDialogOpen, setNewLoadDialogOpen] = useState(false);
  const [newLoadDate, setNewLoadDate] = useState<Date | undefined>(new Date());
  const [newLoadName, setNewLoadName] = useState('');
  const [newLoadHaulier, setNewLoadHaulier] = useState<string>('');
  const [newLoadVehicle, setNewLoadVehicle] = useState<string>('');

  // Split pane resize
  const [leftPanelWidth, setLeftPanelWidth] = useState(380);
  const resizeRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  // Get unique weeks from orders and delivery runs
  const availableWeeks = useMemo(() => {
    const weeks = new Set<number>();
    orders.forEach(o => {
      if (o.requestedDeliveryDate) {
        weeks.add(getWeek(parseISO(o.requestedDeliveryDate)));
      }
    });
    deliveryRuns.forEach(r => {
      if (r.weekNumber) weeks.add(r.weekNumber);
    });
    return Array.from(weeks).sort((a, b) => a - b);
  }, [orders, deliveryRuns]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    let result = [...orders];

    // Date filter
    if (dateFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const endOfWeek = new Date(today);
      endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
      const endOfNextWeek = new Date(endOfWeek);
      endOfNextWeek.setDate(endOfNextWeek.getDate() + 7);

      result = result.filter(order => {
        if (!order.requestedDeliveryDate) return false;
        const date = parseISO(order.requestedDeliveryDate);
        date.setHours(0, 0, 0, 0);

        switch (dateFilter) {
          case 'today': return date.getTime() === today.getTime();
          case 'tomorrow': return date.getTime() === tomorrow.getTime();
          case 'this_week': return date >= today && date <= endOfWeek;
          case 'next_week': return date > endOfWeek && date <= endOfNextWeek;
          default: return true;
        }
      });
    }

    // Week filter
    if (weekFilter !== 'all') {
      const weekNum = parseInt(weekFilter);
      result = result.filter(order => {
        if (!order.requestedDeliveryDate) return false;
        return getWeek(parseISO(order.requestedDeliveryDate)) === weekNum;
      });
    }

    // Search filter
    if (columnFilters.search) {
      const search = columnFilters.search.toLowerCase();
      result = result.filter(o =>
        o.orderNumber?.toLowerCase().includes(search) ||
        o.customerName?.toLowerCase().includes(search) ||
        o.eircode?.toLowerCase().includes(search)
      );
    }

    // Column filters
    if (columnFilters.county) {
      result = result.filter(o =>
        o.county?.toLowerCase().includes(columnFilters.county.toLowerCase())
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

    // Sort by date, then customer name
    result.sort((a, b) => {
      const dateA = a.requestedDeliveryDate || '';
      const dateB = b.requestedDeliveryDate || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return (a.customerName || '').localeCompare(b.customerName || '');
    });

    return result;
  }, [orders, dateFilter, weekFilter, columnFilters]);

  // Filter loads by week
  const filteredLoads = useMemo(() => {
    if (weekFilter === 'all') return deliveryRuns;
    const weekNum = parseInt(weekFilter);
    return deliveryRuns.filter(r => r.weekNumber === weekNum);
  }, [deliveryRuns, weekFilter]);

  // Group orders by load
  const ordersByLoad = useMemo(() => {
    const grouped: Record<string, DispatchBoardOrder[]> = {
      [UNASSIGNED_BIN]: [],
    };

    filteredLoads.forEach(load => {
      grouped[load.id] = [];
    });

    filteredOrders.forEach(order => {
      if (order.deliveryRunId && grouped[order.deliveryRunId]) {
        grouped[order.deliveryRunId].push(order);
      } else {
        grouped[UNASSIGNED_BIN].push(order);
      }
    });

    return grouped;
  }, [filteredOrders, filteredLoads]);

  // County summary for unassigned orders
  const countySummary = useMemo(() => {
    const summary: Record<string, { count: number; trolleys: number }> = {};
    (ordersByLoad[UNASSIGNED_BIN] || []).forEach(order => {
      const county = order.county || 'Unknown';
      if (!summary[county]) {
        summary[county] = { count: 0, trolleys: 0 };
      }
      summary[county].count += 1;
      summary[county].trolleys += order.trolleysEstimated || 0;
    });
    return Object.entries(summary)
      .sort((a, b) => b[1].trolleys - a[1].trolleys)
      .slice(0, 6);
  }, [ordersByLoad]);

  // Load gaps - which loads need more orders
  const loadGaps = useMemo(() => {
    return filteredLoads
      .filter(load => load.fillPercentage < 80 && load.vehicleCapacity)
      .map(load => {
        const currentTrolleys = load.totalTrolleysAssigned;
        const capacity = load.vehicleCapacity || 20;
        const needed = capacity - currentTrolleys;
        
        // Find counties of orders in this load
        const loadOrders = ordersByLoad[load.id] || [];
        const counties = [...new Set(loadOrders.map(o => o.county).filter(Boolean))];
        
        return {
          load,
          needed,
          targetCounties: counties,
        };
      })
      .filter(g => g.needed > 0);
  }, [filteredLoads, ordersByLoad]);

  // Selection handlers
  const allSelected = filteredOrders.length > 0 && 
    filteredOrders.filter(o => !o.deliveryRunId).every(o => selectedIds.has(o.id));

  const toggleSelectAll = () => {
    const unassigned = filteredOrders.filter(o => !o.deliveryRunId);
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unassigned.map(o => o.id)));
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

  // Clear filters
  const clearFilters = () => {
    setColumnFilters({ search: '', county: '', week: '', picker: '', status: '' });
    setWeekFilter('all');
    setDateFilter('all');
  };

  const hasActiveFilters = Object.values(columnFilters).some(v => v !== '') || 
    weekFilter !== 'all' || dateFilter !== 'all';

  // Action handlers
  const handleDateChange = async (orderId: string, date: Date | undefined) => {
    if (!date) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    toast.promise(updateOrderDate(orderId, dateStr), {
      loading: 'Updating date...',
      success: 'Date updated',
      error: 'Failed to update date'
    });
  };

  const handlePickerChange = async (orderId: string, pickerId: string) => {
    const value = pickerId === 'none' ? null : pickerId;
    toast.promise(assignOrderToPicker(orderId, value), {
      loading: 'Assigning picker...',
      success: 'Picker assigned',
      error: 'Failed to assign picker'
    });
  };

  const handleLoadChange = async (orderId: string, loadId: string) => {
    if (loadId === 'none') {
      toast.promise(removeOrderFromLoad(orderId), {
        loading: 'Removing from load...',
        success: 'Removed from load',
        error: 'Failed to remove'
      });
    } else {
      toast.promise(assignOrderToRun(orderId, loadId), {
        loading: 'Assigning to load...',
        success: 'Added to load',
        error: 'Failed to assign'
      });
    }
  };

  const handleCreateNewLoad = async () => {
    if (!newLoadDate) return;
    const dateStr = format(newLoadDate, 'yyyy-MM-dd');

    toast.promise(
      createEmptyRoute(
        dateStr, 
        newLoadHaulier || undefined, 
        newLoadVehicle || undefined,
        newLoadName || undefined
      ),
      {
        loading: 'Creating load...',
        success: () => {
          setNewLoadDialogOpen(false);
          setNewLoadName('');
          setNewLoadHaulier('');
          setNewLoadVehicle('');
          return 'Load created';
        },
        error: 'Failed to create load'
      }
    );
  };

  // Get vehicles for selected haulier
  const selectedHaulierVehicles = useMemo(() => {
    if (!newLoadHaulier) return [];
    const haulier = hauliers.find(h => h.id === newLoadHaulier);
    return haulier?.vehicles || [];
  }, [newLoadHaulier, hauliers]);

  const handleUpdateLoad = async () => {
    if (!editingLoad) return;
    
    toast.promise(
      updateLoad(editingLoad.id, {
        loadName: editingLoad.loadName,
        haulierId: editingLoad.haulierId,
        vehicleId: editingLoad.vehicleId,
        runDate: editingLoad.runDate,
      }),
      {
        loading: 'Updating load...',
        success: () => {
          setEditingLoad(null);
          return 'Load updated';
        },
        error: 'Failed to update load'
      }
    );
  };

  const handleDeleteLoad = async () => {
    if (!deletingLoadId) return;
    
    toast.promise(
      deleteLoad(deletingLoadId),
      {
        loading: 'Deleting load...',
        success: () => {
          setDeletingLoadId(null);
          return 'Load deleted';
        },
        error: (err) => err.error || 'Failed to delete load'
      }
    );
  };

  const handleDispatchLoad = async (loadId: string, loadName: string, orderCount: number) => {
    if (orderCount === 0) {
      toast.error('No orders in this load to dispatch');
      return;
    }
    
    toast.promise(
      dispatchLoad(loadId),
      {
        loading: `Dispatching ${loadName}...`,
        success: (result) => {
          if (result.error) throw new Error(result.error);
          return `${loadName} dispatched with ${result.ordersDispatched} orders`;
        },
        error: (err) => err.message || 'Failed to dispatch load'
      }
    );
  };

  const handleRecallLoad = async (loadId: string, loadName: string) => {
    toast.promise(
      recallLoad(loadId),
      {
        loading: `Recalling ${loadName}...`,
        success: (result) => {
          if (result.error) throw new Error(result.error);
          return `${loadName} recalled - ${result.ordersRecalled} orders reverted`;
        },
        error: (err) => err.message || 'Failed to recall load'
      }
    );
  };

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
          if (result.warning) return result.warning;
          return `${ids.length} orders dispatched`;
        },
        error: (err) => err.error || 'Failed to dispatch orders'
      }
    );
  };

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, orderId: string) => {
    setDraggedOrderId(orderId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', orderId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, loadId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverBin(loadId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverBin(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, loadId: string) => {
    e.preventDefault();
    const orderId = e.dataTransfer.getData('text/plain');
    setDraggedOrderId(null);
    setDragOverBin(null);

    if (!orderId) return;

    if (loadId === UNASSIGNED_BIN) {
      toast.promise(removeOrderFromLoad(orderId), {
        loading: 'Removing from load...',
        success: 'Removed from load',
        error: 'Failed to remove'
      });
    } else {
      toast.promise(assignOrderToRun(orderId, loadId), {
        loading: 'Moving to load...',
        success: 'Order moved',
        error: 'Failed to move order'
      });
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedOrderId(null);
    setDragOverBin(null);
  }, []);

  // Collapse/expand load
  const toggleLoadCollapse = (loadId: string) => {
    const newSet = new Set(collapsedLoads);
    if (newSet.has(loadId)) {
      newSet.delete(loadId);
    } else {
      newSet.add(loadId);
    }
    setCollapsedLoads(newSet);
  };

  // Resize handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.min(Math.max(280, e.clientX), 600);
      setLeftPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startResize = () => {
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  // Status helpers
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

  const getFillColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {/* View Toggle */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList className="h-9">
              <TabsTrigger value="list" className="gap-2 px-3">
                <LayoutList className="h-4 w-4" />
                <span className="hidden sm:inline">List</span>
              </TabsTrigger>
              <TabsTrigger value="loads" className="gap-2 px-3">
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Loads</span>
              </TabsTrigger>
              <TabsTrigger value="cards" className="gap-2 px-3">
                <Grid3X3 className="h-4 w-4" />
                <span className="hidden sm:inline">Cards</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Week Filter */}
          <Select value={weekFilter} onValueChange={setWeekFilter}>
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue placeholder="Week" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Weeks</SelectItem>
              {availableWeeks.map(week => (
                <SelectItem key={week} value={week.toString()}>Week {week}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search */}
          <Input
            placeholder="Search orders..."
            value={columnFilters.search}
            onChange={(e) => setColumnFilters(prev => ({ ...prev, search: e.target.value }))}
            className="w-[180px] h-9"
          />

          {/* Filter Toggle */}
          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2 h-9"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {hasActiveFilters && (
              <Badge variant="default" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                !
              </Badge>
            )}
          </Button>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground h-9">
              <X className="h-3 w-3" />
              Clear
            </Button>
          )}

          <span className="text-sm text-muted-foreground">
            {filteredOrders.length} orders
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setNewLoadDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Load
          </Button>
          <Button
            onClick={handleDispatchSelected}
            disabled={selectedIds.size === 0}
            className="gap-2"
          >
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Dispatch</span>
            ({selectedIds.size})
          </Button>
        </div>
      </div>

      {/* Filter Row */}
      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-3 bg-muted/50 rounded-lg border">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Date</label>
            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="tomorrow">Tomorrow</SelectItem>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="next_week">Next Week</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
            <label className="text-xs text-muted-foreground mb-1 block">Picker</label>
            <Select
              value={columnFilters.picker || 'all'}
              onValueChange={(v) => setColumnFilters(prev => ({ ...prev, picker: v === 'all' ? '' : v }))}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pickers</SelectItem>
                {growers.map(g => (
                  <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      {/* Main Content */}
      {viewMode === 'list' && (
        <ListView
          orders={filteredOrders}
          loads={filteredLoads}
          growers={growers}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          toggleSelectAll={toggleSelectAll}
          allSelected={allSelected}
          onDateChange={handleDateChange}
          onPickerChange={handlePickerChange}
          onLoadChange={handleLoadChange}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onViewOrder={setSelectedOrder}
          getStatusColor={getStatusColor}
          getStageLabel={getStageLabel}
        />
      )}

      {viewMode === 'loads' && (
        <LoadsView
          ordersByLoad={ordersByLoad}
          loads={filteredLoads}
          hauliers={hauliers}
          growers={growers}
          countySummary={countySummary}
          loadGaps={loadGaps}
          selectedIds={selectedIds}
          collapsedLoads={collapsedLoads}
          draggedOrderId={draggedOrderId}
          dragOverBin={dragOverBin}
          leftPanelWidth={leftPanelWidth}
          toggleSelect={toggleSelect}
          toggleSelectAll={toggleSelectAll}
          allSelected={allSelected}
          toggleLoadCollapse={toggleLoadCollapse}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          onEditLoad={setEditingLoad}
          onDeleteLoad={setDeletingLoadId}
          onDispatchLoad={handleDispatchLoad}
          onRecallLoad={handleRecallLoad}
          onViewOrder={setSelectedOrder}
          onFilterByCounty={(county) => setColumnFilters(prev => ({ ...prev, county }))}
          startResize={startResize}
          getStatusColor={getStatusColor}
          getStageLabel={getStageLabel}
          getFillColor={getFillColor}
        />
      )}

      {viewMode === 'cards' && (
        <CardsView
          orders={filteredOrders}
          loads={filteredLoads}
          growers={growers}
          selectedIds={selectedIds}
          draggedOrderId={draggedOrderId}
          dragOverBin={dragOverBin}
          toggleSelect={toggleSelect}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          onPickerChange={handlePickerChange}
          onLoadChange={handleLoadChange}
          onViewOrder={setSelectedOrder}
          getStatusColor={getStatusColor}
          getStageLabel={getStageLabel}
        />
      )}

      {/* New Load Dialog */}
      <Dialog open={newLoadDialogOpen} onOpenChange={setNewLoadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Load</DialogTitle>
            <DialogDescription>
              Create a new delivery load for dispatching orders.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Load Name (optional)</Label>
              <Input
                placeholder="e.g., Cork Load 1"
                value={newLoadName}
                onChange={(e) => setNewLoadName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Haulier {hauliers.length === 0 && <span className="text-destructive text-xs">(No hauliers found)</span>}</Label>
              <Select 
                value={newLoadHaulier} 
                onValueChange={(v) => {
                  setNewLoadHaulier(v);
                  setNewLoadVehicle(''); // Reset vehicle when haulier changes
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select haulier..." />
                </SelectTrigger>
                <SelectContent>
                  {hauliers.length === 0 ? (
                    <SelectItem value="_empty" disabled>No hauliers available</SelectItem>
                  ) : (
                    hauliers.map(h => (
                      <SelectItem key={h.id} value={h.id!}>
                        {h.name}
                        {h.vehicles && h.vehicles.length > 0 && ` (${h.vehicles.length} vehicles)`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {selectedHaulierVehicles.length > 0 && (
              <div className="space-y-2">
                <Label>Vehicle</Label>
                <Select value={newLoadVehicle} onValueChange={setNewLoadVehicle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle..." />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedHaulierVehicles.map(v => (
                      <SelectItem key={v.id} value={v.id!}>
                        {v.name} ({v.trolleyCapacity} trolleys)
                        {v.registration && ` - ${v.registration}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newLoadDate ? format(newLoadDate, 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={newLoadDate}
                    onSelect={setNewLoadDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewLoadDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateNewLoad}>
              Create Load
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Load Dialog */}
      <Dialog open={!!editingLoad} onOpenChange={(open) => !open && setEditingLoad(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Load</DialogTitle>
          </DialogHeader>
          {editingLoad && (
            <EditLoadForm
              load={editingLoad}
              hauliers={hauliers}
              onUpdate={setEditingLoad}
              onSave={handleUpdateLoad}
              onCancel={() => setEditingLoad(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingLoadId} onOpenChange={(open) => !open && setDeletingLoadId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Load?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the load. Orders must be removed first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLoad} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Order Summary Dialog */}
      <OrderSummaryDialog
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
}

// ========================================
// LIST VIEW
// ========================================
function ListView({
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
}: {
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
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[40px]">
                <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
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
                <TableCell colSpan={12} className="h-32 text-center text-muted-foreground">
                  No orders found
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => {
                const orderDate = order.requestedDeliveryDate ? parseISO(order.requestedDeliveryDate) : null;
                const week = orderDate ? getWeek(orderDate) : null;

                return (
                  <TableRow
                    key={order.id}
                    className={cn("group", selectedIds.has(order.id) && "bg-primary/5")}
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
                          <Button variant="ghost" size="sm" className="h-7 px-2 font-normal">
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
                      <span className="font-mono text-xs">{order.eircode || '—'}</span>
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
                          {loads.map(load => (
                            <SelectItem key={load.id} value={load.id}>
                              {load.loadName || load.runNumber}
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
                          {growers.map(g => (
                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn("text-xs", getStatusColor(order.stage))}>
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

// ========================================
// LOADS VIEW (Split Pane)
// ========================================
function LoadsView({
  ordersByLoad,
  loads,
  hauliers,
  growers,
  countySummary,
  loadGaps,
  selectedIds,
  collapsedLoads,
  draggedOrderId,
  dragOverBin,
  leftPanelWidth,
  toggleSelect,
  toggleSelectAll,
  allSelected,
  toggleLoadCollapse,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onEditLoad,
  onDeleteLoad,
  onDispatchLoad,
  onRecallLoad,
  onViewOrder,
  onFilterByCounty,
  startResize,
  getStatusColor,
  getStageLabel,
  getFillColor,
}: {
  ordersByLoad: Record<string, DispatchBoardOrder[]>;
  loads: ActiveDeliveryRunSummary[];
  hauliers: Haulier[];
  growers: GrowerMember[];
  countySummary: [string, { count: number; trolleys: number }][];
  loadGaps: { load: ActiveDeliveryRunSummary; needed: number; targetCounties: string[] }[];
  selectedIds: Set<string>;
  collapsedLoads: Set<string>;
  draggedOrderId: string | null;
  dragOverBin: string | null;
  leftPanelWidth: number;
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  allSelected: boolean;
  toggleLoadCollapse: (id: string) => void;
  onDragStart: (e: React.DragEvent, orderId: string) => void;
  onDragOver: (e: React.DragEvent, loadId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, loadId: string) => void;
  onDragEnd: () => void;
  onEditLoad: (load: ActiveDeliveryRunSummary) => void;
  onDeleteLoad: (id: string) => void;
  onDispatchLoad: (loadId: string, loadName: string, orderCount: number) => void;
  onRecallLoad: (loadId: string, loadName: string) => void;
  onViewOrder: (order: DispatchBoardOrder) => void;
  onFilterByCounty: (county: string) => void;
  startResize: () => void;
  getStatusColor: (stage: string) => string;
  getStageLabel: (stage: string) => string;
  getFillColor: (percentage: number) => string;
}) {
  const unassignedOrders = ordersByLoad[UNASSIGNED_BIN] || [];

  return (
    <div className="flex h-[calc(100vh-280px)] min-h-[500px] border rounded-lg overflow-hidden">
      {/* Left Panel - Unassigned Orders */}
      <div 
        className="flex flex-col bg-muted/30 border-r"
        style={{ width: leftPanelWidth, minWidth: leftPanelWidth }}
      >
        <div className="p-3 border-b bg-background">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Unassigned</h3>
            <Badge variant="secondary">{unassignedOrders.length}</Badge>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Checkbox 
              checked={allSelected} 
              onCheckedChange={toggleSelectAll}
              className="h-3 w-3"
            />
            <span className="text-muted-foreground">Select all</span>
          </div>
        </div>

        {/* County Summary */}
        {countySummary.length > 0 && (
          <div className="p-3 border-b bg-background/50">
            <p className="text-xs font-medium mb-2 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              By County
            </p>
            <div className="flex flex-wrap gap-1">
              {countySummary.map(([county, data]) => (
                <button
                  key={county}
                  onClick={() => onFilterByCounty(county)}
                  className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80 transition-colors"
                >
                  {county}: {data.trolleys}t
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Load Gaps - Sales Intelligence */}
        {loadGaps.length > 0 && (
          <div className="p-3 border-b bg-amber-50 dark:bg-amber-950/20">
            <p className="text-xs font-medium mb-2 flex items-center gap-1 text-amber-700 dark:text-amber-400">
              <TrendingUp className="h-3 w-3" />
              Loads Need Orders
            </p>
            <div className="space-y-1">
              {loadGaps.slice(0, 3).map(gap => (
                <div key={gap.load.id} className="text-xs text-amber-700 dark:text-amber-400">
                  <span className="font-medium">{gap.load.loadName || gap.load.runNumber}</span>
                  {' needs '}<span className="font-semibold">{gap.needed}</span>{' more trolleys'}
                  {gap.targetCounties.length > 0 && (
                    <span className="text-muted-foreground"> ({gap.targetCounties.join(', ')})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unassigned Orders List */}
        <ScrollArea 
          className="flex-1"
          onDragOver={(e) => onDragOver(e, UNASSIGNED_BIN)}
          onDragLeave={onDragLeave}
          onDrop={(e) => onDrop(e, UNASSIGNED_BIN)}
        >
          <div 
            className={cn(
              "p-2 space-y-2 min-h-full",
              dragOverBin === UNASSIGNED_BIN && "bg-primary/5"
            )}
          >
            {unassignedOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                selected={selectedIds.has(order.id)}
                isDragging={draggedOrderId === order.id}
                onSelect={() => toggleSelect(order.id)}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onClick={() => onViewOrder(order)}
                getStatusColor={getStatusColor}
                getStageLabel={getStageLabel}
                compact
              />
            ))}
            {unassignedOrders.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No unassigned orders
              </p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Resize Handle */}
      <div
        className="w-1 bg-border hover:bg-primary/50 cursor-col-resize transition-colors"
        onMouseDown={startResize}
      />

      {/* Right Panel - Load Bins */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="flex gap-4 p-4 min-w-max">
            {loads.map(load => {
              const loadOrders = ordersByLoad[load.id] || [];
              const isCollapsed = collapsedLoads.has(load.id);
              const haulier = hauliers.find(h => h.id === load.haulierId);

              return (
                <div
                  key={load.id}
                  className={cn(
                    "w-[300px] flex-shrink-0 rounded-lg border-2 transition-all",
                    isCollapsed ? "h-fit" : "min-h-[400px]",
                    dragOverBin === load.id ? "border-primary bg-primary/5" : "border-border"
                  )}
                  onDragOver={(e) => onDragOver(e, load.id)}
                  onDragLeave={onDragLeave}
                  onDrop={(e) => onDrop(e, load.id)}
                >
                  {/* Load Header */}
                  <div className="p-3 border-b bg-muted/30">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => toggleLoadCollapse(load.id)}
                        className="flex items-center gap-1 hover:text-primary"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                        <div className="text-left">
                          <p className="font-semibold text-sm">
                            {load.loadName || load.runNumber}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {load.runDate && format(parseISO(load.runDate), 'EEE, MMM d')}
                            {load.weekNumber && ` • W${load.weekNumber}`}
                          </p>
                        </div>
                      </button>
                      <div className="flex items-center gap-1">
                        {load.status === 'in_transit' && (
                          <Badge variant="default" className="text-xs bg-green-600">
                            <Truck className="h-3 w-3 mr-1" />
                            Dispatched
                          </Badge>
                        )}
                        {load.status === 'completed' && (
                          <Badge variant="default" className="text-xs bg-blue-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Completed
                          </Badge>
                        )}
                        {load.status !== 'in_transit' && load.status !== 'completed' && (
                          <Badge variant="secondary" className="text-xs">
                            {loadOrders.length}
                          </Badge>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {load.status !== 'in_transit' && load.status !== 'completed' && (
                              <DropdownMenuItem 
                                onClick={() => onDispatchLoad(load.id, load.loadName || load.runNumber, loadOrders.length)}
                                className="text-green-600"
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Dispatch Load
                              </DropdownMenuItem>
                            )}
                            {(load.status === 'in_transit' || load.status === 'loading') && (
                              <DropdownMenuItem 
                                onClick={() => onRecallLoad(load.id, load.loadName || load.runNumber)}
                                className="text-amber-600"
                              >
                                <Undo2 className="h-4 w-4 mr-2" />
                                Recall Load
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onEditLoad(load)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit Load
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => onDeleteLoad(load.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Load
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Haulier/Vehicle & Fill Status */}
                    <div className="mt-2 space-y-2">
                      {(haulier || load.vehicleName) && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Truck className="h-3 w-3" />
                            {load.vehicleName || haulier?.name}
                            {load.vehicleName && haulier && ` (${haulier.name})`}
                          </span>
                          <span className={cn("font-medium", getFillColor(load.fillPercentage))}>
                            {load.totalTrolleysAssigned}/{load.vehicleCapacity} trolleys
                          </span>
                        </div>
                      )}
                      <Progress 
                        value={Math.min(load.fillPercentage, 100)} 
                        className="h-2"
                      />
                      <div className="flex items-center justify-between">
                        <p className={cn("text-xs", getFillColor(load.fillPercentage))}>
                          {load.fillPercentage}% full
                        </p>
                        {load.status !== 'in_transit' && load.status !== 'completed' && loadOrders.length > 0 && (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs bg-green-600 hover:bg-green-700"
                            onClick={() => onDispatchLoad(load.id, load.loadName || load.runNumber, loadOrders.length)}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Dispatch
                          </Button>
                        )}
                        {load.status === 'in_transit' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-amber-600 border-amber-600 hover:bg-amber-50"
                            onClick={() => onRecallLoad(load.id, load.loadName || load.runNumber)}
                          >
                            <Undo2 className="h-3 w-3 mr-1" />
                            Recall
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Load Orders */}
                  {!isCollapsed && (
                    <ScrollArea className="h-[calc(100%-140px)]">
                      <div className="p-2 space-y-2">
                        {loadOrders.map(order => (
                          <OrderCard
                            key={order.id}
                            order={order}
                            selected={selectedIds.has(order.id)}
                            isDragging={draggedOrderId === order.id}
                            onSelect={() => toggleSelect(order.id)}
                            onDragStart={onDragStart}
                            onDragEnd={onDragEnd}
                            onClick={() => onViewOrder(order)}
                            getStatusColor={getStatusColor}
                            getStageLabel={getStageLabel}
                            compact
                          />
                        ))}
                        {loadOrders.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            Drop orders here
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              );
            })}

            {loads.length === 0 && (
              <div className="flex items-center justify-center w-full min-h-[400px] text-muted-foreground">
                <div className="text-center">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No loads for this week</p>
                  <p className="text-sm">Create a new load to get started</p>
                </div>
              </div>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  );
}

// ========================================
// CARDS VIEW
// ========================================
function CardsView({
  orders,
  loads,
  growers,
  selectedIds,
  draggedOrderId,
  dragOverBin,
  toggleSelect,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onPickerChange,
  onLoadChange,
  onViewOrder,
  getStatusColor,
  getStageLabel,
}: {
  orders: DispatchBoardOrder[];
  loads: ActiveDeliveryRunSummary[];
  growers: GrowerMember[];
  selectedIds: Set<string>;
  draggedOrderId: string | null;
  dragOverBin: string | null;
  toggleSelect: (id: string) => void;
  onDragStart: (e: React.DragEvent, orderId: string) => void;
  onDragOver: (e: React.DragEvent, loadId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, loadId: string) => void;
  onDragEnd: () => void;
  onPickerChange: (orderId: string, pickerId: string) => void;
  onLoadChange: (orderId: string, loadId: string) => void;
  onViewOrder: (order: DispatchBoardOrder) => void;
  getStatusColor: (stage: string) => string;
  getStageLabel: (stage: string) => string;
}) {
  // Group orders by status
  const unassigned = orders.filter(o => !o.deliveryRunId);
  const assigned = orders.filter(o => o.deliveryRunId);

  return (
    <div className="space-y-6">
      {/* Unassigned Orders Grid */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          Unassigned Orders
          <Badge variant="secondary">{unassigned.length}</Badge>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {unassigned.map(order => (
            <OrderCardFull
              key={order.id}
              order={order}
              loads={loads}
              growers={growers}
              selected={selectedIds.has(order.id)}
              isDragging={draggedOrderId === order.id}
              onSelect={() => toggleSelect(order.id)}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onClick={() => onViewOrder(order)}
              onPickerChange={onPickerChange}
              onLoadChange={onLoadChange}
              getStatusColor={getStatusColor}
              getStageLabel={getStageLabel}
            />
          ))}
        </div>
        {unassigned.length === 0 && (
          <p className="text-muted-foreground text-center py-8">All orders are assigned to loads</p>
        )}
      </div>

      {/* Load Drop Zones */}
      {loads.length > 0 && unassigned.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">Drop into Load</h3>
          <div className="flex gap-2 flex-wrap">
            {loads.map(load => (
              <div
                key={load.id}
                className={cn(
                  "px-4 py-3 rounded-lg border-2 border-dashed transition-colors",
                  dragOverBin === load.id ? "border-primary bg-primary/10" : "border-muted"
                )}
                onDragOver={(e) => onDragOver(e, load.id)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, load.id)}
              >
                <p className="font-medium text-sm">{load.loadName || load.runNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {load.totalTrolleysAssigned}/{load.vehicleCapacity || 20} trolleys
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Assigned Orders Grid */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          Assigned to Loads
          <Badge variant="secondary">{assigned.length}</Badge>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {assigned.map(order => (
            <OrderCardFull
              key={order.id}
              order={order}
              loads={loads}
              growers={growers}
              selected={selectedIds.has(order.id)}
              isDragging={draggedOrderId === order.id}
              onSelect={() => toggleSelect(order.id)}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onClick={() => onViewOrder(order)}
              onPickerChange={onPickerChange}
              onLoadChange={onLoadChange}
              getStatusColor={getStatusColor}
              getStageLabel={getStageLabel}
            />
          ))}
        </div>
        {assigned.length === 0 && (
          <p className="text-muted-foreground text-center py-8">No orders assigned to loads yet</p>
        )}
      </div>
    </div>
  );
}

// ========================================
// ORDER CARDS
// ========================================
function OrderCard({
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
}: {
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
}) {
  const orderDate = order.requestedDeliveryDate ? parseISO(order.requestedDeliveryDate) : null;

  return (
    <Card
      className={cn(
        "cursor-grab active:cursor-grabbing transition-all",
        selected && "ring-2 ring-primary",
        isDragging && "opacity-50"
      )}
      draggable
      onDragStart={(e) => onDragStart(e, order.id)}
      onDragEnd={onDragEnd}
    >
      <CardContent className={cn("space-y-1", compact ? "p-2" : "p-3")}>
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
          <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", getStatusColor(order.stage))}>
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
          <span>{orderDate ? format(orderDate, 'EEE, MMM d') : 'No date'}</span>
          <span className="font-mono">{order.eircode || '—'}</span>
          <span>{order.trolleysEstimated || 0}t</span>
        </div>
      </CardContent>
    </Card>
  );
}

function OrderCardFull({
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
}: {
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
}) {
  const orderDate = order.requestedDeliveryDate ? parseISO(order.requestedDeliveryDate) : null;

  return (
    <Card
      className={cn(
        "cursor-grab active:cursor-grabbing transition-all",
        selected && "ring-2 ring-primary",
        isDragging && "opacity-50"
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
          <Badge variant="secondary" className={cn("text-xs", getStatusColor(order.stage))}>
            {getStageLabel(order.stage)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <button className="text-left w-full" onClick={onClick}>
          <p className="font-semibold">{order.customerName}</p>
          <p className="text-sm text-muted-foreground">
            {order.orderNumber}
          </p>
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
              {loads.map(load => (
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
              {growers.map(g => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

// ========================================
// EDIT LOAD FORM
// ========================================
function EditLoadForm({
  load,
  hauliers,
  onUpdate,
  onSave,
  onCancel,
}: {
  load: ActiveDeliveryRunSummary;
  hauliers: HaulierWithVehicles[];
  onUpdate: (load: ActiveDeliveryRunSummary) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  // Get vehicles for selected haulier
  const selectedHaulierVehicles = useMemo(() => {
    if (!load.haulierId) return [];
    const haulier = hauliers.find(h => h.id === load.haulierId);
    return haulier?.vehicles || [];
  }, [load.haulierId, hauliers]);

  return (
    <>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label>Load Name</Label>
          <Input
            value={load.loadName || ''}
            onChange={(e) => onUpdate({ ...load, loadName: e.target.value })}
            placeholder="e.g., Cork Load 1"
          />
        </div>
        <div className="space-y-2">
          <Label>Haulier</Label>
          <Select 
            value={load.haulierId || ''} 
            onValueChange={(v) => onUpdate({ ...load, haulierId: v, vehicleId: undefined })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select haulier..." />
            </SelectTrigger>
            <SelectContent>
              {hauliers.map(h => (
                <SelectItem key={h.id} value={h.id!}>
                  {h.name}
                  {h.vehicles.length > 0 && ` (${h.vehicles.length} vehicles)`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedHaulierVehicles.length > 0 && (
          <div className="space-y-2">
            <Label>Vehicle</Label>
            <Select 
              value={load.vehicleId || ''} 
              onValueChange={(v) => onUpdate({ ...load, vehicleId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select vehicle..." />
              </SelectTrigger>
              <SelectContent>
                {selectedHaulierVehicles.map(v => (
                  <SelectItem key={v.id} value={v.id!}>
                    {v.name} ({v.trolleyCapacity} trolleys)
                    {v.registration && ` - ${v.registration}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label>Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {load.runDate ? format(parseISO(load.runDate), 'PPP') : 'Select date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={load.runDate ? parseISO(load.runDate) : undefined}
                onSelect={(date) => date && onUpdate({ 
                  ...load, 
                  runDate: format(date, 'yyyy-MM-dd') 
                })}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSave}>
          Save Changes
        </Button>
      </DialogFooter>
    </>
  );
}
