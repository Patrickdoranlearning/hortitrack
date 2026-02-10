'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Truck,
  Package,
  GripVertical,
  X,
  RotateCcw,
  Wand2,
  Save,
  Loader2,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { TruckLayout, DEFAULT_LAYOUTS, STOP_COLORS, getStopColor } from './TruckVisualization';

export interface OrderForLoading {
  id: string;
  orderNumber: string;
  customerName: string;
  trolleysNeeded: number;
  stopIndex: number;
}

export interface SlotAssignment {
  slotIndex: number;
  orderId: string;
  trolleyNumber: number; // Which trolley of this order (1, 2, 3...)
}

interface TruckLoadingViewProps {
  layout: TruckLayout;
  orders: OrderForLoading[];
  initialAssignments?: SlotAssignment[];
  onSave?: (assignments: SlotAssignment[]) => Promise<void>;
  className?: string;
}

export default function TruckLoadingView({
  layout,
  orders,
  initialAssignments = [],
  onSave,
  className,
}: TruckLoadingViewProps) {
  const [assignments, setAssignments] = useState<SlotAssignment[]>(initialAssignments);
  const [draggedItem, setDraggedItem] = useState<{ orderId: string; trolleyNum: number } | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Calculate dimensions
  const slotWidth = layout.type === 'trailer' ? 40 : layout.type === 'truck' ? 48 : 56;
  const slotHeight = layout.type === 'trailer' ? 48 : layout.type === 'truck' ? 56 : 64;
  const gap = 4;
  const padding = 16;
  const cabWidth = layout.type === 'van' ? 60 : layout.type === 'truck' ? 80 : 100;

  const gridWidth = layout.columns * (slotWidth + gap) - gap;
  const gridHeight = layout.rows * (slotHeight + gap) - gap;
  const totalWidth = gridWidth + padding * 2 + cabWidth + 20;
  const totalHeight = gridHeight + padding * 2 + 40;

  // Get assignment for a slot
  const getSlotAssignment = (slotIndex: number) => {
    return assignments.find(a => a.slotIndex === slotIndex);
  };

  // Get order by ID
  const getOrder = (orderId: string) => {
    return orders.find(o => o.id === orderId);
  };

  // Count assigned trolleys for an order
  const getAssignedCount = (orderId: string) => {
    return assignments.filter(a => a.orderId === orderId).length;
  };

  // Get unassigned trolleys for an order
  const getUnassignedTrolleys = (order: OrderForLoading) => {
    const assigned = getAssignedCount(order.id);
    const unassigned: number[] = [];
    for (let i = assigned + 1; i <= order.trolleysNeeded; i++) {
      unassigned.push(i);
    }
    return unassigned;
  };

  // Handle drag start from unassigned list
  const handleDragStart = (orderId: string, trolleyNum: number) => {
    setDraggedItem({ orderId, trolleyNum });
  };

  // Handle drag over slot
  const handleDragOver = (e: React.DragEvent, slotIndex: number) => {
    e.preventDefault();
    setDragOverSlot(slotIndex);
  };

  // Handle drag leave
  const handleDragLeave = () => {
    setDragOverSlot(null);
  };

  // Handle drop on slot
  const handleDrop = (e: React.DragEvent, slotIndex: number) => {
    e.preventDefault();
    setDragOverSlot(null);

    if (!draggedItem) return;

    // Check if slot is already occupied
    const existing = getSlotAssignment(slotIndex);
    if (existing) {
      toast.error('Slot already occupied. Clear it first.');
      return;
    }

    // Add assignment
    setAssignments(prev => [
      ...prev,
      {
        slotIndex,
        orderId: draggedItem.orderId,
        trolleyNumber: draggedItem.trolleyNum,
      },
    ]);

    setDraggedItem(null);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverSlot(null);
  };

  // Clear a slot
  const clearSlot = (slotIndex: number) => {
    setAssignments(prev => prev.filter(a => a.slotIndex !== slotIndex));
  };

  // Auto-assign trolleys to slots
  const autoAssign = () => {
    const newAssignments: SlotAssignment[] = [];
    let slotIndex = 0;

    // Sort orders by stop index (load in reverse order - last stop first at back)
    const sortedOrders = [...orders].sort((a, b) => b.stopIndex - a.stopIndex);

    for (const order of sortedOrders) {
      for (let t = 1; t <= order.trolleysNeeded; t++) {
        if (slotIndex < layout.trolleySlots) {
          newAssignments.push({
            slotIndex,
            orderId: order.id,
            trolleyNumber: t,
          });
          slotIndex++;
        }
      }
    }

    setAssignments(newAssignments);
    toast.success(`Auto-assigned ${newAssignments.length} trolleys to slots`);
  };

  // Clear all assignments
  const clearAll = () => {
    setAssignments([]);
  };

  // Save assignments
  const handleSave = async () => {
    if (!onSave) return;

    setIsSaving(true);
    try {
      await onSave(assignments);
      toast.success('Truck loading saved');
    } catch (error) {
      toast.error('Failed to save loading');
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate totals
  const totalTrolleysNeeded = orders.reduce((sum, o) => sum + o.trolleysNeeded, 0);
  const totalAssigned = assignments.length;

  return (
    <div className={cn('grid gap-4 lg:grid-cols-3', className)}>
      {/* Truck Visualization - takes 2/3 */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Load Truck
                </CardTitle>
                <CardDescription>
                  Drag orders from the list to specific slots
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={autoAssign}>
                  <Wand2 className="h-4 w-4 mr-1" />
                  Auto
                </Button>
                <Button variant="outline" size="sm" onClick={clearAll}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Clear
                </Button>
                {onSave && (
                  <Button size="sm" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Save
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <svg
                viewBox={`0 0 ${totalWidth} ${totalHeight}`}
                className="w-full max-w-full"
                style={{ minWidth: Math.min(totalWidth, 400), maxHeight: 400 }}
              >
                {/* Truck body (cargo area) */}
                <rect
                  x={cabWidth + 10}
                  y={20}
                  width={gridWidth + padding * 2}
                  height={gridHeight + padding * 2}
                  rx={4}
                  fill="#e2e8f0"
                  stroke="#94a3b8"
                  strokeWidth={2}
                />

                {/* Cab */}
                <g transform={`translate(0, ${(gridHeight + padding * 2 - 60) / 2 + 20})`}>
                  <rect x={0} y={0} width={cabWidth} height={60} rx={4} fill="#cbd5e1" stroke="#94a3b8" strokeWidth={2} />
                  <rect x={5} y={5} width={cabWidth - 20} height={25} rx={2} fill="#bae6fd" />
                  <rect x={5} y={35} width={cabWidth - 20} height={20} rx={2} fill="#94a3b8" />
                  <circle cx={15} cy={65} r={8} fill="#475569" />
                  <circle cx={cabWidth - 15} cy={65} r={8} fill="#475569" />
                </g>

                {/* Rear wheels */}
                <circle cx={cabWidth + 30} cy={gridHeight + padding * 2 + 25} r={8} fill="#475569" />
                <circle cx={cabWidth + 10 + gridWidth + padding * 2 - 20} cy={gridHeight + padding * 2 + 25} r={8} fill="#475569" />

                {/* Trolley slots grid */}
                <g transform={`translate(${cabWidth + 10 + padding}, ${20 + padding})`}>
                  {Array.from({ length: layout.rows * layout.columns }).map((_, index) => {
                    const row = Math.floor(index / layout.columns);
                    const col = index % layout.columns;
                    const reversedCol = layout.columns - 1 - col;
                    const x = reversedCol * (slotWidth + gap);
                    const y = row * (slotHeight + gap);
                    const assignment = getSlotAssignment(index);
                    const order = assignment ? getOrder(assignment.orderId) : null;
                    const color = order ? getStopColor(order.stopIndex) : null;
                    const isDropTarget = dragOverSlot === index;

                    return (
                      <g
                        key={index}
                        transform={`translate(${x}, ${y})`}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={() => handleDragLeave()}
                        onDrop={(e) => handleDrop(e, index)}
                        style={{ cursor: assignment ? 'pointer' : 'default' }}
                        onClick={() => assignment && clearSlot(index)}
                      >
                        {/* Slot background */}
                        <rect
                          x={0}
                          y={0}
                          width={slotWidth}
                          height={slotHeight}
                          rx={4}
                          fill={assignment ? (color?.hex || '#22c55e') : isDropTarget ? '#bbf7d0' : '#f8fafc'}
                          stroke={isDropTarget ? '#22c55e' : '#cbd5e1'}
                          strokeWidth={isDropTarget ? 2 : 1}
                          strokeDasharray={assignment ? '0' : '4,2'}
                        />

                        {/* Content */}
                        {assignment && order ? (
                          <>
                            {/* Customer initial */}
                            <text
                              x={slotWidth / 2}
                              y={slotHeight / 2 - 4}
                              textAnchor="middle"
                              fill="white"
                              fontSize={14}
                              fontWeight="bold"
                            >
                              {order.customerName.substring(0, 2).toUpperCase()}
                            </text>
                            {/* Trolley number */}
                            <text
                              x={slotWidth / 2}
                              y={slotHeight / 2 + 12}
                              textAnchor="middle"
                              fill="white"
                              fontSize={10}
                              opacity={0.9}
                            >
                              T{assignment.trolleyNumber}
                            </text>
                            {/* Clear indicator on hover */}
                            <circle
                              cx={slotWidth - 8}
                              cy={8}
                              r={6}
                              fill="rgba(0,0,0,0.3)"
                              className="opacity-0 hover:opacity-100 transition-opacity"
                            />
                            <text
                              x={slotWidth - 8}
                              y={11}
                              textAnchor="middle"
                              fill="white"
                              fontSize={10}
                              className="opacity-0 hover:opacity-100 transition-opacity pointer-events-none"
                            >
                              ×
                            </text>
                          </>
                        ) : (
                          <text
                            x={slotWidth / 2}
                            y={slotHeight / 2 + 4}
                            textAnchor="middle"
                            fill="#94a3b8"
                            fontSize={10}
                          >
                            {index + 1}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>

                {/* Labels */}
                <text x={cabWidth + 10 + padding + gridWidth / 2} y={14} textAnchor="middle" fill="#64748b" fontSize={10}>
                  REAR (Load First)
                </text>
                <text x={cabWidth + 10 + padding + gridWidth / 2} y={gridHeight + padding * 2 + 36} textAnchor="middle" fill="#64748b" fontSize={10}>
                  FRONT (Unload Last)
                </text>
              </svg>
            </div>

            {/* Progress bar */}
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Loading Progress</span>
                <span className="font-medium">
                  {totalAssigned} / {totalTrolleysNeeded} trolleys
                </span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${totalTrolleysNeeded > 0 ? (totalAssigned / totalTrolleysNeeded) * 100 : 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders List - takes 1/3 */}
      <div className="lg:col-span-1">
        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Orders to Load
            </CardTitle>
            <CardDescription>
              Drag trolleys to slots on the truck
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-3">
                {orders.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No orders to load
                  </p>
                ) : (
                  orders.map((order) => {
                    const color = getStopColor(order.stopIndex);
                    const assignedCount = getAssignedCount(order.id);
                    const unassigned = getUnassignedTrolleys(order);
                    const isFullyAssigned = assignedCount >= order.trolleysNeeded;

                    return (
                      <div
                        key={order.id}
                        className={cn(
                          'p-3 rounded-lg border',
                          isFullyAssigned ? 'bg-green-50 border-green-200' : 'bg-white'
                        )}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <div className={cn('w-3 h-3 rounded-sm', color.bg)} />
                              <span className="font-medium text-sm truncate max-w-[150px]">
                                {order.customerName}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {order.orderNumber}
                            </p>
                          </div>
                          <Badge variant={isFullyAssigned ? 'default' : 'secondary'} className="text-xs">
                            {assignedCount}/{order.trolleysNeeded}
                          </Badge>
                        </div>

                        {/* Unassigned trolleys (draggable) */}
                        {unassigned.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {unassigned.map((trolleyNum) => (
                              <div
                                key={trolleyNum}
                                draggable
                                onDragStart={() => handleDragStart(order.id, trolleyNum)}
                                onDragEnd={handleDragEnd}
                                className={cn(
                                  'flex items-center gap-1 px-2 py-1 rounded text-xs cursor-grab active:cursor-grabbing',
                                  color.light,
                                  color.text,
                                  'border border-current/20 hover:border-current/40 transition-colors'
                                )}
                              >
                                <GripVertical className="h-3 w-3 opacity-50" />
                                T{trolleyNum}
                              </div>
                            ))}
                          </div>
                        )}

                        {isFullyAssigned && (
                          <p className="text-xs text-green-600 mt-1">✓ All trolleys assigned</p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

