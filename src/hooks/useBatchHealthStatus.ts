"use client";

import useSWR from "swr";
import type { HealthStatusLevel } from "@/components/batch/HealthIndicator";

export type BatchHealthStatus = {
  batchId: string;
  level: HealthStatusLevel;
  lastEventAt: string | null;
  lastEventType: string | null;
  lastEventSeverity: string | null;
  activeIssuesCount: number;
  hasUnresolvedScouts: boolean;
};

const fetcher = async (url: string): Promise<Record<string, BatchHealthStatus>> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch health statuses");
  }
  const data = await response.json();
  return data.statuses || {};
};

/**
 * Hook to fetch health statuses for multiple batches
 */
export function useBatchHealthStatuses(batchIds: string[]) {
  const key = batchIds.length > 0
    ? `/api/production/batches/health-status?batchIds=${batchIds.join(",")}`
    : null;

  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000, // Cache for 1 minute
  });

  return {
    statuses: data || {},
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Hook to get health status for a single batch
 */
export function useBatchHealthStatus(batchId: string | undefined) {
  const { statuses, isLoading, error, refresh } = useBatchHealthStatuses(
    batchId ? [batchId] : []
  );

  const status = batchId ? statuses[batchId] : undefined;

  return {
    status,
    isLoading,
    error,
    refresh,
  };
}
