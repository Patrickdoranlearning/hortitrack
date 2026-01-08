'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import TruckSlot, { TrolleySlotData } from './TruckSlot';

export interface TruckLayout {
  type: 'van' | 'truck' | 'trailer';
  rows: number;
  columns: number;
  trolleySlots: number;
}

export interface TruckVisualizationProps {
  layout: TruckLayout;
  trolleys: TrolleySlotData[];
  onSlotClick?: (slotIndex: number, trolley?: TrolleySlotData) => void;
  className?: string;
  showLegend?: boolean;
}

// Default layouts for different vehicle types
export const DEFAULT_LAYOUTS: Record<string, TruckLayout> = {
  van: { type: 'van', rows: 2, columns: 5, trolleySlots: 10 },
  truck: { type: 'truck', rows: 3, columns: 10, trolleySlots: 30 },
  trailer: { type: 'trailer', rows: 4, columns: 15, trolleySlots: 60 },
};

// Color palette for delivery stops
export const STOP_COLORS = [
  { bg: 'bg-blue-500', text: 'text-blue-500', light: 'bg-blue-100', hex: '#3b82f6', lightHex: '#dbeafe' },
  { bg: 'bg-green-500', text: 'text-green-500', light: 'bg-green-100', hex: '#22c55e', lightHex: '#dcfce7' },
  { bg: 'bg-orange-500', text: 'text-orange-500', light: 'bg-orange-100', hex: '#f97316', lightHex: '#ffedd5' },
  { bg: 'bg-purple-500', text: 'text-purple-500', light: 'bg-purple-100', hex: '#a855f7', lightHex: '#f3e8ff' },
  { bg: 'bg-pink-500', text: 'text-pink-500', light: 'bg-pink-100', hex: '#ec4899', lightHex: '#fce7f3' },
  { bg: 'bg-cyan-500', text: 'text-cyan-500', light: 'bg-cyan-100', hex: '#06b6d4', lightHex: '#cffafe' },
  { bg: 'bg-amber-500', text: 'text-amber-500', light: 'bg-amber-100', hex: '#f59e0b', lightHex: '#fef3c7' },
  { bg: 'bg-red-500', text: 'text-red-500', light: 'bg-red-100', hex: '#ef4444', lightHex: '#fee2e2' },
  { bg: 'bg-indigo-500', text: 'text-indigo-500', light: 'bg-indigo-100', hex: '#6366f1', lightHex: '#e0e7ff' },
  { bg: 'bg-teal-500', text: 'text-teal-500', light: 'bg-teal-100', hex: '#14b8a6', lightHex: '#ccfbf1' },
];

export function getStopColor(index: number) {
  return STOP_COLORS[index % STOP_COLORS.length];
}

export default function TruckVisualization({
  layout,
  trolleys,
  onSlotClick,
  className,
  showLegend = true,
}: TruckVisualizationProps) {
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  // Create a map of slot index to trolley data
  const trolleyMap = new Map<number, TrolleySlotData>();
  trolleys.forEach((trolley, idx) => {
    // If trolley has a specific slot position, use it; otherwise use sequential
    const slotIndex = trolley.slotIndex ?? idx;
    trolleyMap.set(slotIndex, trolley);
  });

  // Get unique stops for legend
  const uniqueStops = new Map<string, { name: string; colorIndex: number }>();
  trolleys.forEach((trolley) => {
    if (trolley.customerName && !uniqueStops.has(trolley.customerName)) {
      uniqueStops.set(trolley.customerName, {
        name: trolley.customerName,
        colorIndex: trolley.stopIndex ?? uniqueStops.size,
      });
    }
  });

  const handleSlotClick = (slotIndex: number) => {
    setSelectedSlot(slotIndex === selectedSlot ? null : slotIndex);
    const trolley = trolleyMap.get(slotIndex);
    onSlotClick?.(slotIndex, trolley);
  };

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

  return (
    <div className={cn('space-y-4', className)}>
      {/* Truck SVG */}
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
            {/* Cab body */}
            <rect
              x={0}
              y={0}
              width={cabWidth}
              height={60}
              rx={4}
              fill="#cbd5e1"
              stroke="#94a3b8"
              strokeWidth={2}
            />
            {/* Windshield */}
            <rect
              x={5}
              y={5}
              width={cabWidth - 20}
              height={25}
              rx={2}
              fill="#bae6fd"
            />
            {/* Door */}
            <rect
              x={5}
              y={35}
              width={cabWidth - 20}
              height={20}
              rx={2}
              fill="#94a3b8"
            />
            {/* Wheels */}
            <circle cx={15} cy={65} r={8} fill="#475569" />
            <circle cx={cabWidth - 15} cy={65} r={8} fill="#475569" />
          </g>

          {/* Rear wheels */}
          <circle
            cx={cabWidth + 30}
            cy={gridHeight + padding * 2 + 25}
            r={8}
            fill="#475569"
          />
          <circle
            cx={cabWidth + 10 + gridWidth + padding * 2 - 20}
            cy={gridHeight + padding * 2 + 25}
            r={8}
            fill="#475569"
          />

          {/* Trolley slots grid */}
          <g transform={`translate(${cabWidth + 10 + padding}, ${20 + padding})`}>
            {Array.from({ length: layout.rows * layout.columns }).map((_, index) => {
              const row = Math.floor(index / layout.columns);
              const col = index % layout.columns;
              // Reverse column order so first trolley is at back (furthest from cab)
              const reversedCol = layout.columns - 1 - col;
              const x = reversedCol * (slotWidth + gap);
              const y = row * (slotHeight + gap);
              const trolley = trolleyMap.get(index);

              return (
                <g
                  key={index}
                  transform={`translate(${x}, ${y})`}
                  onClick={() => handleSlotClick(index)}
                  style={{ cursor: 'pointer' }}
                >
                  <TruckSlot
                    width={slotWidth}
                    height={slotHeight}
                    trolley={trolley}
                    slotIndex={index}
                    isSelected={selectedSlot === index}
                    colorIndex={trolley?.stopIndex}
                  />
                </g>
              );
            })}
          </g>

          {/* Direction arrow */}
          <g transform={`translate(${cabWidth / 2}, ${(gridHeight + padding * 2 + 40) / 2 + 20})`}>
            <polygon
              points="-10,5 0,-10 10,5"
              fill="#64748b"
            />
          </g>

          {/* Labels */}
          <text
            x={cabWidth + 10 + padding + gridWidth / 2}
            y={14}
            textAnchor="middle"
            fill="#64748b"
            fontSize={10}
          >
            REAR (Load First)
          </text>
          <text
            x={cabWidth + 10 + padding + gridWidth / 2}
            y={gridHeight + padding * 2 + 36}
            textAnchor="middle"
            fill="#64748b"
            fontSize={10}
          >
            FRONT (Unload Last)
          </text>
        </svg>
      </div>

      {/* Legend */}
      {showLegend && uniqueStops.size > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {Array.from(uniqueStops.values()).map((stop) => {
            const color = getStopColor(stop.colorIndex);
            return (
              <div
                key={stop.name}
                className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-slate-100"
              >
                <div className={cn('w-3 h-3 rounded-sm', color.bg)} />
                <span className="truncate max-w-[100px]">{stop.name}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-slate-100">
            <div className="w-3 h-3 rounded-sm border-2 border-dashed border-slate-300" />
            <span>Empty</span>
          </div>
        </div>
      )}

      {/* Capacity info */}
      <div className="text-center text-sm text-muted-foreground">
        {trolleys.length} / {layout.trolleySlots} slots filled
      </div>
    </div>
  );
}

