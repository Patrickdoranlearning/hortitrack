'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  XAxis,
  YAxis,
  Area,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import { format, parseISO, subDays, eachDayOfInterval } from 'date-fns';

interface LossTrendChartProps {
  data: { date: string; quantity: number; reason: string }[];
  days?: number;
}

const REASON_COLORS: Record<string, string> = {
  'BOTRYTIS': 'hsl(0, 84%, 60%)',
  'VINE_WEEVIL': 'hsl(30, 90%, 55%)',
  'FROST': 'hsl(200, 80%, 60%)',
  'OVERGROWN': 'hsl(45, 93%, 47%)',
  'Unknown': 'hsl(var(--muted-foreground))',
};

const chartConfig = {
  loss: {
    label: 'Loss',
  },
};

export default function LossTrendChart({ data, days = 30 }: LossTrendChartProps) {
  // Aggregate data by date and fill missing dates
  const chartData = useMemo(() => {
    const now = new Date();
    const startDate = subDays(now, days);
    const dateRange = eachDayOfInterval({ start: startDate, end: now });

    // Aggregate by date
    const dateMap = new Map<string, number>();
    
    for (const item of data) {
      const dateKey = item.date;
      dateMap.set(dateKey, (dateMap.get(dateKey) ?? 0) + item.quantity);
    }

    // Create continuous data with all dates
    return dateRange.map(date => {
      const dateKey = format(date, 'yyyy-MM-dd');
      return {
        date: dateKey,
        displayDate: format(date, 'MMM d'),
        loss: dateMap.get(dateKey) ?? 0,
      };
    });
  }, [data, days]);

  // Calculate total and average
  const stats = useMemo(() => {
    const total = chartData.reduce((sum, d) => sum + d.loss, 0);
    const daysWithLoss = chartData.filter(d => d.loss > 0).length;
    const avg = daysWithLoss > 0 ? Math.round(total / daysWithLoss) : 0;
    return { total, avg, daysWithLoss };
  }, [chartData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    
    const value = payload[0].value;
    
    return (
      <div className="bg-popover border rounded-md shadow-md px-3 py-2 text-sm">
        <div className="text-muted-foreground text-xs">{label}</div>
        <div className="font-medium">
          {value > 0 ? `${value.toLocaleString()} plants lost` : 'No losses'}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-4 mb-2 text-sm">
        <div>
          <span className="text-muted-foreground">Total: </span>
          <span className="font-medium">{stats.total.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Avg/day: </span>
          <span className="font-medium">{stats.avg.toLocaleString()}</span>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ChartContainer config={chartConfig} className="w-full h-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <defs>
                <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="displayDate" 
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
                tickMargin={8}
              />
              <YAxis 
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="loss"
                stroke="hsl(0, 84%, 60%)"
                strokeWidth={2}
                fill="url(#lossGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
    </div>
  );
}

