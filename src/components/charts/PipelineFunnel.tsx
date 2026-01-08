'use client';

import {
  ResponsiveContainer,
  BarChart,
  XAxis,
  YAxis,
  Bar,
  Cell,
  LabelList,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

interface PipelineFunnelProps {
  data: { status: string; behavior: string; count: number; quantity: number }[];
  onSegmentClick?: (status: string) => void;
  activeStatuses?: string[];
}

const STATUS_COLORS: Record<string, string> = {
  'Propagation': 'hsl(142, 76%, 36%)', // Green
  'Plugs/Liners': 'hsl(142, 60%, 45%)', // Light green
  'Potted': 'hsl(45, 93%, 47%)', // Amber
  'Growing': 'hsl(45, 80%, 55%)', // Light amber
  'Ready for Sale': 'hsl(221, 83%, 53%)', // Blue
  'Ready': 'hsl(221, 83%, 53%)', // Blue
  'Looking Good': 'hsl(262, 83%, 58%)', // Purple
};

const chartConfig = {
  quantity: {
    label: 'Plants',
  },
};

export default function PipelineFunnel({ 
  data, 
  onSegmentClick,
  activeStatuses = [],
}: PipelineFunnelProps) {
  // Sort by pipeline order and filter out archived/sold
  const pipelineOrder = ['Propagation', 'Plugs/Liners', 'Potted', 'Growing', 'Ready for Sale', 'Ready', 'Looking Good'];
  
  const sortedData = [...data]
    .filter(d => d.behavior !== 'archived' && d.behavior !== 'sold')
    .sort((a, b) => {
      const aIndex = pipelineOrder.indexOf(a.status);
      const bIndex = pipelineOrder.indexOf(b.status);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });

  const handleClick = (entry: typeof sortedData[0]) => {
    if (onSegmentClick) {
      onSegmentClick(entry.status);
    }
  };

  return (
    <ChartContainer config={chartConfig} className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          accessibilityLayer
          data={sortedData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
        >
          <XAxis type="number" hide />
          <YAxis 
            type="category" 
            dataKey="status" 
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
            width={75}
          />
          <ChartTooltip 
            content={
              <ChartTooltipContent
                formatter={(value, name, props) => {
                  const item = props.payload;
                  return (
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{item.status}</span>
                      <span>{Number(value).toLocaleString()} plants</span>
                      <span className="text-muted-foreground text-xs">
                        {item.count} batch{item.count !== 1 ? 'es' : ''}
                      </span>
                    </div>
                  );
                }}
              />
            }
          />
          <Bar 
            dataKey="quantity" 
            radius={[0, 4, 4, 0]}
            className="cursor-pointer"
          >
            {sortedData.map((entry, index) => {
              const isActive = activeStatuses.length === 0 || activeStatuses.includes(entry.status);
              const baseColor = STATUS_COLORS[entry.status] ?? 'hsl(var(--primary))';
              
              return (
                <Cell 
                  key={`cell-${index}`}
                  fill={baseColor}
                  opacity={isActive ? 1 : 0.3}
                  onClick={() => handleClick(entry)}
                  style={{ cursor: 'pointer' }}
                />
              );
            })}
            <LabelList
              dataKey="quantity"
              position="right"
              formatter={(value: number) => value.toLocaleString()}
              className="fill-foreground text-xs"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

