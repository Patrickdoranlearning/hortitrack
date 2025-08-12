
'use client';

import * as Recharts from 'recharts';
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
        <ChartTooltip content={<ChartTooltipContent />} />
        <Recharts.Bar
          dataKey="value"
          fill="var(--color-primary)"
          radius={8}
        />
      </Recharts.BarChart>
    </ChartContainer>
  );
};

export default SizeDistributionChart;
