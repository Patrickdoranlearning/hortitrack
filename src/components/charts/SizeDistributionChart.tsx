
'use client';

import {
  ResponsiveContainer,
  BarChart,
  XAxis,
  YAxis,
  Bar,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

interface SizeDistributionChartProps {
  data: { name: string; value: number }[];
}

const chartConfig = {
  value: {
    label: 'Plants',
  },
  primary: {
    color: 'hsl(var(--primary))',
  },
};

const SizeDistributionChart = ({ data }: SizeDistributionChartProps) => {
  return (
    <ChartContainer
      config={chartConfig}
      className="w-full h-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          accessibilityLayer 
          data={data}
          margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
        >
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 12 }}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar
            dataKey="value"
            fill="var(--color-primary)"
            radius={8}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

export default SizeDistributionChart;
