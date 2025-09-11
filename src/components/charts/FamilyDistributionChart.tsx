
'use client';

import * as Recharts from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

interface FamilyDistributionChartProps {
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

const FamilyDistributionChart = ({ data }: FamilyDistributionChartProps) => {
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
          <ChartTooltip content={<ChartTooltipContent />} />
          <Recharts.Bar
            dataKey="value"
            fill="var(--color-primary)"
            radius={8}
          />
        </Recharts.BarChart>
      </Recharts.ResponsiveContainer>
    </ChartContainer>
  );
};

export default FamilyDistributionChart;
