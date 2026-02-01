'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  type TooltipProps,
} from 'recharts';
import { type NameType, type ValueType } from 'recharts/types/component/DefaultTooltipContent';
import type { PieLabelRenderProps } from 'recharts';
import { ChartContainer } from '@/components/ui/chart';

interface AvailabilityDonutProps {
  available: number;
  reserved: number;
  growing: number;
  onSegmentClick?: (segment: 'available' | 'reserved' | 'growing') => void;
  activeSegments?: string[];
}

const SEGMENT_COLORS = {
  available: 'hsl(142, 76%, 36%)', // Green
  reserved: 'hsl(45, 93%, 47%)',   // Amber
  growing: 'hsl(221, 83%, 53%)',   // Blue
};

const chartConfig = {
  value: {
    label: 'Plants',
  },
};

export default function AvailabilityDonut({
  available,
  reserved,
  growing,
  onSegmentClick,
  activeSegments = [],
}: AvailabilityDonutProps) {
  const data = useMemo(() => [
    { name: 'Available', value: available, key: 'available' as const },
    { name: 'Reserved', value: reserved, key: 'reserved' as const },
    { name: 'Growing', value: growing, key: 'growing' as const },
  ].filter(d => d.value > 0), [available, reserved, growing]);

  const total = available + reserved + growing;

  const handleClick = (entry: typeof data[0]) => {
    if (onSegmentClick) {
      onSegmentClick(entry.key);
    }
  };

  const CustomTooltip = ({ active, payload }: TooltipProps<ValueType, NameType>) => {
    if (!active || !payload?.length) return null;

    const item = payload[0].payload as { name: string; value: number };
    const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;

    return (
      <div className="bg-popover border rounded-md shadow-md px-3 py-2 text-sm">
        <div className="font-medium">{item.name}</div>
        <div className="text-muted-foreground">
          {item.value.toLocaleString()} plants ({percentage}%)
        </div>
      </div>
    );
  };

  const renderCustomLabel = ({ cx, cy }: PieLabelRenderProps) => {
    return (
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-foreground"
      >
        <tspan x={cx} dy="-0.5em" className="text-2xl font-bold">
          {total.toLocaleString()}
        </tspan>
        <tspan x={cx} dy="1.5em" className="text-xs fill-muted-foreground">
          total plants
        </tspan>
      </text>
    );
  };

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            dataKey="value"
            labelLine={false}
            label={renderCustomLabel}
          >
            {data.map((entry, index) => {
              const isActive = activeSegments.length === 0 || activeSegments.includes(entry.key);
              
              return (
                <Cell
                  key={`cell-${index}`}
                  fill={SEGMENT_COLORS[entry.key]}
                  opacity={isActive ? 1 : 0.3}
                  onClick={() => handleClick(entry)}
                  style={{ cursor: 'pointer' }}
                />
              );
            })}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => {
              const item = data.find(d => d.name === value);
              return (
                <span className="text-sm">
                  {value}: {item?.value.toLocaleString()}
                </span>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

