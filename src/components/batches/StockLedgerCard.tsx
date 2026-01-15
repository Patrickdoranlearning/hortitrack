"use client";

import * as React from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StockMovementLog } from "@/components/history/StockMovementLog";
import type { StockMovement } from "@/lib/history-types";
import { Package, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/http";

interface StockLedgerCardProps {
  batchId: string;
}

const fetcher = async (url: string) => {
  const { data } = await fetchJson<{ movements: StockMovement[] }>(url);
  return data?.movements || [];
};

export function StockLedgerCard({ batchId }: StockLedgerCardProps) {
  const { data: movements = [], error, isLoading: loading } = useSWR(
    batchId ? `/api/production/batches/${batchId}/stock-movements` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Calculate summary
  const summary = React.useMemo(() => {
    if (movements.length === 0) return null;

    const totalIn = movements.filter(m => m.quantity > 0).reduce((sum, m) => sum + m.quantity, 0);
    const totalOut = Math.abs(movements.filter(m => m.quantity < 0).reduce((sum, m) => sum + m.quantity, 0));
    const currentBalance = movements[movements.length - 1]?.runningBalance ?? 0;

    return { totalIn, totalOut, currentBalance };
  }, [movements]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="h-5 w-5 text-emerald-600" />
          Stock Ledger
        </CardTitle>
        {summary && (
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>In: <span className="font-semibold text-emerald-600">+{summary.totalIn.toLocaleString()}</span></span>
            <span>Out: <span className="font-semibold text-rose-600">-{summary.totalOut.toLocaleString()}</span></span>
            <span>Balance: <span className="font-semibold text-foreground">{summary.currentBalance.toLocaleString()}</span></span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading stock ledger...
          </div>
        )}
        {error && (
          <div className="text-sm text-red-600 py-4">{error}</div>
        )}
        {!loading && !error && movements.length === 0 && (
          <div className="text-muted-foreground py-4 text-center">
            No stock movements recorded yet.
          </div>
        )}
        {!loading && movements.length > 0 && (
          <div className="max-h-[400px] overflow-y-auto">
            <StockMovementLog movements={movements} compact />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
