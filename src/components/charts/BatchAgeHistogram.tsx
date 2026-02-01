'use client';

import {
  ResponsiveContainer,
  BarChart,
  XAxis,
  YAxis,
  Bar,
  Cell,
  Tooltip,
  type TooltipProps,
} from 'recharts';
import { type NameType, type ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { ChartContainer } from '@/components/ui/chart';

interface BatchAgeHistogramProps {
  data: { weekNumber: number; label: string; quantity: number }[];
  onBarClick?: (weekNumber: number) => void;
  activeWeeks?: number[];
}

const chartConfig = {
  quantity: {
    label: 'Plants',
  },
};

export default function BatchAgeHistogram({
  data,
  onBarClick,
  activeWeeks = [],
}: BatchAgeHistogramProps) {
  const handleClick = (entry: typeof data[0]) => {
    if (onBarClick) {
      onBarClick(entry.weekNumber);
    }
  };

  // Color gradient from light to dark green based on age
  const getColor = (weekNumber: number) => {
    const hue = 142;
    const saturation = 76;
    const lightness = Math.max(25, 50 - weekNumber * 2);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  const CustomTooltip = ({ active, payload }: TooltipProps<ValueType, NameType>) => {
    if (!active || !payload?.length) return null;

    const item = payload[0].payload as { weekNumber: number; quantity: number };

    return (
      <div className="bg-popover border rounded-md shadow-md px-3 py-2 text-sm">
        <div className="font-medium">
          {item.weekNumber === 12 ? '12+ weeks old' : `${item.weekNumber} week${item.weekNumber !== 1 ? 's' : ''} old`}
        </div>
        <div className="text-muted-foreground">
          {item.quantity.toLocaleString()} plants
        </div>
      </div>
    );
  };

  return (
    <ChartContainer config={chartConfig} className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 5, right: 10, left: 0, bottom: 20 }}
        >
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            label={{ 
              value: 'Weeks since planting', 
              position: 'insideBottom', 
              offset: -15,
              fontSize: 11,
              fill: 'hsl(var(--muted-foreground))',
            }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            width={50}
            tickFormatter={(value) => value.toLocaleString()}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="quantity"
            radius={[4, 4, 0, 0]}
            className="cursor-pointer"
          >
            {data.map((entry, index) => {
              const isActive = activeWeeks.length === 0 || activeWeeks.includes(entry.weekNumber);
              
              return (
                <Cell
                  key={`cell-${index}`}
                  fill={getColor(entry.weekNumber)}
                  opacity={isActive ? 1 : 0.3}
                  onClick={() => handleClick(entry)}
                  style={{ cursor: 'pointer' }}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

