'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import OrderStatusBadge from '@/components/sales/OrderStatusBadge';
import { toast } from 'sonner';
import TrolleyLabelPrintDialog from '@/components/dispatch/TrolleyLabelPrintDialog';

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
}

interface DispatchOrdersClientProps {
  initialOrders: DispatchOrder[];
  pickerMap: Record<string, string>;
  availablePickers: AvailablePicker[];
  availableLoads: AvailableLoad[];
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
  { value: 'processing', label: 'Processing' },
  { value: 'picking', label: 'Picking' },
  { value: 'ready', label: 'Ready' },
  { value: 'ready_for_dispatch', label: 'Ready for Dispatch' },
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
  const [newLoadName, setNewLoadName] = useState('');
  const [newLoadDate, setNewLoadDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [creatingLoad, setCreatingLoad] = useState(false);
  const [loads, setLoads] = useState<AvailableLoad[]>(availableLoads);

  // Trolley label dialog state
  const [showLabelDialog, setShowLabelDialog] = useState(false);
  const [selectedOrderForLabel, setSelectedOrderForLabel] = useState<DispatchOrder | null>(null);

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

  // Create a new load
  const handleCreateLoad = async () => {
    if (!newLoadName.trim()) {
      toast.error('Please enter a load name');
      return;
    }

    setCreatingLoad(true);
    try {
      const response = await fetch('/api/dispatch/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loadName: newLoadName.trim(),
          runDate: newLoadDate,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create load');
      }

      const data = await response.json();
      const newLoad: AvailableLoad = {
        id: data.id,
        name: newLoadName.trim(),
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
      setNewLoadName('');
      setNewLoadDate(format(new Date(), 'yyyy-MM-dd'));
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
        {/* Filters Bar */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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

        {/* Load Color Legend */}
        {Object.keys(loadColorMap).length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-muted-foreground">Loads:</span>
            {loads
              .filter(load => loadColorMap[load.id])
              .map(load => {
                const colorClass = loadColorMap[load.id];
                const bgColor = colorClass.split(' ')[0]; // Get just the bg-* class
                return (
                  <Badge key={load.id} variant="outline" className={cn(bgColor, 'border-0')}>
                    {load.name}
                  </Badge>
                );
              })}
          </div>
        )}

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {filteredOrders.length === 0 ? (
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
            ) : (
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
            )}
          </CardContent>
        </Card>

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
                <Label htmlFor="loadName">Load Name</Label>
                <Input
                  id="loadName"
                  placeholder="e.g., Cork Load 1, Dublin AM"
                  value={newLoadName}
                  onChange={(e) => setNewLoadName(e.target.value)}
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
                  setNewLoadName('');
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
