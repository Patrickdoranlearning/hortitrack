'use client';

import { useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TopProduct {
  productId: string;
  productName: string;
  varietyName: string;
  sizeName: string;
  quantitySold: number;
  revenue: number;
}

interface TopProductsChartProps {
  data: TopProduct[];
}

type SortBy = 'quantity' | 'revenue';

const chartConfigQuantity = {
  quantitySold: {
    label: 'Quantity Sold',
    color: 'hsl(var(--chart-3))',
  },
};

const chartConfigRevenue = {
  revenue: {
    label: 'Revenue',
    color: 'hsl(var(--chart-4))',
  },
};

const TopProductsChart = ({ data }: TopProductsChartProps) => {
  const [sortBy, setSortBy] = useState<SortBy>('quantity');

  const sortedData = [...data].sort((a, b) => {
    if (sortBy === 'quantity') {
      return b.quantitySold - a.quantitySold;
    }
    return b.revenue - a.revenue;
  });

  const chartData = sortedData.map((p) => ({
    name: p.productName.length > 20 ? p.productName.slice(0, 20) + '...' : p.productName,
    fullName: p.productName,
    quantitySold: p.quantitySold,
    revenue: p.revenue,
  }));

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 mb-3">
        <Button
          variant={sortBy === 'quantity' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSortBy('quantity')}
          className="text-xs h-7"
        >
          By Quantity
        </Button>
        <Button
          variant={sortBy === 'revenue' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSortBy('revenue')}
          className="text-xs h-7"
        >
          By Revenue
        </Button>
      </div>
      <div className="flex-1 min-h-0">
        <ChartContainer
          config={sortBy === 'quantity' ? chartConfigQuantity : chartConfigRevenue}
          className="w-full h-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              accessibilityLayer
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <XAxis
                type="number"
                tick={{ fontSize: 10 }}
                tickFormatter={(value) =>
                  sortBy === 'revenue'
                    ? `€${(value / 1000).toFixed(0)}k`
                    : value.toLocaleString()
                }
              />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fontSize: 10 }}
                width={100}
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name, props) => {
                      const item = props.payload;
                      if (sortBy === 'quantity') {
                        return [
                          <div key="content" className="text-xs">
                            <div className="font-medium">{item.fullName}</div>
                            <div>{Number(value).toLocaleString()} units</div>
                            <div className="text-muted-foreground">€{item.revenue.toLocaleString()} revenue</div>
                          </div>,
                          '',
                        ];
                      }
                      return [
                        <div key="content" className="text-xs">
                          <div className="font-medium">{item.fullName}</div>
                          <div>€{Number(value).toLocaleString()}</div>
                          <div className="text-muted-foreground">{item.quantitySold.toLocaleString()} units</div>
                        </div>,
                        '',
                      ];
                    }}
                  />
                }
              />
              <Bar
                dataKey={sortBy === 'quantity' ? 'quantitySold' : 'revenue'}
                fill={sortBy === 'quantity' ? 'var(--color-quantitySold)' : 'var(--color-revenue)'}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
    </div>
  );
};

export default TopProductsChart;
