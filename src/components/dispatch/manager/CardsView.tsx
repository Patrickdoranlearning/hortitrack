'use client';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { OrderCardFull } from '../shared/OrderCardFull';
import type { DispatchBoardOrder, ActiveDeliveryRunSummary } from '@/lib/dispatch/types';
import type { GrowerMember } from '@/server/dispatch/queries.server';

interface CardsViewProps {
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
}

export function CardsView({
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
}: CardsViewProps) {
  // Group orders by status
  const unassigned = orders.filter((o) => !o.deliveryRunId);
  const assigned = orders.filter((o) => o.deliveryRunId);

  return (
    <div className="space-y-6">
      {/* Unassigned Orders Grid */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          Unassigned Orders
          <Badge variant="secondary">{unassigned.length}</Badge>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {unassigned.map((order) => (
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
          <p className="text-muted-foreground text-center py-8">
            All orders are assigned to loads
          </p>
        )}
      </div>

      {/* Load Drop Zones */}
      {loads.length > 0 && unassigned.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">Drop into Load</h3>
          <div className="flex gap-2 flex-wrap">
            {loads.map((load) => (
              <div
                key={load.id}
                className={cn(
                  'px-4 py-3 rounded-lg border-2 border-dashed transition-colors',
                  dragOverBin === load.id
                    ? 'border-primary bg-primary/10'
                    : 'border-muted'
                )}
                onDragOver={(e) => onDragOver(e, load.id)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, load.id)}
              >
                <p className="font-medium text-sm">
                  {load.loadName || load.runNumber}
                </p>
                <p className="text-xs text-muted-foreground">
                  {load.totalTrolleysAssigned}/{load.vehicleCapacity || 20}{' '}
                  trolleys
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
          {assigned.map((order) => (
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
          <p className="text-muted-foreground text-center py-8">
            No orders assigned to loads yet
          </p>
        )}
      </div>
    </div>
  );
}
