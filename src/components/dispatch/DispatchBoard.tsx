'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { format, parseISO, getWeek } from 'date-fns';
import {
  Truck,
  Calendar as CalendarIcon,
  Plus,
  LayoutList,
  LayoutGrid,
  Grid3X3,
  Filter,
  X,
} from 'lucide-react';

import { DispatchBoardOrder, ActiveDeliveryRunSummary } from '@/lib/dispatch/types';
import type { HaulierWithVehicles } from '@/lib/types';
import type { AttributeOption } from '@/lib/attributeOptions';
import type { GrowerMember } from '@/server/dispatch/queries.server';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

import {
  assignOrderToPicker,
  assignOrderToRun,
  createEmptyRoute,
  createLoadWithOrders,
  updateLoad,
  deleteLoad,
  removeOrderFromLoad,
  updateOrderDate,
  dispatchOrders,
  dispatchLoad,
  recallLoad,
} from '@/server/dispatch/board-actions';
import { toast } from '@/lib/toast';

import OrderSummaryDialog from './OrderSummaryDialog';
import { ListView, LoadsView, CardsView, EditLoadForm } from './manager';
import { getStatusColor, getStageLabel, getFillColor } from './shared';

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
  const [newLoadCode, setNewLoadCode] = useState('');
  const [newLoadHaulier, setNewLoadHaulier] = useState<string>('');
  const [newLoadVehicle, setNewLoadVehicle] = useState<string>('');
  const [pendingDispatch, setPendingDispatch] = useState<{
    loadId: string;
    loadCode: string;
    orderCount: number;
    blockedCount: number;
  } | null>(null);
  const [dispatchOverrideReason, setDispatchOverrideReason] = useState('');

  // Split pane resize
  const [leftPanelWidth, setLeftPanelWidth] = useState(380);
  const isResizing = useRef(false);

  // Get unique weeks from orders and delivery runs
  const availableWeeks = useMemo(() => {
    const weeks = new Set<number>();
    orders.forEach((o) => {
      if (o.requestedDeliveryDate) {
        weeks.add(getWeek(parseISO(o.requestedDeliveryDate)));
      }
    });
    deliveryRuns.forEach((r) => {
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

      result = result.filter((order) => {
        if (!order.requestedDeliveryDate) return false;
        const date = parseISO(order.requestedDeliveryDate);
        date.setHours(0, 0, 0, 0);

        switch (dateFilter) {
          case 'today':
            return date.getTime() === today.getTime();
          case 'tomorrow':
            return date.getTime() === tomorrow.getTime();
          case 'this_week':
            return date >= today && date <= endOfWeek;
          case 'next_week':
            return date > endOfWeek && date <= endOfNextWeek;
          default:
            return true;
        }
      });
    }

    // Week filter
    if (weekFilter !== 'all') {
      const weekNum = parseInt(weekFilter);
      result = result.filter((order) => {
        if (!order.requestedDeliveryDate) return false;
        return getWeek(parseISO(order.requestedDeliveryDate)) === weekNum;
      });
    }

    // Search filter
    if (columnFilters.search) {
      const search = columnFilters.search.toLowerCase();
      result = result.filter(
        (o) =>
          o.orderNumber?.toLowerCase().includes(search) ||
          o.customerName?.toLowerCase().includes(search) ||
          o.eircode?.toLowerCase().includes(search)
      );
    }

    // Column filters
    if (columnFilters.county) {
      result = result.filter((o) =>
        o.county?.toLowerCase().includes(columnFilters.county.toLowerCase())
      );
    }
    if (columnFilters.picker) {
      result = result.filter((o) =>
        o.pickerName?.toLowerCase().includes(columnFilters.picker.toLowerCase())
      );
    }
    if (columnFilters.status && columnFilters.status !== 'all') {
      result = result.filter((o) => o.stage === columnFilters.status);
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
    return deliveryRuns.filter((r) => r.weekNumber === weekNum);
  }, [deliveryRuns, weekFilter]);

  // Group orders by load
  const ordersByLoad = useMemo(() => {
    const grouped: Record<string, DispatchBoardOrder[]> = {
      [UNASSIGNED_BIN]: [],
    };

    filteredLoads.forEach((load) => {
      grouped[load.id] = [];
    });

    filteredOrders.forEach((order) => {
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
    (ordersByLoad[UNASSIGNED_BIN] || []).forEach((order) => {
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
      .filter((load) => load.fillPercentage < 80 && load.vehicleCapacity)
      .map((load) => {
        const currentTrolleys = load.totalTrolleysAssigned;
        const capacity = load.vehicleCapacity || 20;
        const needed = capacity - currentTrolleys;

        const loadOrders = ordersByLoad[load.id] || [];
        const counties = [...new Set(loadOrders.map((o) => o.county).filter(Boolean))];

        return {
          load,
          needed,
          targetCounties: counties as string[],
        };
      })
      .filter((g) => g.needed > 0);
  }, [filteredLoads, ordersByLoad]);

  // Selection handlers
  const allSelected =
    filteredOrders.length > 0 &&
    filteredOrders.filter((o) => !o.deliveryRunId).every((o) => selectedIds.has(o.id));

  const toggleSelectAll = () => {
    const unassigned = filteredOrders.filter((o) => !o.deliveryRunId);
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unassigned.map((o) => o.id)));
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

  const hasActiveFilters =
    Object.values(columnFilters).some((v) => v !== '') ||
    weekFilter !== 'all' ||
    dateFilter !== 'all';

  // Action handlers
  const handleDateChange = async (orderId: string, date: Date | undefined) => {
    if (!date) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    toast.promise(updateOrderDate(orderId, dateStr), {
      loading: 'Updating date...',
      success: 'Date updated',
      error: 'Failed to update date',
    });
  };

  const handlePickerChange = async (orderId: string, pickerId: string) => {
    const value = pickerId === 'none' ? null : pickerId;
    toast.promise(assignOrderToPicker(orderId, value), {
      loading: 'Assigning picker...',
      success: 'Picker assigned',
      error: 'Failed to assign picker',
    });
  };

  const handleLoadChange = async (orderId: string, loadId: string) => {
    if (loadId === 'none') {
      toast.promise(removeOrderFromLoad(orderId), {
        loading: 'Removing from load...',
        success: 'Removed from load',
        error: 'Failed to remove',
      });
    } else {
      toast.promise(assignOrderToRun(orderId, loadId), {
        loading: 'Assigning to load...',
        success: 'Added to load',
        error: 'Failed to assign',
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
        newLoadCode || undefined
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
        error: 'Failed to create load',
      }
    );
  };

  const handleCreateLoadFromSelected = async () => {
    if (!newLoadDate) return;
    const selectedOrderIds = Array.from(selectedIds);

    if (selectedOrderIds.length === 0) {
      toast.error('Select orders to create a load');
      return;
    }

    const dateStr = format(newLoadDate, 'yyyy-MM-dd');

    toast.promise(
      createLoadWithOrders(
        dateStr,
        selectedOrderIds,
        newLoadHaulier || undefined,
        newLoadVehicle || undefined,
        newLoadCode || undefined
      ),
      {
        loading: 'Creating load...',
        success: () => {
          setNewLoadDialogOpen(false);
          setNewLoadName('');
          setNewLoadHaulier('');
          setNewLoadVehicle('');
          setSelectedIds(new Set());
          return `Load created with ${selectedOrderIds.length} orders`;
        },
        error: 'Failed to create load',
      }
    );
  };

  // Get vehicles for selected haulier
  const selectedHaulierVehicles = useMemo(() => {
    if (!newLoadHaulier) return [];
    const haulier = hauliers.find((h) => h.id === newLoadHaulier);
    return haulier?.vehicles || [];
  }, [newLoadHaulier, hauliers]);

  const handleUpdateLoad = async () => {
    if (!editingLoad) return;

    toast.promise(
      updateLoad(editingLoad.id, {
        loadCode: editingLoad.loadCode,
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
        error: 'Failed to update load',
      }
    );
  };

  const handleDeleteLoad = async () => {
    const loadToDelete = deletingLoadId;
    if (!loadToDelete) return;

    setDeletingLoadId(null);

    try {
      toast.loading('Deleting load...', { id: 'delete-load' });
      const result = await deleteLoad(loadToDelete);

      if (result.error) {
        toast.error(result.error, { id: 'delete-load' });
        return;
      }

      toast.success('Load deleted', { id: 'delete-load' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete load', { id: 'delete-load' });
    }
  };

  const handleDispatchLoad = async (
    loadId: string,
    loadCode: string,
    orderCount: number,
    blockedCount: number
  ) => {
    if (orderCount === 0) {
      toast.error('No orders in this load to dispatch');
      return;
    }

    if (blockedCount > 0) {
      setPendingDispatch({ loadId, loadCode, orderCount, blockedCount });
      setDispatchOverrideReason('');
      return;
    }

    toast.promise(dispatchLoad(loadId), {
      loading: `Dispatching ${loadCode}...`,
      success: (result) => {
        if (result.error) throw new Error(result.error);
        return `${loadCode} dispatched with ${result.ordersDispatched} orders`;
      },
      error: (err) => err.message || 'Failed to dispatch load',
    });
  };

  const handleConfirmDispatch = async () => {
    if (!pendingDispatch) return;
    const reason = dispatchOverrideReason.trim();

    if (!reason) {
      toast.error('Override reason is required');
      return;
    }

    const { loadId, loadCode } = pendingDispatch;

    toast.promise(dispatchLoad(loadId), {
      loading: `Dispatching ${loadCode}...`,
      success: (result) => {
        if (result.error) throw new Error(result.error);
        return `${loadCode} dispatched with ${result.ordersDispatched} orders. Override: ${reason}`;
      },
      error: (err) => err.message || 'Failed to dispatch load',
    });

    setPendingDispatch(null);
    setDispatchOverrideReason('');
  };

  const handleRecallLoad = async (loadId: string, loadCode: string) => {
    toast.promise(recallLoad(loadId), {
      loading: `Recalling ${loadCode}...`,
      success: (result) => {
        if (result.error) throw new Error(result.error);
        return `${loadCode} recalled - ${result.ordersRecalled} orders reverted`;
      },
      error: (err) => err.message || 'Failed to recall load',
    });
  };

  const handleDispatchSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.error('No orders selected');
      return;
    }

    const haulierId = hauliers[0]?.id;

    toast.promise(dispatchOrders(ids, undefined, haulierId), {
      loading: `Dispatching ${ids.length} orders...`,
      success: (result) => {
        setSelectedIds(new Set());
        if (result.warning) return result.warning;
        return `${ids.length} orders dispatched`;
      },
      error: (err) => err.error || 'Failed to dispatch orders',
    });
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
        error: 'Failed to remove',
      });
    } else {
      toast.promise(assignOrderToRun(orderId, loadId), {
        loading: 'Moving to load...',
        success: 'Order moved',
        error: 'Failed to move order',
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
              {availableWeeks.map((week) => (
                <SelectItem key={week} value={week.toString()}>
                  Week {week}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search */}
          <Input
            placeholder="Search orders..."
            value={columnFilters.search}
            onChange={(e) => setColumnFilters((prev) => ({ ...prev, search: e.target.value }))}
            className="w-[180px] h-9"
          />

          {/* Filter Toggle */}
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2 h-9"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {hasActiveFilters && (
              <Badge
                variant="default"
                className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
              >
                !
              </Badge>
            )}
          </Button>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-1 text-muted-foreground h-9"
            >
              <X className="h-3 w-3" />
              Clear
            </Button>
          )}

          <span className="text-sm text-muted-foreground">{filteredOrders.length} orders</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNewLoadDialogOpen(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New Load
          </Button>
          <Button onClick={handleDispatchSelected} disabled={selectedIds.size === 0} className="gap-2">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Dispatch</span>({selectedIds.size})
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
              onChange={(e) => setColumnFilters((prev) => ({ ...prev, county: e.target.value }))}
              className="h-8"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Picker</label>
            <Select
              value={columnFilters.picker || 'all'}
              onValueChange={(v) =>
                setColumnFilters((prev) => ({ ...prev, picker: v === 'all' ? '' : v }))
              }
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pickers</SelectItem>
                {growers.map((g) => (
                  <SelectItem key={g.id} value={g.name}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Status</label>
            <Select
              value={columnFilters.status || 'all'}
              onValueChange={(v) =>
                setColumnFilters((prev) => ({ ...prev, status: v === 'all' ? '' : v }))
              }
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
          onFilterByCounty={(county) => setColumnFilters((prev) => ({ ...prev, county }))}
          onFilterByStatus={(status) => setColumnFilters((prev) => ({ ...prev, status }))}
          activeStatusFilter={columnFilters.status}
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

      {/* New Load Sheet */}
      <Sheet open={newLoadDialogOpen} onOpenChange={setNewLoadDialogOpen}>
        <SheetContent side="right" className="sm:max-w-lg flex flex-col h-full">
          <SheetHeader>
            <SheetTitle>Create Load</SheetTitle>
            <SheetDescription>
              Build a flexible load and assign orders now or later.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto space-y-5 py-4">
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">Selected orders</span>
                <Badge variant="secondary">{selectedIds.size}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Create a load from selected orders or start empty and drag orders in.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Load Code</Label>
              <Input
                placeholder="e.g., 4L (Thursday Liam)"
                value={newLoadCode}
                onChange={(e) => setNewLoadCode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Haulier{' '}
                {hauliers.length === 0 && (
                  <span className="text-destructive text-xs">(No hauliers found)</span>
                )}
              </Label>
              <Select
                value={newLoadHaulier}
                onValueChange={(v) => {
                  setNewLoadHaulier(v);
                  setNewLoadVehicle('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select haulier..." />
                </SelectTrigger>
                <SelectContent>
                  {hauliers.length === 0 ? (
                    <SelectItem value="_empty" disabled>
                      No hauliers available
                    </SelectItem>
                  ) : (
                    hauliers.map((h) => (
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
                    {selectedHaulierVehicles.map((v) => (
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
          <SheetFooter className="gap-2 pt-4 border-t mt-auto">
            <Button variant="outline" onClick={handleCreateNewLoad}>
              Create Empty Load
            </Button>
            <Button onClick={handleCreateLoadFromSelected}>
              Create With {selectedIds.size} Orders
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

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

      {/* Dispatch Override Dialog */}
      <Dialog
        open={!!pendingDispatch}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDispatch(null);
            setDispatchOverrideReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispatch with unresolved picking?</DialogTitle>
            <DialogDescription>
              {pendingDispatch?.loadCode} has {pendingDispatch?.blockedCount} orders not ready to load.
              Provide an override reason to dispatch anyway.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Override reason</Label>
            <Textarea
              placeholder="Explain why this load is dispatching early..."
              value={dispatchOverrideReason}
              onChange={(e) => setDispatchOverrideReason(e.target.value)}
              className="min-h-[90px]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPendingDispatch(null);
                setDispatchOverrideReason('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmDispatch} disabled={!dispatchOverrideReason.trim()}>
              Dispatch Anyway
            </Button>
          </DialogFooter>
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
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteLoad();
              }}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Order Summary Dialog */}
      <OrderSummaryDialog order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </div>
  );
}
