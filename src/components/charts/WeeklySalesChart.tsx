'use client';

import {
  ResponsiveContainer,
  BarChart,
  XAxis,
  YAxis,
  Bar,
  Legend,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { formatCurrency, currencySymbol } from '@/lib/format-currency';

interface WeeklySalesChartProps {
  data: Array<{
    week: number;
    weekStart: string;
    currentYear: number;
    previousYear: number;
  }>;
}

const chartConfig = {
  currentYear: {
    label: 'This Year',
    color: 'hsl(var(--primary))',
  },
  previousYear: {
    label: 'Last Year',
    color: 'hsl(var(--muted-foreground))',
  },
};

const WeeklySalesChart = ({ data }: WeeklySalesChartProps) => {
  return (
    <ChartContainer config={chartConfig} className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          accessibilityLayer
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
        >
          <XAxis
            dataKey="weekStart"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(value) => `${currencySymbol()}${(value / 1000).toFixed(0)}k`}
            width={50}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => {
                  const label = name === 'currentYear' ? 'This Year' : 'Last Year';
                  return [formatCurrency(Number(value)), label];
                }}
              />
            }
          />
          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value) => (value === 'currentYear' ? 'This Year' : 'Last Year')}
          />
          <Bar
            dataKey="currentYear"
            fill="var(--color-currentYear)"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="previousYear"
            fill="var(--color-previousYear)"
            radius={[4, 4, 0, 0]}
            opacity={0.5}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

export default WeeklySalesChart;
