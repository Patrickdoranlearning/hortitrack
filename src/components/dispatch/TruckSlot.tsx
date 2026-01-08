'use client';

import { cn } from '@/lib/utils';
import { getStopColor } from './TruckVisualization';

export interface TrolleySlotData {
  id: string;
  trolleyNumber?: string;
  customerName?: string;
  orderNumber?: string;
  stopIndex?: number;
  slotIndex?: number;
  trolleyType?: string;
}

interface TruckSlotProps {
  width: number;
  height: number;
  trolley?: TrolleySlotData;
  slotIndex: number;
  isSelected?: boolean;
  colorIndex?: number;
}

export default function TruckSlot({
  width,
  height,
  trolley,
  slotIndex,
  isSelected,
  colorIndex,
}: TruckSlotProps) {
  const isEmpty = !trolley;
  const color = colorIndex !== undefined ? getStopColor(colorIndex) : null;

  // Get fill color based on state
  const getFillColor = () => {
    if (isEmpty) return '#f8fafc'; // slate-50
    if (color) {
      // Map Tailwind color names to hex
      const colorMap: Record<string, string> = {
        'bg-blue-500': '#3b82f6',
        'bg-green-500': '#22c55e',
        'bg-orange-500': '#f97316',
        'bg-purple-500': '#a855f7',
        'bg-pink-500': '#ec4899',
        'bg-cyan-500': '#06b6d4',
        'bg-amber-500': '#f59e0b',
        'bg-red-500': '#ef4444',
        'bg-indigo-500': '#6366f1',
        'bg-teal-500': '#14b8a6',
      };
      return colorMap[color.bg] || '#94a3b8';
    }
    return '#94a3b8'; // slate-400
  };

  const getStrokeColor = () => {
    if (isSelected) return '#1d4ed8'; // blue-700
    if (isEmpty) return '#cbd5e1'; // slate-300
    return '#64748b'; // slate-500
  };

  return (
    <g>
      {/* Slot background */}
      <rect
        width={width}
        height={height}
        rx={4}
        fill={getFillColor()}
        stroke={getStrokeColor()}
        strokeWidth={isSelected ? 3 : isEmpty ? 2 : 1}
        strokeDasharray={isEmpty ? '4 2' : undefined}
      />

      {/* Trolley content */}
      {trolley && (
        <>
          {/* Trolley number */}
          {trolley.trolleyNumber && (
            <text
              x={width / 2}
              y={height / 2 - 6}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={Math.min(width, height) * 0.2}
              fontWeight="bold"
            >
              {trolley.trolleyNumber}
            </text>
          )}

          {/* Order number */}
          {trolley.orderNumber && (
            <text
              x={width / 2}
              y={height / 2 + 8}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={Math.min(width, height) * 0.15}
              opacity={0.9}
            >
              #{trolley.orderNumber}
            </text>
          )}

          {/* Stop indicator */}
          {trolley.stopIndex !== undefined && (
            <circle
              cx={width - 8}
              cy={8}
              r={6}
              fill="white"
            />
          )}
          {trolley.stopIndex !== undefined && (
            <text
              x={width - 8}
              y={8}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={getFillColor()}
              fontSize={8}
              fontWeight="bold"
            >
              {trolley.stopIndex + 1}
            </text>
          )}
        </>
      )}

      {/* Empty slot number */}
      {isEmpty && (
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#94a3b8"
          fontSize={Math.min(width, height) * 0.25}
        >
          {slotIndex + 1}
        </text>
      )}

      {/* Selection indicator */}
      {isSelected && (
        <rect
          x={2}
          y={2}
          width={width - 4}
          height={height - 4}
          rx={3}
          fill="none"
          stroke="#1d4ed8"
          strokeWidth={2}
          opacity={0.5}
        />
      )}
    </g>
  );
}

