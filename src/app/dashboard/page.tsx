
'use client';

import * as React from 'react';
import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Users,
  ShoppingCart,
  Archive,
  PlusSquare,
  ArrowLeft,
  Filter,
  Search,
  TrendingDown,
  PieChart as PieIcon,
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
import { Input } from '@/components/ui/input';
import type { Batch } from '@/lib/types';

export default function DashboardOverviewPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    size: 'all',
    location: 'all',
  });

  useEffect(() => {
    const storedBatches = localStorage.getItem('batches');
    if (storedBatches) {
        setBatches(JSON.parse(storedBatches));
    } else {
        setBatches(INITIAL_BATCHES);
    }
  }, []);

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

  const calculateLosses = (batch: Batch) => {
    const lossLogRegex = /Logged (\d+) units as loss|Adjusted quantity by -(\d+)|Archived with loss of (\d+)/;
    const lostQuantity = batch.logHistory.reduce((sum, log) => {
      const match = log.action.match(lossLogRegex);
      if (match) {
        return sum + (parseInt(match[1], 10) || parseInt(match[2], 10) || parseInt(match[3], 10));
      }
      return sum;
    }, 0);
    return lostQuantity;
  }

  const filteredBatches = useMemo(() => {
    return batches
      .filter(
        (batch) =>
          `${batch.plantFamily} ${batch.plantVariety} ${batch.batchNumber}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
      )
      .filter(
        (batch) => filters.status === 'all' || batch.status === filters.status
      )
      .filter((batch) => filters.size === 'all' || batch.size === filters.size)
      .filter(
        (batch) =>
          filters.location === 'all' || batch.location === filters.location
      );
  }, [batches, filters, searchQuery]);

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

  const plantSizeData = useMemo(() => {
    const sizeCounts = filteredBatches.reduce((acc, batch) => {
        if (batch.status !== 'Archived') {
            acc[batch.size] = (acc[batch.size] || 0) + batch.quantity;
        }
        return acc;
    }, {} as Record<string, number>);
    return Object.entries(sizeCounts).map(([name, value]) => ({ name, value }));
  }, [filteredBatches]);

  const lossData = useMemo(() => {
    const lossByFamily = filteredBatches.reduce((acc, batch) => {
        const loss = calculateLosses(batch);
        if (loss > 0) {
            acc[batch.plantFamily] = (acc[batch.plantFamily] || 0) + loss;
        }
        return acc;
    }, {} as Record<string, number>);
    return Object.entries(lossByFamily).map(([name, value]) => ({ name, value }));
  }, [filteredBatches]);


  const chartConfig = {
    value: {
      label: 'Plants',
    },
    primary: {
      color: "hsl(var(--primary))",
    },
    destructive: {
      color: "hsl(var(--destructive))",
    }
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
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative md:col-span-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                placeholder="Search by family, variety, or batch #..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieIcon />
              Plant Family Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={chartConfig}
              className="min-h-[300px] w-full"
            >
              <Recharts.BarChart accessibilityLayer data={plantFamilyData}>
                <Recharts.XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <Recharts.YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Recharts.Bar dataKey="value" fill="var(--color-primary)" radius={8} />
              </Recharts.BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                <PieIcon />
                Plant Size Distribution
                </CardTitle>
            </CardHeader>
            <CardContent>
                <ChartContainer
                config={chartConfig}
                className="min-h-[300px] w-full"
                >
                  <Recharts.BarChart accessibilityLayer data={plantSizeData}>
                    <Recharts.XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <Recharts.YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Recharts.Bar dataKey="value" fill="var(--color-primary)" radius={8} />
                  </Recharts.BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
        <Card className="col-span-1 md:col-span-2">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                <TrendingDown />
                Losses by Plant Family
                </CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
                <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
                <Recharts.BarChart accessibilityLayer data={lossData}>
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
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
