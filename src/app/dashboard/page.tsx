
'use client';

import * as React from 'react';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  BarChart,
  PieChart as RechartsPieChart,
  Users,
  ShoppingCart,
  Archive,
  PlusSquare,
  ArrowLeft,
  Filter,
} from 'lucide-react';
import { INITIAL_BATCHES } from '@/lib/data';
import * as Recharts from 'recharts';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function DashboardOverviewPage() {
  const [batches] = useState(INITIAL_BATCHES);
  const [filters, setFilters] = useState({
    status: 'all',
    size: 'all',
    location: 'all',
  });

  const statuses = useMemo(
    () => ['all', ...Array.from(new Set(batches.map((b) => b.status)))],
    [batches]
  );
  const sizes = useMemo(
    () => ['all', ...Array.from(new Set(batches.map((b) => b.size)))],
    [batches]
  );
  const locations = useMemo(
    () => ['all', ...Array.from(new Set(batches.map((b) => b.location)))],
    [batches]
  );

  const filteredBatches = useMemo(() => {
    return batches
      .filter(
        (batch) => filters.status === 'all' || batch.status === filters.status
      )
      .filter((batch) => filters.size === 'all' || batch.size === filters.size)
      .filter(
        (batch) =>
          filters.location === 'all' || batch.location === filters.location
      );
  }, [batches, filters]);

  const totalPlantsInStock = useMemo(() => {
    return filteredBatches
      .filter((b) => b.status !== 'Archived')
      .reduce((sum, b) => sum + b.quantity, 0);
  }, [filteredBatches]);

  const activeBatchesCount = useMemo(() => {
    return filteredBatches.filter((b) => b.status !== 'Archived').length;
  }, [filteredBatches]);

  const readyForSaleBatches = useMemo(() => {
    return filteredBatches.filter((b) => b.status === 'Ready for Sale');
  }, [filteredBatches]);

  const readyForSaleCount = readyForSaleBatches.length;

  const batchStatusData = useMemo(() => {
    const statusCounts = filteredBatches.reduce((acc, batch) => {
      if (batch.status !== 'Archived') {
        acc[batch.status] = (acc[batch.status] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(statusCounts).map(([name, value]) => ({
      name,
      value,
    }));
  }, [filteredBatches]);

  const plantFamilyData = useMemo(() => {
    const familyCounts = filteredBatches.reduce((acc, batch) => {
      if (batch.status !== 'Archived') {
        acc[batch.plantFamily] =
          (acc[batch.plantFamily] || 0) + batch.quantity;
      }
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(familyCounts).map(([name, value]) => ({
      name,
      value,
    }));
  }, [filteredBatches]);

  const chartConfig = {
    value: {
      label: 'Plants',
    },
    ...plantFamilyData.reduce((acc, { name }) => {
      // Create a deterministic but varied color for each family
      const hash = name
        .split('')
        .reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
      const hue = hash % 360;
      acc[name] = { label: name, color: `hsl(${hue}, 70%, 50%)` };
      return acc;
    }, {} as any),
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-4xl font-headline tracking-tight">Dashboard</h1>
        <div className="flex items-center space-x-2">
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft />
              Back to Nursery Stock
            </Link>
          </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4">
          <Select
            value={filters.status}
            onValueChange={(value) => setFilters({ ...filters, status: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status === 'all' ? 'All Statuses' : status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.size}
            onValueChange={(value) => setFilters({ ...filters, size: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by size" />
            </SelectTrigger>
            <SelectContent>
              {sizes.map((size) => (
                <SelectItem key={size} value={size}>
                  {size === 'all' ? 'All Sizes' : size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.location}
            onValueChange={(value) =>
              setFilters({ ...filters, location: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((location) => (
                <SelectItem key={location} value={location}>
                  {location === 'all' ? 'All Locations' : location}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Plants in Stock
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalPlantsInStock.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all active batches
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Batches
            </CardTitle>
            <PlusSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeBatchesCount}</div>
            <p className="text-xs text-muted-foreground">
              Currently in production
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Batches Ready for Sale
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{readyForSaleCount}</div>
            <p className="text-xs text-muted-foreground">
              {readyForSaleBatches
                .reduce((sum, b) => sum + b.quantity, 0)
                .toLocaleString()}{' '}
              total plants
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Archived Batches
            </CardTitle>
            <Archive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {
                batches.filter(
                  (b) =>
                    b.status === 'Archived' &&
                    (filters.size === 'all' || b.size === filters.size) &&
                    (filters.location === 'all' ||
                      b.location === filters.location)
                ).length
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Completed or zeroed out batches
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart />
              Batch Status Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
              <Recharts.BarChart accessibilityLayer data={batchStatusData}>
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
                  fill="var(--color-primary)"
                  radius={8}
                />
              </Recharts.BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RechartsPieChart />
              Plant Family Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={chartConfig}
              className="min-h-[300px] w-full"
            >
              <Recharts.PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                <Recharts.Pie
                  data={plantFamilyData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  labelLine={false}
                >
                  {plantFamilyData.map((entry, index) => (
                    <Recharts.Cell
                      key={`cell-${index}`}
                      fill={chartConfig[entry.name]?.color || '#ccc'}
                    />
                  ))}
                </Recharts.Pie>
              </Recharts.PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
