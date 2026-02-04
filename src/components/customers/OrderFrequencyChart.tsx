'use client';

import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

interface OrderFrequencyChartProps {
  ordersByMonth: Array<{ month: string; count: number }>;
  ordersLast12Months: number;
  averageDaysBetweenOrders: number | null;
}

export function OrderFrequencyChart({
  ordersByMonth,
  ordersLast12Months,
  averageDaysBetweenOrders,
}: OrderFrequencyChartProps) {
  const hasData = ordersByMonth.some((m) => m.count > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Order Frequency
        </CardTitle>
        <CardDescription className="flex items-center gap-4">
          <span>{ordersLast12Months} orders (12mo)</span>
          {averageDaysBetweenOrders !== null && (
            <span>Avg {averageDaysBetweenOrders} days between orders</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-[80px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No orders in the last 12 months</p>
          </div>
        ) : (
          <div className="h-[80px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ordersByMonth} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  interval={1}
                />
                <Tooltip
                  formatter={(value: number) => [`${value} order${value !== 1 ? 's' : ''}`, '']}
                  labelFormatter={(label) => label}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="hsl(var(--primary))"
                  radius={[2, 2, 0, 0]}
                  maxBarSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default OrderFrequencyChart;
