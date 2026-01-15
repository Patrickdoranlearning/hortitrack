"use client";

import * as React from "react";
import useSWR from "swr";
import { InteractiveDistributionBar } from "@/components/InteractiveDistributionBar";
import type { SimpleDistribution, DetailedDistribution } from "@/lib/history-types";
import { Loader2 } from "lucide-react";

interface InteractiveDistributionBarServerProps {
  batchId: string;
}

const fetcher = async (url: string): Promise<SimpleDistribution | null> => {
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return {
    available: data.available,
    allocatedPotting: data.allocatedPotting?.total ?? 0,
    allocatedSales: data.allocatedSales?.total ?? 0,
    sold: data.sold?.total ?? 0,
    dumped: data.dumped?.total ?? 0,
    transplanted: data.transplanted?.total ?? 0,
    totalAccounted: data.totalAccounted
  };
};

export function InteractiveDistributionBarServer({ batchId }: InteractiveDistributionBarServerProps) {
  const { data: distribution, isLoading: loading } = useSWR(
    batchId ? `/api/production/batches/${batchId}/distribution` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const fetchDetailedDistribution = React.useCallback(async (id: string): Promise<DetailedDistribution> => {
    const res = await fetch(`/api/production/batches/${id}/distribution`);
    if (!res.ok) throw new Error('Failed to fetch distribution');
    return res.json();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading...
      </div>
    );
  }

  if (!distribution) {
    return (
      <div className="text-sm text-muted-foreground">
        Unable to load distribution
      </div>
    );
  }

  return (
    <InteractiveDistributionBar
      distribution={distribution}
      batchId={batchId}
      onFetchDetails={fetchDetailedDistribution}
    />
  );
}
