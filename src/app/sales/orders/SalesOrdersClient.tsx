'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { format, getISOWeek } from 'date-fns';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent } from '@/components/ui/card';
import { ViewToggle, useViewToggle } from '@/components/ui/view-toggle';
import OrderStatusBadge from '@/components/sales/OrderStatusBadge';
import {
  Printer,
  Copy,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  MapPin
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
  statusFilter?: string;
}

// Tab configuration mapping to order statuses
const STATUS_TABS = [
  { 
    id: 'all', 
    label: 'All Orders', 
    statuses: null,
    description: 'All orders'
  },
  { 
    id: 'needs_action', 
    label: 'Needs Action', 
    statuses: ['draft'],
    description: 'Drafts & webshop orders'
  },
  { 
    id: 'processing', 
    label: 'Processing', 
    statuses: ['confirmed', 'picking'],
    description: 'In progress'
  },
  { 
    id: 'ready', 
    label: 'Ready to Ship', 
    statuses: ['ready', 'ready_for_dispatch'],
    description: 'Packed & waiting'
  },
  { 
    id: 'complete', 
    label: 'Complete', 
    statuses: ['dispatched', 'delivered'],
    description: 'Shipped & delivered'
  },
];

function getTabFromStatus(status?: string): string {
  if (!status) return 'all';
  for (const tab of STATUS_TABS) {
    if (tab.statuses?.includes(status)) {
      return tab.id;
    }
  }
  return 'all';
}

function getStatusesFromTab(tabId: string): string[] | null {
  const tab = STATUS_TABS.find(t => t.id === tabId);
  return tab?.statuses || null;
}

export default function SalesOrdersClient({ 
  initialOrders, 
  total, 
  page, 
  pageSize, 
  statusFilter 
}: SalesOrdersClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(getTabFromStatus(statusFilter));
  const [searchQuery, setSearchQuery] = useState('');
  const [weekFilter, setWeekFilter] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const { value: viewMode, setValue: setViewMode } = useViewToggle('sales-orders-view', 'table');

  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));
  const INACTIVE_STATUSES = ['dispatched', 'delivered', 'cancelled'];

  const updateQuery = (nextPage: number, nextStatuses?: string[] | null) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('page', String(nextPage));
    params.set('pageSize', String(pageSize));
    
    // Clear existing status
    params.delete('status');
    
    // If filtering by specific statuses, use the first one for URL compatibility
    if (nextStatuses && nextStatuses.length > 0) {
      params.set('status', nextStatuses[0]);
    }
    
    router.push(`/sales/orders?${params.toString()}`);
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    const statuses = getStatusesFromTab(tabId);
    updateQuery(1, statuses);
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

  // Filter orders based on active tab (client-side for immediate feedback)
  const filteredOrders = initialOrders
    // tab filter (status)
    .filter((order) => {
      if (activeTab === 'all') return true;
      const tabStatuses = getStatusesFromTab(activeTab);
      return tabStatuses?.includes(order.status);
    })
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

  // Calculate fulfillment percentage (placeholder - would need allocated data)
  const getFulfillmentBadge = (order: SalesOrderWithCustomer) => {
    if (order._itemCount && order._allocatedCount !== undefined) {
      const percentage = Math.round((order._allocatedCount / order._itemCount) * 100);
      return (
        <Badge 
          variant={percentage === 100 ? 'default' : 'secondary'}
          className={percentage === 100 ? 'bg-green-100 text-green-700' : ''}
        >
          {percentage}%
        </Badge>
      );
    }
    return null;
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        {/* Smart Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-5">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="text-xs sm:text-sm">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab Content - All use the same table */}
        {STATUS_TABS.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-4">
            <div className="text-sm text-muted-foreground mb-4">
              {tab.description} • {activeTab === tab.id ? filteredOrders.length : '...'} orders
            </div>
          </TabsContent>
        ))}
      </Tabs>

        {/* Filters */}
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

      {/* Orders - Empty State */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed">
          <p className="text-muted-foreground">
            No orders in this category. Create your first order to get started.
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
                        €{(order.total_inc_vat || 0).toFixed(2)}
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
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden md:table-cell">Route</TableHead>
                <TableHead className="hidden sm:table-cell">Delivery</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-[170px]">Actions</TableHead>
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
                      {getFulfillmentBadge(order)}
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
                      €{(order.total_inc_vat || 0).toFixed(2)}
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
            onClick={() => updateQuery(Math.max(1, page - 1), getStatusesFromTab(activeTab))}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateQuery(Math.min(totalPages, page + 1), getStatusesFromTab(activeTab))}
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
