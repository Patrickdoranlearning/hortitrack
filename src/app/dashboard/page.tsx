
'use client';

import * as React from 'react';
import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  ShoppingCart,
  Archive,
  ArrowLeft,
  Filter,
  Search,
  TrendingDown,
  PieChart as PieIcon,
  Package,
} from 'lucide-react';
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
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';

const FamilyDistributionChart = dynamic(
  () => import('@/components/charts/FamilyDistributionChart'),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full" /> }
);

const SizeDistributionChart = dynamic(
  () => import('@/components/charts/SizeDistributionChart'),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full" /> }
);

const LossesChart = dynamic(
  () => import('@/components/charts/LossesChart'),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full" /> }
);


export default function DashboardOverviewPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    size: 'all',
    location: 'all',
  });

  useEffect(() => {
    const q = query(collection(db, 'batches'), orderBy('batchNumber'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const batchesData = snapshot.docs.map(
          (doc) => ({ ...doc.data(), id: doc.id }) as Batch
        );
        setBatches(batchesData);
        setIsLoading(false);
      },
      (error) => {
        console.error('Failed to subscribe to batch updates:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
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
    return batch.logHistory.reduce((sum, log) => {
      if (log.type === 'LOSS' && typeof log.qty === 'number') {
        return sum + log.qty;
      }
      if (log.type === 'ADJUST' && typeof log.qty === 'number' && log.qty < 0) {
        return sum - log.qty; // qty is negative, so subtract to make it a positive loss
      }
      return sum;
    }, 0);
  };

  const filteredBatches = useMemo(() => {
    return batches
      .filter((batch) =>
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
    const familyCounts = filteredBatches.reduce(
      (acc, batch) => {
        if (batch.status !== 'Archived') {
          acc[batch.plantFamily] =
            (acc[batch.plantFamily] || 0) + batch.quantity;
        }
        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(familyCounts).map(([name, value]) => ({
      name,
      value,
    }));
  }, [filteredBatches]);

  const plantSizeData = useMemo(() => {
    const sizeCounts = filteredBatches.reduce(
      (acc, batch) => {
        if (batch.status !== 'Archived') {
          acc[batch.size] = (acc[batch.size] || 0) + batch.quantity;
        }
        return acc;
      },
      {} as Record<string, number>
    );
    return Object.entries(sizeCounts).map(([name, value]) => ({
      name,
      value,
    }));
  }, [filteredBatches]);

  const lossData = useMemo(() => {
    const lossByFamily = filteredBatches.reduce(
      (acc, batch) => {
        const loss = calculateLosses(batch);
        if (loss > 0) {
          acc[batch.plantFamily] = (acc[batch.plantFamily] || 0) + loss;
        }
        return acc;
      },
      {} as Record<string, number>
    );
    return Object.entries(lossByFamily).map(([name, value]) => ({
      name,
      value,
    }));
  }, [filteredBatches]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full flex-col p-6">
          <div className="flex items-center justify-between space-y-2">
            <h1 className="text-4xl font-headline tracking-tight">Dashboard</h1>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 mt-6">
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
      </div>
    );
  }

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
            <Package className="h-4 w-4 text-muted-foreground" />
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
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieIcon />
              Plant Family Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            <div className="w-full h-[220px] sm:h-[260px] lg:h-[320px]">
              <FamilyDistributionChart data={plantFamilyData} />
            </div>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieIcon />
              Plant Size Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
             <div className="w-full h-[220px] sm:h-[260px] lg:h-[320px]">
              <SizeDistributionChart data={plantSizeData} />
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1 md:col-span-2 min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown />
              Losses by Plant Family
            </CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 pl-2">
            <div className="w-full h-[220px] sm:h-[260px] lg:h-[320px]">
              <LossesChart data={lossData} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
