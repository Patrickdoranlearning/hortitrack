'use client';

import { format, parseISO } from 'date-fns';
import {
  Truck,
  MapPin,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Package,
  Send,
  Undo2,
  CheckCircle2,
  Eye,
  MoreHorizontal,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { OrderCard } from '../shared/OrderCard';
import type { DispatchBoardOrder, ActiveDeliveryRunSummary } from '@/lib/dispatch/types';
import { getLoadColor } from '@/lib/dispatch/types';
import type { HaulierWithVehicles } from '@/lib/types';
import type { GrowerMember } from '@/server/dispatch/queries.server';

const UNASSIGNED_BIN = '__unassigned__';

interface LoadsViewProps {
  ordersByLoad: Record<string, DispatchBoardOrder[]>;
  loads: ActiveDeliveryRunSummary[];
  hauliers: HaulierWithVehicles[];
  growers: GrowerMember[];
  countySummary: [string, { count: number; trolleys: number }][];
  loadGaps: {
    load: ActiveDeliveryRunSummary;
    needed: number;
    targetCounties: string[];
  }[];
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
}

export function LoadsView({
  ordersByLoad,
  loads,
  hauliers,
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
}: LoadsViewProps) {
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
              {loadGaps.slice(0, 3).map((gap) => (
                <div
                  key={gap.load.id}
                  className="text-xs text-amber-700 dark:text-amber-400"
                >
                  <span className="font-medium">
                    {gap.load.loadName || gap.load.runNumber}
                  </span>
                  {' needs '}
                  <span className="font-semibold">{gap.needed}</span>
                  {' more trolleys'}
                  {gap.targetCounties.length > 0 && (
                    <span className="text-muted-foreground">
                      {' '}
                      ({gap.targetCounties.join(', ')})
                    </span>
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
              'p-2 space-y-2 min-h-full',
              dragOverBin === UNASSIGNED_BIN && 'bg-primary/5'
            )}
          >
            {unassignedOrders.map((order) => (
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
            {loads.map((load, loadIndex) => {
              const loadOrders = ordersByLoad[load.id] || [];
              const isCollapsed = collapsedLoads.has(load.id);
              const haulier = hauliers.find((h) => h.id === load.haulierId);

              // Get color based on haulier type (internal vs external)
              const isInternal = haulier?.isInternal !== false; // Default to internal if no haulier
              const loadColor = getLoadColor(isInternal, loadIndex);

              return (
                <div
                  key={load.id}
                  className={cn(
                    'w-[300px] flex-shrink-0 rounded-lg border-2 transition-all',
                    isCollapsed ? 'h-fit' : 'min-h-[400px]',
                    dragOverBin === load.id
                      ? 'border-primary bg-primary/5'
                      : loadColor
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
                            {load.runDate &&
                              format(parseISO(load.runDate), 'EEE, MMM d')}
                            {load.weekNumber && ` • W${load.weekNumber}`}
                          </p>
                        </div>
                      </button>
                      <div className="flex items-center gap-1">
                        {load.status === 'in_transit' && (
                          <Badge
                            variant="default"
                            className="text-xs bg-green-600"
                          >
                            <Truck className="h-3 w-3 mr-1" />
                            Dispatched
                          </Badge>
                        )}
                        {load.status === 'completed' && (
                          <Badge
                            variant="default"
                            className="text-xs bg-blue-600"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Completed
                          </Badge>
                        )}
                        {load.status !== 'in_transit' &&
                          load.status !== 'completed' && (
                            <Badge variant="secondary" className="text-xs">
                              {loadOrders.length}
                            </Badge>
                          )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {load.status !== 'in_transit' &&
                              load.status !== 'completed' && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    onDispatchLoad(
                                      load.id,
                                      load.loadName || load.runNumber,
                                      loadOrders.length
                                    )
                                  }
                                  className="text-green-600"
                                >
                                  <Send className="h-4 w-4 mr-2" />
                                  Dispatch Load
                                </DropdownMenuItem>
                              )}
                            {(load.status === 'in_transit' ||
                              load.status === 'loading') && (
                              <DropdownMenuItem
                                onClick={() =>
                                  onRecallLoad(
                                    load.id,
                                    load.loadName || load.runNumber
                                  )
                                }
                                className="text-amber-600"
                              >
                                <Undo2 className="h-4 w-4 mr-2" />
                                Recall Load
                              </DropdownMenuItem>
                            )}
                            {(load.status === 'in_transit' ||
                              load.status === 'loading') && (
                              <DropdownMenuItem asChild>
                                <a
                                  href={`/dispatch/driver?runId=${load.id}`}
                                  className="text-blue-600"
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  Driver View
                                </a>
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
                            {load.vehicleName &&
                              haulier &&
                              ` (${haulier.name})`}
                          </span>
                          <span
                            className={cn(
                              'font-medium',
                              getFillColor(load.fillPercentage)
                            )}
                          >
                            {load.totalTrolleysAssigned}/{load.vehicleCapacity}{' '}
                            trolleys
                          </span>
                        </div>
                      )}
                      <Progress
                        value={Math.min(load.fillPercentage, 100)}
                        className="h-2"
                      />
                      <div className="flex items-center justify-between">
                        <p
                          className={cn(
                            'text-xs',
                            getFillColor(load.fillPercentage)
                          )}
                        >
                          {load.fillPercentage}% full
                        </p>
                        <div className="flex items-center gap-1">
                          {loadOrders.length > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              asChild
                            >
                              <a href={`/dispatch/driver?runId=${load.id}`}>
                                <Eye className="h-3 w-3 mr-1" />
                                Driver
                              </a>
                            </Button>
                          )}
                          {load.status !== 'in_transit' &&
                            load.status !== 'completed' &&
                            loadOrders.length > 0 && (
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 text-xs bg-green-600 hover:bg-green-700"
                                onClick={() =>
                                  onDispatchLoad(
                                    load.id,
                                    load.loadName || load.runNumber,
                                    loadOrders.length
                                  )
                                }
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
                              onClick={() =>
                                onRecallLoad(
                                  load.id,
                                  load.loadName || load.runNumber
                                )
                              }
                            >
                              <Undo2 className="h-3 w-3 mr-1" />
                              Recall
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Load Orders */}
                  {!isCollapsed && (
                    <ScrollArea className="h-[calc(100%-140px)]">
                      <div className="p-2 space-y-2">
                        {loadOrders.map((order) => (
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
