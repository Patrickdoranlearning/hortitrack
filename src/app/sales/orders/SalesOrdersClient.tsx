'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useCallback } from 'react';
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
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent } from '@/components/ui/card';
import { ViewToggle, useViewToggle } from '@/components/ui/view-toggle';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import OrderStatusBadge from '@/components/sales/OrderStatusBadge';
import { formatCurrency, type CurrencyCode } from '@/lib/format-currency';
import {
  Printer,
  Copy,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  MapPin,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
} from 'lucide-react';

export interface SalesOrderWithCustomer {
  id: string;
  org_id: string;
  customer_id: string;
  order_number: string;
  status: string;
  subtotal_ex_vat: number | null;
  vat_amount: number | null;
  total_inc_vat: number | null;
  requested_delivery_date: string | null;
  notes: string | null;
  created_at: string;
  currency?: string;
  updated_at: string;
  customer?: {
    name: string;
  } | null;
  ship_to_address?: {
    county: string | null;
    city: string | null;
  } | null;
  _itemCount?: number;
  _allocatedCount?: number;
}

interface SalesOrdersClientProps {
  initialOrders: SalesOrderWithCustomer[];
  total: number;
  page: number;
  pageSize: number;
  statusFilter?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// All available order statuses
const ALL_STATUSES = [
  { id: 'draft', label: 'Draft' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'picking', label: 'Picking' },
  { id: 'ready', label: 'Ready' },
  { id: 'packed', label: 'Packed' },
  { id: 'ready_for_dispatch', label: 'Ready for Dispatch' },
  { id: 'dispatched', label: 'Dispatched' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'void', label: 'Void' },
];

const INACTIVE_STATUSES = ['dispatched', 'delivered', 'cancelled', 'void'];

export default function SalesOrdersClient({
  initialOrders,
  total,
  page,
  pageSize,
  statusFilter = [],
  sortBy = 'created_at',
  sortOrder = 'desc',
}: SalesOrdersClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [weekFilter, setWeekFilter] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(statusFilter);
  const { value: viewMode, setValue: setViewMode } = useViewToggle('sales-orders-view', 'table');

  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));

  // Build URL with all current filters
  const updateQuery = useCallback((updates: {
    page?: number;
    statuses?: string[];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) => {
    const params = new URLSearchParams(searchParams?.toString() || '');

    if (updates.page !== undefined) {
      params.set('page', String(updates.page));
    }
    params.set('pageSize', String(pageSize));

    if (updates.statuses !== undefined) {
      params.delete('status');
      if (updates.statuses.length > 0) {
        params.set('status', updates.statuses.join(','));
      }
    }

    if (updates.sortBy !== undefined) {
      params.set('sortBy', updates.sortBy);
    }
    if (updates.sortOrder !== undefined) {
      params.set('sortOrder', updates.sortOrder);
    }

    router.push(`/sales/orders?${params.toString()}`);
  }, [router, searchParams, pageSize]);

  // Handle column sorting
  const handleSort = (column: string) => {
    const newSortOrder = sortBy === column && sortOrder === 'asc' ? 'desc' : 'asc';
    updateQuery({ sortBy: column, sortOrder: newSortOrder, page: 1 });
  };

  // Get sort icon for column
  const getSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortOrder === 'asc'
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // Handle status filter change
  const handleStatusChange = (statusId: string, checked: boolean) => {
    const newStatuses = checked
      ? [...selectedStatuses, statusId]
      : selectedStatuses.filter(s => s !== statusId);
    setSelectedStatuses(newStatuses);
    updateQuery({ statuses: newStatuses, page: 1 });
  };

  // Clear all status filters
  const clearStatusFilter = () => {
    setSelectedStatuses([]);
    updateQuery({ statuses: [], page: 1 });
  };

  const handleOpenOrder = (orderId: string) => {
    router.push(`/sales/orders/${orderId}`);
  };

  const handleCopyOrder = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/sales/orders/new?copyOrderId=${orderId}`);
  };

  const handlePrintDocs = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`/sales/orders/${orderId}/dispatch-documents`, '_blank');
  };

  // Client-side filtering for search, week, and active toggle
  const filteredOrders = initialOrders
    // active vs all
    .filter((order) => (activeOnly ? !INACTIVE_STATUSES.includes(order.status) : true))
    // search (customer or order number)
    .filter((order) => {
      if (!searchQuery.trim()) return true;
      const term = searchQuery.trim().toLowerCase();
      const customerName = order.customer?.name?.toLowerCase() || '';
      const orderNumber = order.order_number?.toLowerCase() || '';
      return customerName.includes(term) || orderNumber.includes(term);
    })
    // week number filter
    .filter((order) => {
      if (!weekFilter.trim()) return true;
      if (!order.requested_delivery_date) return false;
      const week = getISOWeek(new Date(order.requested_delivery_date));
      return String(week) === weekFilter.trim();
    });

  // Sortable column header component
  const SortableHeader = ({ column, children, className = '' }: {
    column: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <TableHead className={className}>
      <button
        onClick={() => handleSort(column)}
        className="flex items-center hover:text-foreground transition-colors"
      >
        {children}
        {getSortIcon(column)}
      </button>
    </TableHead>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        {/* Filters Row */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="Search by customer or order #"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="sm:max-w-xs"
            />
            <Input
              placeholder="Week number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={weekFilter}
              onChange={(e) => setWeekFilter(e.target.value.replace(/\D/g, '').slice(0, 2))}
              className="sm:max-w-[140px]"
            />

            {/* Status Filter Dropdown */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Status
                  {selectedStatuses.length > 0 && (
                    <span className="ml-1 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-xs">
                      {selectedStatuses.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56" align="start">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Filter by Status</span>
                    {selectedStatuses.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearStatusFilter}
                        className="h-auto p-1 text-xs"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {ALL_STATUSES.map((status) => (
                      <div key={status.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`status-${status.id}`}
                          checked={selectedStatuses.includes(status.id)}
                          onCheckedChange={(checked) =>
                            handleStatusChange(status.id, checked as boolean)
                          }
                        />
                        <Label
                          htmlFor={`status-${status.id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {status.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Show selected status badges */}
            {selectedStatuses.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedStatuses.map((status) => (
                  <span
                    key={status}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted rounded-md"
                  >
                    {ALL_STATUSES.find(s => s.id === status)?.label || status}
                    <button
                      onClick={() => handleStatusChange(status, false)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Active</span>
              <Switch checked={activeOnly} onCheckedChange={setActiveOnly} />
            </div>
            <ViewToggle
              value={viewMode}
              onChange={setViewMode}
              storageKey="sales-orders-view"
            />
          </div>
        </div>

        {/* Order Count */}
        <div className="text-sm text-muted-foreground">
          {filteredOrders.length} orders
          {selectedStatuses.length > 0 && ` (filtered by ${selectedStatuses.length} status${selectedStatuses.length > 1 ? 'es' : ''})`}
        </div>

        {/* Orders - Empty State */}
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed">
            <p className="text-muted-foreground">
              No orders found. {selectedStatuses.length > 0 ? 'Try adjusting your filters.' : 'Create your first order to get started.'}
            </p>
          </div>
        ) : viewMode === 'card' ? (
          /* Card View */
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filteredOrders.map((order) => {
              const customerName = order.customer?.name || 'Unknown Customer';
              const county = order.ship_to_address?.county;
              const city = order.ship_to_address?.city;
              const location = city && county ? `${city}, ${county}` : county || city || null;

              return (
                <Card
                  key={order.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleOpenOrder(order.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-semibold">#{order.order_number}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(order.created_at), 'MMM d, yyyy')}
                        </div>
                      </div>
                      <OrderStatusBadge status={order.status} />
                    </div>

                    <div className="space-y-2">
                      <div className="font-medium truncate" title={customerName}>
                        {customerName}
                      </div>

                      {location && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{location}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="text-sm text-muted-foreground">
                          {order.requested_delivery_date
                            ? format(new Date(order.requested_delivery_date), 'EEE, MMM d')
                            : 'No delivery date'}
                        </div>
                        <div className="font-semibold">
                          {formatCurrency(order.total_inc_vat || 0, (order.currency as CurrencyCode) || 'EUR')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1 mt-3 pt-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={(e) => handlePrintDocs(order.id, e)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={(e) => handleCopyOrder(order.id, e)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader column="status" className="w-[100px]">
                    Status
                  </SortableHeader>
                  <SortableHeader column="order_number">
                    Order
                  </SortableHeader>
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Route</TableHead>
                  <SortableHeader column="requested_delivery_date" className="hidden sm:table-cell">
                    Delivery
                  </SortableHeader>
                  <SortableHeader column="total_inc_vat" className="text-right">
                    Total
                  </SortableHeader>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => {
                  const customerName = order.customer?.name || 'Unknown Customer';
                  const county = order.ship_to_address?.county;
                  const city = order.ship_to_address?.city;
                  const location = city && county ? `${city}, ${county}` : county || city || null;

                  return (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer"
                      onClick={() => handleOpenOrder(order.id)}
                    >
                      <TableCell>
                        <OrderStatusBadge status={order.status} />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">#{order.order_number}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(order.created_at), 'MMM d, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium truncate max-w-[200px]" title={customerName}>
                          {customerName}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {location ? (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate max-w-[120px]" title={location}>
                              {location}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {order.requested_delivery_date ? (
                          <div className="text-sm">
                            {format(new Date(order.requested_delivery_date), 'EEE, MMM d')}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(order.total_inc_vat || 0, (order.currency as CurrencyCode) || 'EUR')}
                      </TableCell>
                      <TableCell>
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
                                <span className="sr-only">View order</span>
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
                                onClick={(e) => handlePrintDocs(order.id, e)}
                              >
                                <Printer className="h-4 w-4" />
                                <span className="sr-only">Print documents</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Print documents</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => handleCopyOrder(order.id, e)}
                              >
                                <Copy className="h-4 w-4" />
                                <span className="sr-only">Copy order</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy to new order</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {page} of {totalPages} • {total} total orders
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateQuery({ page: Math.max(1, page - 1) })}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateQuery({ page: Math.min(totalPages, page + 1) })}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
