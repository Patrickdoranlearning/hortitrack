
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
      className="min-h-[300px] w-full"
    >
      <Recharts.BarChart accessibilityLayer data={data}>
        <Recharts.XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <Recharts.YAxis />
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
    </ChartContainer>
  );
};

export default LossesChart;
