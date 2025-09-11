
'use client';

import * as Recharts from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

interface LossesChartProps {
  data: { name: string; value: number }[];
}

const chartConfig = {
  value: {
    label: 'Plants',
  },
  destructive: {
    color: 'hsl(var(--destructive))',
  },
};

const LossesChart = ({ data }: LossesChartProps) => {
  return (
    <ChartContainer
      config={chartConfig}
      className="w-full h-full"
    >
      <Recharts.ResponsiveContainer width="100%" height="100%">
        <Recharts.BarChart 
          accessibilityLayer 
          data={data}
          margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
        >
          <Recharts.XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 12 }}
          />
          <Recharts.YAxis tick={{ fontSize: 12 }} />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <Recharts.Bar
            dataKey="value"
            fill="var(--color-destructive)"
            radius={8}
          />
        </Recharts.BarChart>
      </Recharts.ResponsiveContainer>
    </ChartContainer>
  );
};

export default LossesChart;
