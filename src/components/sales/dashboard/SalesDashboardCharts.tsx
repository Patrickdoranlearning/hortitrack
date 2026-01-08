'use client';

import { useEffect, useState } from 'react';
import nextDynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Package, BarChart3 } from 'lucide-react';

const WeeklySalesChart = nextDynamic(
  () => import('@/components/charts/WeeklySalesChart'),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> }
);

const WeeklyTrolleysChart = nextDynamic(
  () => import('@/components/charts/WeeklyTrolleysChart'),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> }
);

const TopProductsChart = nextDynamic(
  () => import('@/components/charts/TopProductsChart'),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> }
);

interface WeeklyDataPoint {
  week: number;
  weekStart: string;
  currentYear: number;
  previousYear: number;
}

interface TopProduct {
  productId: string;
  productName: string;
  varietyName: string;
  sizeName: string;
  quantitySold: number;
  revenue: number;
}

interface ChartData {
  weeklySales: WeeklyDataPoint[];
  weeklyTrolleys: WeeklyDataPoint[];
  topProducts: TopProduct[];
}

interface SalesDashboardChartsProps {
  initialData?: ChartData;
}

export function SalesDashboardCharts({ initialData }: SalesDashboardChartsProps) {
  const [data, setData] = useState<ChartData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) return;

    const fetchData = async () => {
      try {
        const res = await fetch('/api/sales/dashboard');
        const json = await res.json();
        if (!json.ok) {
          throw new Error(json.error || 'Failed to fetch dashboard data');
        }
        setData({
          weeklySales: json.weeklySales,
          weeklyTrolleys: json.weeklyTrolleys,
          topProducts: json.topProducts,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [initialData]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[250px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[250px] w-full" />
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load charts: {error}
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="min-w-0">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Weekly Sales
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Last 12 weeks vs same period last year
          </p>
        </CardHeader>
        <CardContent className="min-w-0">
          <div className="w-full h-[220px] sm:h-[260px]">
            <WeeklySalesChart data={data.weeklySales} />
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            Weekly Trolleys Shipped
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Last 12 weeks vs same period last year
          </p>
        </CardHeader>
        <CardContent className="min-w-0">
          <div className="w-full h-[220px] sm:h-[260px]">
            <WeeklyTrolleysChart data={data.weeklyTrolleys} />
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 md:col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            Top Products YTD
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Best selling products this year
          </p>
        </CardHeader>
        <CardContent className="min-w-0">
          <div className="w-full h-[300px] sm:h-[350px]">
            <TopProductsChart data={data.topProducts} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
