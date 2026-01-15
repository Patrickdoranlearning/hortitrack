'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, getISOWeek } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Package,
  Calendar,
  User,
  Truck,
  Search,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Printer,
  GripVertical,
  Columns3,
  X,
  MapPin,
  Plus,
  Users,
  Tag,
  SlidersHorizontal,
  ChevronRight,
  Send,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import OrderStatusBadge from '@/components/sales/OrderStatusBadge';
import { toast } from 'sonner';
import TrolleyLabelPrintDialog from '@/components/dispatch/TrolleyLabelPrintDialog';
import { useTodayDate, getTodayISO } from '@/lib/date-sync';
import { dispatchLoad } from '@/server/dispatch/board-actions';

// Types
// pick_lists can be a single object (due to UNIQUE constraint) or an array
type PickListData = {
  id: string;
  status: string;
  assigned_user_id: string | null;
};

export interface DispatchOrder {
  id: string;
  order_number: string;
  status: string;
  requested_delivery_date: string | null;
  trolleys_estimated: number | null;
  notes: string | null;
  created_at: string;
  customer: {
    id: string;
    name: string;
  } | null;
  ship_to_address: {
    id: string;
    county: string | null;
    eircode: string | null;
    city: string | null;
  } | null;
  delivery_items: Array<{
    id: string;
    delivery_run_id: string | null;
  }>;
  // Can be single object (UNIQUE constraint), array, or null
  pick_lists: PickListData | PickListData[] | null;
}

// Helper to get pick list from order (handles both object and array)
function getPickList(order: DispatchOrder): PickListData | null {
  if (!order.pick_lists) return null;
  if (Array.isArray(order.pick_lists)) {
    return order.pick_lists[0] || null;
  }
  return order.pick_lists;
}

interface AvailablePicker {
  id: string;
  name: string;
}

interface AvailableLoad {
  id: string;
  name: string;
  date: string | null;
  status: string;
  haulierId: string | null;
  vehicleId: string | null;
  haulierName: string | null;
  vehicleName: string | null;
  vehicleCapacity: number;
  totalOrders: number;
  totalTrolleys: number;
  readyOrders: number;
  pickingOrders: number;
}

interface HaulierVehicle {
  id: string;
  name: string;
  trolleyCapacity: number;
  registration?: string;
}

interface HaulierWithVehicles {
  id: string;
  name: string;
  isInternal?: boolean;
  trolleyCapacity?: number;
  vehicles: HaulierVehicle[];
}

interface DispatchOrdersClientProps {
  initialOrders: DispatchOrder[];
  pickerMap: Record<string, string>;
  availablePickers: AvailablePicker[];
  availableLoads: AvailableLoad[];
  hauliers: HaulierWithVehicles[];
}

// Column configuration
interface ColumnConfig {
  id: string;
  label: string;
  minWidth: number;
  defaultWidth: number;
  sortable: boolean;
  visible: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'order_number', label: 'Order', minWidth: 80, defaultWidth: 100, sortable: true, visible: true },
  { id: 'customer', label: 'Customer', minWidth: 120, defaultWidth: 180, sortable: true, visible: true },
  { id: 'county', label: 'County', minWidth: 80, defaultWidth: 100, sortable: true, visible: true },
  { id: 'eircode', label: 'Eircode', minWidth: 70, defaultWidth: 90, sortable: true, visible: true },
  { id: 'status', label: 'Status', minWidth: 80, defaultWidth: 110, sortable: true, visible: true },
  { id: 'delivery_date', label: 'Delivery Date', minWidth: 100, defaultWidth: 130, sortable: true, visible: true },
  { id: 'week', label: 'Week', minWidth: 50, defaultWidth: 60, sortable: true, visible: true },
  { id: 'picker', label: 'Picker', minWidth: 100, defaultWidth: 140, sortable: true, visible: true },
  { id: 'load', label: 'Load', minWidth: 100, defaultWidth: 140, sortable: true, visible: true },
  { id: 'trolleys', label: 'Trolleys', minWidth: 60, defaultWidth: 80, sortable: true, visible: true },
  { id: 'actions', label: '', minWidth: 110, defaultWidth: 110, sortable: false, visible: true },
];

// Status filter options
const STATUS_OPTIONS = [
  { value: 'all', label: 'All Active' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'picking', label: 'Picking' },
  { value: 'packed', label: 'Ready' },
];

// Load colors for row highlighting
const LOAD_COLORS = [
  'bg-blue-50 hover:bg-blue-100 border-l-4 border-l-blue-500',
  'bg-green-50 hover:bg-green-100 border-l-4 border-l-green-500',
  'bg-yellow-50 hover:bg-yellow-100 border-l-4 border-l-yellow-500',
  'bg-purple-50 hover:bg-purple-100 border-l-4 border-l-purple-500',
  'bg-pink-50 hover:bg-pink-100 border-l-4 border-l-pink-500',
  'bg-orange-50 hover:bg-orange-100 border-l-4 border-l-orange-500',
  'bg-teal-50 hover:bg-teal-100 border-l-4 border-l-teal-500',
  'bg-indigo-50 hover:bg-indigo-100 border-l-4 border-l-indigo-500',
  'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500',
  'bg-cyan-50 hover:bg-cyan-100 border-l-4 border-l-cyan-500',
];

type SortDirection = 'asc' | 'desc' | null;

export default function DispatchOrdersClient({
  initialOrders,
  pickerMap,
  availablePickers,
  availableLoads,
  hauliers,
}: DispatchOrdersClientProps) {
  const router = useRouter();

  // State
  const [orders, setOrders] = useState<DispatchOrder[]>(initialOrders);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [weekFilter, setWeekFilter] = useState('');
  const [loadFilter, setLoadFilter] = useState('all');
  const [sortColumn, setSortColumn] = useState<string | null>('delivery_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const widths: Record<string, number> = {};
    DEFAULT_COLUMNS.forEach(col => {
      widths[col.id] = col.defaultWidth;
    });
    return widths;
  });
  const [updatingPicker, setUpdatingPicker] = useState<string | null>(null);
  const [updatingLoad, setUpdatingLoad] = useState<string | null>(null);
  const [showCreateLoadDialog, setShowCreateLoadDialog] = useState(false);
  const [createLoadForOrderId, setCreateLoadForOrderId] = useState<string | null>(null);
  const [newLoadCode, setNewLoadCode] = useState('');
  // Use hydration-safe date - initialize empty, set after hydration
  const [newLoadDate, setNewLoadDate] = useState('');
  const today = useTodayDate();
  const [creatingLoad, setCreatingLoad] = useState(false);
  const [loads, setLoads] = useState<AvailableLoad[]>(availableLoads);

  // Trolley label dialog state
  const [showLabelDialog, setShowLabelDialog] = useState(false);
  const [selectedOrderForLabel, setSelectedOrderForLabel] = useState<DispatchOrder | null>(null);

  // Mobile UI state
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Load haulier/vehicle update state
  const [updatingLoadHaulier, setUpdatingLoadHaulier] = useState<string | null>(null);

  // Set date after hydration to avoid mismatch
  useEffect(() => {
    if (today && !newLoadDate) {
      setNewLoadDate(today);
    }
  }, [today, newLoadDate]);

  // Create load color map
  const loadColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    const uniqueLoads = [...new Set(
      orders
        .map(o => o.delivery_items?.[0]?.delivery_run_id)
        .filter(Boolean) as string[]
    )];
    uniqueLoads.forEach((loadId, index) => {
      map[loadId] = LOAD_COLORS[index % LOAD_COLORS.length];
    });
    return map;
  }, [orders]);

  // Refs for column resizing
  const tableRef = useRef<HTMLTableElement>(null);
  const resizingColumn = useRef<string | null>(null);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(0);

  // Column resize handlers
  const handleResizeStart = useCallback((columnId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingColumn.current = columnId;
    startX.current = e.clientX;
    startWidth.current = columnWidths[columnId];
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  }, [columnWidths]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingColumn.current) return;
    const column = columns.find(c => c.id === resizingColumn.current);
    if (!column) return;

    const diff = e.clientX - startX.current;
    const newWidth = Math.max(column.minWidth, startWidth.current + diff);

    setColumnWidths(prev => ({
      ...prev,
      [resizingColumn.current!]: newWidth,
    }));
  }, [columns]);

  const handleResizeEnd = useCallback(() => {
    resizingColumn.current = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  }, [handleResizeMove]);

  // Toggle column visibility
  const toggleColumnVisibility = (columnId: string) => {
    setColumns(prev => prev.map(col =>
      col.id === columnId ? { ...col, visible: !col.visible } : col
    ));
  };

  // Sorting
  const handleSort = (columnId: string) => {
    const column = columns.find(c => c.id === columnId);
    if (!column?.sortable) return;

    if (sortColumn === columnId) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc');
      if (sortDirection === 'desc') setSortColumn(null);
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  // Assign picker to order
  const handleAssignPicker = async (orderId: string, pickerId: string) => {
    setUpdatingPicker(orderId);
    try {
      const response = await fetch('/api/dispatch/assign-picker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          pickerId: pickerId === 'unassign' ? null : pickerId
        }),
      });

      const data = await response.json();

      console.log('[Assign Picker] Response:', {
        ok: data.ok,
        pickListId: data.pickListId,
        pickerId: data.pickerId,
        created: data.created,
        requestedPickerId: pickerId === 'unassign' ? null : pickerId,
      });

      if (!response.ok || !data.ok) {
        console.error('[Assign Picker] Error:', data);
        throw new Error(data.error || 'Failed to assign picker');
      }

      // Update local state - store as object (matching Supabase's UNIQUE constraint behavior)
      setOrders(prev => prev.map(o => {
        if (o.id === orderId) {
          const existingPickList = getPickList(o);
          return {
            ...o,
            pick_lists: {
              id: data.pickListId || existingPickList?.id || 'new',
              status: existingPickList?.status || 'pending',
              assigned_user_id: pickerId === 'unassign' ? null : pickerId,
            },
          };
        }
        return o;
      }));

      toast.success(pickerId === 'unassign' ? 'Picker unassigned' : 'Picker assigned');
    } catch (error: any) {
      console.error('[Assign Picker] Error:', error);
      toast.error(error?.message || 'Failed to assign picker');
    } finally {
      setUpdatingPicker(null);
    }
  };

  // Assign load to order
  const handleAssignLoad = async (orderId: string, loadId: string) => {
    // Handle "create new" option
    if (loadId === 'create_new') {
      setCreateLoadForOrderId(orderId);
      setShowCreateLoadDialog(true);
      return;
    }

    setUpdatingLoad(orderId);
    try {
      const response = await fetch('/api/dispatch/assign-load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, loadId: loadId === 'unassign' ? null : loadId }),
      });

      if (!response.ok) {
        throw new Error('Failed to assign load');
      }

      const data = await response.json();

      // Update local state
      setOrders(prev => prev.map(o => {
        if (o.id === orderId) {
          return {
            ...o,
            delivery_items: loadId === 'unassign' ? [] : [{
              id: data.deliveryItemId || 'temp',
              delivery_run_id: loadId,
            }],
          };
        }
        return o;
      }));

      toast.success(loadId === 'unassign' ? 'Load unassigned' : 'Load assigned');
    } catch (error) {
      toast.error('Failed to assign load');
    } finally {
      setUpdatingLoad(null);
    }
  };

  // Update load haulier/vehicle
  const handleUpdateLoadHaulier = async (loadId: string, haulierId: string | null, vehicleId: string | null) => {
    setUpdatingLoadHaulier(loadId);
    try {
      const response = await fetch(`/api/dispatch/runs/${loadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          haulierId: haulierId || null,
          vehicleId: vehicleId || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update load');
      }

      // Find haulier and vehicle info for local state update
      const selectedHaulier = hauliers.find(h => h.id === haulierId);
      const selectedVehicle = selectedHaulier?.vehicles.find(v => v.id === vehicleId);

      // Update local state
      setLoads(prev => prev.map(load => {
        if (load.id === loadId) {
          return {
            ...load,
            haulierId,
            vehicleId,
            haulierName: selectedHaulier?.name || null,
            vehicleName: selectedVehicle?.name || null,
            vehicleCapacity: selectedVehicle?.trolleyCapacity || selectedHaulier?.trolleyCapacity || 0,
          };
        }
        return load;
      }));

      toast.success('Load updated');
    } catch (error) {
      toast.error('Failed to update load');
    } finally {
      setUpdatingLoadHaulier(null);
    }
  };

  // Create a new load
  const handleCreateLoad = async () => {
    if (!newLoadCode.trim()) {
      toast.error('Please enter a load code');
      return;
    }

    setCreatingLoad(true);
    try {
      const response = await fetch('/api/dispatch/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loadCode: newLoadCode.trim(),
          runDate: newLoadDate,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create load');
      }

      const data = await response.json();
      const newLoad: AvailableLoad = {
        id: data.id,
        name: newLoadCode.trim(),
        date: newLoadDate,
      };

      // Add new load to local state
      setLoads(prev => [...prev, newLoad]);

      toast.success('Load created');

      // If we were creating for a specific order, assign it
      if (createLoadForOrderId) {
        setShowCreateLoadDialog(false);
        await handleAssignLoad(createLoadForOrderId, data.id);
      } else {
        setShowCreateLoadDialog(false);
      }

      // Reset form
      setNewLoadCode('');
      setNewLoadDate(getTodayISO());
      setCreateLoadForOrderId(null);
    } catch (error) {
      toast.error('Failed to create load');
    } finally {
      setCreatingLoad(false);
    }
  };

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    let result = [...orders];

    // Search filter
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      result = result.filter(order => {
        const customerName = order.customer?.name?.toLowerCase() || '';
        const orderNumber = order.order_number?.toLowerCase() || '';
        const county = order.ship_to_address?.county?.toLowerCase() || '';
        const eircode = order.ship_to_address?.eircode?.toLowerCase() || '';
        return customerName.includes(term) || orderNumber.includes(term) || county.includes(term) || eircode.includes(term);
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(order => order.status === statusFilter);
    }

    // Week filter
    if (weekFilter.trim()) {
      result = result.filter(order => {
        if (!order.requested_delivery_date) return false;
        const week = getISOWeek(new Date(order.requested_delivery_date));
        return String(week) === weekFilter.trim();
      });
    }

    // Load filter
    if (loadFilter !== 'all') {
      result = result.filter(order => {
        const loadId = order.delivery_items?.[0]?.delivery_run_id;
        if (loadFilter === 'unassigned') return !loadId;
        return loadId === loadFilter;
      });
    }

    // Sorting
    if (sortColumn && sortDirection) {
      result.sort((a, b) => {
        let aVal: any;
        let bVal: any;

        switch (sortColumn) {
          case 'order_number':
            aVal = a.order_number;
            bVal = b.order_number;
            break;
          case 'customer':
            aVal = a.customer?.name || '';
            bVal = b.customer?.name || '';
            break;
          case 'county':
            aVal = a.ship_to_address?.county || '';
            bVal = b.ship_to_address?.county || '';
            break;
          case 'eircode':
            aVal = a.ship_to_address?.eircode || '';
            bVal = b.ship_to_address?.eircode || '';
            break;
          case 'status':
            aVal = a.status;
            bVal = b.status;
            break;
          case 'delivery_date':
            aVal = a.requested_delivery_date || '';
            bVal = b.requested_delivery_date || '';
            break;
          case 'week':
            aVal = a.requested_delivery_date ? getISOWeek(new Date(a.requested_delivery_date)) : 0;
            bVal = b.requested_delivery_date ? getISOWeek(new Date(b.requested_delivery_date)) : 0;
            break;
          case 'picker':
            const aPickList = getPickList(a);
            const bPickList = getPickList(b);
            aVal = aPickList?.assigned_user_id ? pickerMap[aPickList.assigned_user_id] || '' : '';
            bVal = bPickList?.assigned_user_id ? pickerMap[bPickList.assigned_user_id] || '' : '';
            break;
          case 'load':
            const aLoadId = a.delivery_items?.[0]?.delivery_run_id;
            const bLoadId = b.delivery_items?.[0]?.delivery_run_id;
            aVal = aLoadId ? loads.find(l => l.id === aLoadId)?.name || '' : '';
            bVal = bLoadId ? loads.find(l => l.id === bLoadId)?.name || '' : '';
            break;
          case 'trolleys':
            aVal = a.trolleys_estimated || 0;
            bVal = b.trolleys_estimated || 0;
            break;
          default:
            return 0;
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [orders, searchQuery, statusFilter, weekFilter, loadFilter, sortColumn, sortDirection, pickerMap, loads]);

  // Get visible columns
  const visibleColumns = columns.filter(c => c.visible);

  // Navigation
  const handleOpenOrder = (orderId: string) => {
    router.push(`/sales/orders/${orderId}`);
  };

  const handleOpenCustomer = (customerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/sales/customers/${customerId}`);
  };

  const handlePrintDocs = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`/sales/orders/${orderId}/dispatch-documents`, '_blank');
  };

  // Print trolley label - opens dialog with preview
  const handlePrintTrolleyLabel = (order: DispatchOrder, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!order.customer?.name || !order.order_number) {
      toast.error('Missing order information for label');
      return;
    }

    setSelectedOrderForLabel(order);
    setShowLabelDialog(true);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setWeekFilter('');
    setLoadFilter('all');
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || weekFilter || loadFilter !== 'all';

  // Get row color based on load assignment
  const getRowColor = (order: DispatchOrder) => {
    const loadId = order.delivery_items?.[0]?.delivery_run_id;
    if (!loadId) return 'hover:bg-muted/50';
    return loadColorMap[loadId] || 'hover:bg-muted/50';
  };

  // Render cell content
  const renderCell = (order: DispatchOrder, columnId: string) => {
    const pickList = getPickList(order);
    const pickerName = pickList?.assigned_user_id ? pickerMap[pickList.assigned_user_id] : null;
    const deliveryItem = order.delivery_items?.[0];
    const loadId = deliveryItem?.delivery_run_id;
    const loadInfo = loadId ? loads.find(l => l.id === loadId) : null;

    switch (columnId) {
      case 'order_number':
        return (
          <div className="font-medium text-primary">
            #{order.order_number}
          </div>
        );
      case 'customer':
        return order.customer ? (
          <button
            onClick={(e) => handleOpenCustomer(order.customer!.id, e)}
            className="flex items-center gap-2 min-w-0 text-left hover:text-primary hover:underline"
          >
            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="truncate">{order.customer.name}</span>
          </button>
        ) : (
          <span className="text-muted-foreground">Unknown</span>
        );
      case 'county':
        return order.ship_to_address?.county ? (
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3 text-muted-foreground" />
            <span className="truncate">{order.ship_to_address.county}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      case 'eircode':
        return order.ship_to_address?.eircode ? (
          <span className="font-mono text-sm">{order.ship_to_address.eircode}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      case 'status':
        return <OrderStatusBadge status={order.status} />;
      case 'delivery_date':
        return order.requested_delivery_date ? (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {format(new Date(order.requested_delivery_date), 'EEE, MMM d')}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      case 'week':
        return order.requested_delivery_date ? (
          <Badge variant="outline">
            W{getISOWeek(new Date(order.requested_delivery_date))}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      case 'picker':
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <Select
              value={pickList?.assigned_user_id || 'unassign'}
              onValueChange={(value) => {
                if (value === 'manage_team') {
                  router.push('/settings/team');
                  return;
                }
                handleAssignPicker(order.id, value);
              }}
              disabled={updatingPicker === order.id}
            >
              <SelectTrigger className="h-8 text-xs w-full">
                <SelectValue placeholder="Assign picker">
                  {updatingPicker === order.id ? (
                    <span className="text-muted-foreground">Updating...</span>
                  ) : pickerName ? (
                    <span className="truncate">{pickerName}</span>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassign">
                  <span className="text-muted-foreground">Unassigned</span>
                </SelectItem>
                {availablePickers.map(picker => (
                  <SelectItem key={picker.id} value={picker.id}>
                    {picker.name}
                  </SelectItem>
                ))}
                <SelectItem value="manage_team" className="text-primary border-t mt-1 pt-1">
                  <div className="flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    <span>Manage Team</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      case 'load':
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <Select
              value={loadId || 'unassign'}
              onValueChange={(value) => handleAssignLoad(order.id, value)}
              disabled={updatingLoad === order.id}
            >
              <SelectTrigger className="h-8 text-xs w-full">
                <SelectValue placeholder="Assign load">
                  {updatingLoad === order.id ? (
                    <span className="text-muted-foreground">Updating...</span>
                  ) : loadInfo ? (
                    <div className="flex items-center gap-1">
                      <Truck className="h-3 w-3" />
                      <span className="truncate">{loadInfo.name || 'Load'}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassign">
                  <span className="text-muted-foreground">Unassigned</span>
                </SelectItem>
                {loads.map(load => (
                  <SelectItem key={load.id} value={load.id}>
                    <div className="flex items-center gap-2">
                      <span>{load.name}</span>
                      {load.date && (
                        <span className="text-xs text-muted-foreground">
                          ({format(new Date(load.date), 'MMM d')})
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value="create_new" className="text-primary border-t mt-1 pt-1">
                  <div className="flex items-center gap-2">
                    <Plus className="h-3 w-3" />
                    <span>Create New Load</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      case 'trolleys':
        return (
          <div className="text-right font-medium">
            {order.trolleys_estimated || '—'}
          </div>
        );
      case 'actions':
        return (
          <div className="flex items-center justify-end gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenOrder(order.id);
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View order</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => handlePrintTrolleyLabel(order, e)}
                >
                  <Tag className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Print trolley label</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => handlePrintDocs(order.id, e)}
                >
                  <Printer className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Print documents</TooltipContent>
            </Tooltip>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        {/* Filters Bar - Mobile */}
        <div className="md:hidden space-y-3">
          {/* Search + Filter Toggle Row */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant={hasActiveFilters ? 'default' : 'outline'}
              size="icon"
              onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
              className="relative"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
                  {(statusFilter !== 'all' ? 1 : 0) + (loadFilter !== 'all' ? 1 : 0) + (weekFilter ? 1 : 0)}
                </span>
              )}
            </Button>
          </div>

          {/* Collapsible Filters */}
          {mobileFiltersOpen && (
            <div className="p-3 bg-muted/50 rounded-lg space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={loadFilter} onValueChange={setLoadFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Load" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Loads</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {loads.map(load => (
                      <SelectItem key={load.id} value={load.id}>
                        {load.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Week #"
                  value={weekFilter}
                  onChange={(e) => setWeekFilter(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  className="w-20"
                />
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                    <X className="h-4 w-4" />
                    Clear All
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Filters Bar - Desktop */}
        <div className="hidden md:flex flex-row items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap gap-2 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search customer, order #, county..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Load Filter */}
            <Select value={loadFilter} onValueChange={setLoadFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Load" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Loads</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {loads.map(load => (
                  <SelectItem key={load.id} value={load.id}>
                    {load.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Week Filter */}
            <Input
              placeholder="Week #"
              value={weekFilter}
              onChange={(e) => setWeekFilter(e.target.value.replace(/\D/g, '').slice(0, 2))}
              className="w-[80px]"
            />

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                <X className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>

          {/* Column Visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Columns3 className="h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px]">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.filter(c => c.id !== 'actions').map(column => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.visible}
                  onCheckedChange={() => toggleColumnVisibility(column.id)}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
            {hasActiveFilters && ' (filtered)'}
          </span>
          {sortColumn && sortDirection && (
            <span>
              Sorted by {columns.find(c => c.id === sortColumn)?.label} ({sortDirection === 'asc' ? 'ascending' : 'descending'})
            </span>
          )}
        </div>

        {/* Load Status Cards */}
        {loads.length > 0 && (
          <div className="space-y-2">
            <span className="text-sm font-medium text-muted-foreground">Active Loads</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {loads.map(load => {
                const colorClass = loadColorMap[load.id];
                const bgColor = colorClass?.split(' ')[0] || 'bg-gray-100';
                const isReady = load.totalOrders > 0 && load.readyOrders === load.totalOrders;
                const hasBlocked = load.pickingOrders > 0;
                const fillPercent = load.vehicleCapacity > 0
                  ? Math.round((load.totalTrolleys / load.vehicleCapacity) * 100)
                  : 0;

                return (
                  <Card
                    key={load.id}
                    className={cn(
                      'overflow-hidden transition-all hover:shadow-md',
                      colorClass ? `border-l-4 ${bgColor.replace('bg-', 'border-l-')}` : ''
                    )}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Link href={`/dispatch/manager/loads/${load.id}`} className="hover:underline">
                          <h4 className="font-semibold text-sm truncate">{load.name}</h4>
                        </Link>
                        {isReady ? (
                          <Badge variant="default" className="bg-green-600 text-xs shrink-0">
                            Ready
                          </Badge>
                        ) : hasBlocked ? (
                          <Badge variant="secondary" className="bg-amber-500 text-white text-xs shrink-0">
                            Picking
                          </Badge>
                        ) : load.totalOrders === 0 ? (
                          <Badge variant="outline" className="text-xs shrink-0">
                            Empty
                          </Badge>
                        ) : null}
                      </div>

                      {/* Haulier/Vehicle Selectors */}
                      <div className="space-y-1.5 text-xs">
                        <Select
                          value={load.haulierId || ''}
                          onValueChange={(value) => {
                            handleUpdateLoadHaulier(load.id, value || null, null);
                          }}
                          disabled={updatingLoadHaulier === load.id}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Select haulier...">
                              {load.haulierName ? (
                                <div className="flex items-center gap-1">
                                  <Truck className="h-3 w-3" />
                                  <span className="truncate">{load.haulierName}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">Select haulier...</span>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">
                              <span className="text-muted-foreground">No haulier</span>
                            </SelectItem>
                            {hauliers.map(h => (
                              <SelectItem key={h.id} value={h.id}>
                                {h.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Vehicle selector - only show when haulier is selected and has vehicles */}
                        {load.haulierId && (() => {
                          const selectedHaulier = hauliers.find(h => h.id === load.haulierId);
                          const vehicles = selectedHaulier?.vehicles || [];
                          if (vehicles.length === 0) return null;
                          return (
                            <Select
                              value={load.vehicleId || ''}
                              onValueChange={(value) => {
                                handleUpdateLoadHaulier(load.id, load.haulierId, value || null);
                              }}
                              disabled={updatingLoadHaulier === load.id}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="Select vehicle...">
                                  {load.vehicleName || <span className="text-muted-foreground">Select vehicle...</span>}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">
                                  <span className="text-muted-foreground">No vehicle</span>
                                </SelectItem>
                                {vehicles.map(v => (
                                  <SelectItem key={v.id} value={v.id}>
                                    {v.name} ({v.trolleyCapacity}t)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );
                        })()}

                        {/* Stats row */}
                        <div className="flex items-center justify-between text-muted-foreground pt-1">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-green-600" />
                              {load.readyOrders} ready
                            </span>
                            {load.pickingOrders > 0 && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-amber-500" />
                                {load.pickingOrders} picking
                              </span>
                            )}
                          </div>
                          <span className={cn(
                            'font-medium',
                            fillPercent > 100 ? 'text-red-600' :
                            fillPercent > 80 ? 'text-amber-600' : ''
                          )}>
                            {load.totalTrolleys}/{load.vehicleCapacity || '?'}t
                          </span>
                        </div>
                      </div>

                      {/* Quick Dispatch Button */}
                      {load.totalOrders > 0 && (
                        <Button
                          size="sm"
                          variant={isReady ? 'default' : 'outline'}
                          className={cn(
                            'w-full mt-2 h-7 text-xs',
                            isReady ? 'bg-green-600 hover:bg-green-700' : ''
                          )}
                          disabled={!isReady}
                          onClick={async (e) => {
                            e.preventDefault();
                            if (isReady) {
                              toast.loading(`Dispatching ${load.name}...`, { id: `dispatch-${load.id}` });
                              try {
                                const result = await dispatchLoad(load.id);
                                if (result.error) {
                                  toast.error(result.error, { id: `dispatch-${load.id}` });
                                } else {
                                  toast.success(`${load.name} dispatched with ${result.ordersDispatched} orders`, { id: `dispatch-${load.id}` });
                                  router.refresh();
                                }
                              } catch (err: any) {
                                toast.error(err?.message || 'Failed to dispatch load', { id: `dispatch-${load.id}` });
                              }
                            }
                          }}
                        >
                          <Send className="h-3 w-3 mr-1" />
                          {isReady ? 'Dispatch' : `${load.readyOrders}/${load.totalOrders} Ready`}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredOrders.length === 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">No Orders</h3>
                <p className="text-muted-foreground">
                  {hasActiveFilters
                    ? 'No orders match your filters. Try adjusting your search criteria.'
                    : 'No orders currently need dispatch attention.'}
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
                    Clear Filters
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mobile Card View */}
        {filteredOrders.length > 0 && (
          <div className="md:hidden space-y-3">
            {filteredOrders.map((order) => {
              const pickList = getPickList(order);
              const pickerName = pickList?.assigned_user_id ? pickerMap[pickList.assigned_user_id] : null;
              const deliveryItem = order.delivery_items?.[0];
              const loadId = deliveryItem?.delivery_run_id;
              const loadInfo = loadId ? loads.find(l => l.id === loadId) : null;
              const loadColor = loadId ? loadColorMap[loadId]?.split(' ')[0] : '';

              return (
                <Card
                  key={order.id}
                  className={cn('overflow-hidden', loadColor && `${loadColor} border-l-4`)}
                >
                  <CardContent className="p-0">
                    {/* Tappable header */}
                    <button
                      className="w-full p-3 text-left hover:bg-muted/50 active:bg-muted transition-colors"
                      onClick={() => handleOpenOrder(order.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-primary">#{order.order_number}</span>
                            <OrderStatusBadge status={order.status} />
                          </div>
                          <p className="font-medium truncate mt-0.5">
                            {order.customer?.name || 'Unknown Customer'}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      </div>
                      <div className="flex items-center flex-wrap gap-2 mt-2 text-sm text-muted-foreground">
                        {order.requested_delivery_date && (
                          <>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {format(new Date(order.requested_delivery_date), 'EEE, MMM d')}
                            </span>
                            <Badge variant="outline" className="text-xs px-1.5 py-0">
                              W{getISOWeek(new Date(order.requested_delivery_date))}
                            </Badge>
                          </>
                        )}
                        {order.ship_to_address?.county && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {order.ship_to_address.county}
                            {order.ship_to_address.eircode && (
                              <span className="text-xs">({order.ship_to_address.eircode})</span>
                            )}
                          </span>
                        )}
                        {order.trolleys_estimated != null && (
                          <span className="flex items-center gap-1">
                            <Package className="h-3.5 w-3.5" />
                            {order.trolleys_estimated}
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Assignment Row */}
                    <div className="border-t px-3 py-2 bg-muted/30 grid grid-cols-2 gap-2">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Label className="text-xs text-muted-foreground mb-1 block">Picker</Label>
                        <Select
                          value={pickList?.assigned_user_id || 'unassign'}
                          onValueChange={(value) => {
                            if (value === 'manage_team') {
                              router.push('/settings/team');
                              return;
                            }
                            handleAssignPicker(order.id, value);
                          }}
                          disabled={updatingPicker === order.id}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Assign">
                              {updatingPicker === order.id ? (
                                <span className="text-muted-foreground">...</span>
                              ) : pickerName ? (
                                <span className="truncate">{pickerName}</span>
                              ) : (
                                <span className="text-muted-foreground">Unassigned</span>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassign">
                              <span className="text-muted-foreground">Unassigned</span>
                            </SelectItem>
                            {availablePickers.map(picker => (
                              <SelectItem key={picker.id} value={picker.id}>
                                {picker.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <Label className="text-xs text-muted-foreground mb-1 block">Load</Label>
                        <Select
                          value={loadId || 'unassign'}
                          onValueChange={(value) => handleAssignLoad(order.id, value)}
                          disabled={updatingLoad === order.id}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Assign">
                              {updatingLoad === order.id ? (
                                <span className="text-muted-foreground">...</span>
                              ) : loadInfo ? (
                                <div className="flex items-center gap-1 truncate">
                                  <Truck className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">{loadInfo.name}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">Unassigned</span>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassign">
                              <span className="text-muted-foreground">Unassigned</span>
                            </SelectItem>
                            {loads.map(load => (
                              <SelectItem key={load.id} value={load.id}>
                                {load.name}
                              </SelectItem>
                            ))}
                            <SelectItem value="create_new" className="text-primary border-t mt-1 pt-1">
                              <div className="flex items-center gap-2">
                                <Plus className="h-3 w-3" />
                                <span>Create New Load</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Desktop Table View */}
        {filteredOrders.length > 0 && (
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table ref={tableRef}>
                  <TableHeader>
                    <TableRow>
                      {visibleColumns.map((column, index) => (
                        <TableHead
                          key={column.id}
                          style={{ width: columnWidths[column.id], minWidth: column.minWidth }}
                          className={cn(
                            'relative select-none',
                            column.sortable && 'cursor-pointer hover:bg-muted/50',
                            column.id === 'trolleys' && 'text-right',
                          )}
                          onClick={() => column.sortable && handleSort(column.id)}
                        >
                          <div className="flex items-center gap-1">
                            <span className="truncate">{column.label}</span>
                            {column.sortable && sortColumn === column.id && (
                              sortDirection === 'asc' ? (
                                <ChevronUp className="h-4 w-4 flex-shrink-0" />
                              ) : sortDirection === 'desc' ? (
                                <ChevronDown className="h-4 w-4 flex-shrink-0" />
                              ) : null
                            )}
                          </div>
                          {/* Resize Handle */}
                          {index < visibleColumns.length - 1 && (
                            <div
                              className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 group"
                              onMouseDown={(e) => handleResizeStart(column.id, e)}
                            >
                              <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100">
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow
                        key={order.id}
                        className={cn('cursor-pointer', getRowColor(order))}
                        onClick={() => handleOpenOrder(order.id)}
                      >
                        {visibleColumns.map((column) => (
                          <TableCell
                            key={column.id}
                            style={{ width: columnWidths[column.id], maxWidth: columnWidths[column.id] }}
                            className={cn(
                              'overflow-hidden',
                              column.id === 'trolleys' && 'text-right',
                            )}
                          >
                            {renderCell(order, column.id)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create Load Dialog */}
        <Dialog open={showCreateLoadDialog} onOpenChange={setShowCreateLoadDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Load</DialogTitle>
              <DialogDescription>
                Create a new delivery load to assign orders to.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="loadCode">Load Code</Label>
                <Input
                  id="loadCode"
                  placeholder="e.g., 4L (Thursday Liam)"
                  value={newLoadCode}
                  onChange={(e) => setNewLoadCode(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loadDate">Delivery Date</Label>
                <Input
                  id="loadDate"
                  type="date"
                  value={newLoadDate}
                  onChange={(e) => setNewLoadDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateLoadDialog(false);
                  setCreateLoadForOrderId(null);
                  setNewLoadCode('');
                }}
                disabled={creatingLoad}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateLoad} disabled={creatingLoad}>
                {creatingLoad ? 'Creating...' : 'Create Load'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Trolley Label Print Dialog - Always render to prevent Radix ID hydration mismatch */}
        <TrolleyLabelPrintDialog
          open={showLabelDialog && !!selectedOrderForLabel}
          onOpenChange={(open) => {
            setShowLabelDialog(open);
            if (!open) setSelectedOrderForLabel(null);
          }}
          order={{
            id: selectedOrderForLabel?.id ?? '',
            orderNumber: selectedOrderForLabel?.order_number ?? '',
            customerName: selectedOrderForLabel?.customer?.name || 'Unknown Customer',
            deliveryDate: selectedOrderForLabel?.requested_delivery_date ?? null,
            trolleysEstimated: selectedOrderForLabel?.trolleys_estimated ?? null,
          }}
        />
      </div>
    </TooltipProvider>
  );
}
