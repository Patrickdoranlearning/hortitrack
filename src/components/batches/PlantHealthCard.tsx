"use client";

import * as React from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlantHealthLog } from "@/components/history/PlantHealthLog";
import type { PlantHealthEvent } from "@/lib/history-types";
import { Heart, Loader2, Bug, Ruler, CheckCircle } from "lucide-react";
import { fetchJson } from "@/lib/http";

interface PlantHealthCardProps {
  batchId: string;
}

const fetcher = async (url: string) => {
  const { data } = await fetchJson<{ logs: PlantHealthEvent[] }>(url);
  return data?.logs || [];
};

export function PlantHealthCard({ batchId }: PlantHealthCardProps) {
  const { data: logs = [], error, isLoading: loading } = useSWR(
    batchId ? `/api/production/batches/${batchId}/plant-health` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Calculate summary
  const summary = React.useMemo(() => {
    if (logs.length === 0) return null;

    return {
      treatments: logs.filter(l => l.type === 'treatment').length,
      scouts: logs.filter(l => l.type === 'scout_flag').length,
      measurements: logs.filter(l => l.type === 'measurement').length,
      clearances: logs.filter(l => l.type === 'clearance').length
    };
  }, [logs]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Heart className="h-5 w-5 text-rose-500" />
          Plant Health
        </CardTitle>
        {summary && (
          <div className="flex gap-3 text-xs text-muted-foreground">
            {summary.treatments > 0 && (
              <span className="flex items-center gap-1">
                <Bug className="h-3 w-3 text-rose-500" />
                {summary.treatments} treatment{summary.treatments > 1 ? 's' : ''}
              </span>
            )}
            {summary.scouts > 0 && (
              <span className="flex items-center gap-1">
                <Bug className="h-3 w-3 text-orange-500" />
                {summary.scouts} scout{summary.scouts > 1 ? 's' : ''}
              </span>
            )}
            {summary.measurements > 0 && (
              <span className="flex items-center gap-1">
                <Ruler className="h-3 w-3 text-sky-500" />
                {summary.measurements}
              </span>
            )}
            {summary.clearances > 0 && (
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-emerald-500" />
                {summary.clearances}
              </span>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading health logs...
          </div>
        )}
        {error && (
          <div className="text-sm text-red-600 py-4">{error}</div>
        )}
        {!loading && !error && logs.length === 0 && (
          <div className="text-muted-foreground py-4 text-center">
            No plant health logs recorded yet.
          </div>
        )}
        {!loading && logs.length > 0 && (
          <div className="max-h-[400px] overflow-y-auto">
            <PlantHealthLog logs={logs} compact />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
