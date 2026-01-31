"use client";

import * as React from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StockMovementLog } from "@/components/history/StockMovementLog";
import type { StockMovement } from "@/lib/history-types";
import { Package, Loader2, Plus, Minus, Download, Trash2 } from "lucide-react";
import { fetchJson } from "@/lib/http";
import { StockAdjustmentDialog } from "@/components/batch/StockAdjustmentDialog";
import { RecordLossDialog } from "@/components/batch/RecordLossDialog";

interface StockLedgerCardProps {
  batchId: string;
  batchNumber?: string;
  currentQuantity?: number;
  onStockChange?: (newQuantity: number) => void;
}

const fetcher = async (url: string) => {
  const { data } = await fetchJson<{ movements: StockMovement[] }>(url);
  return data?.movements || [];
};

export function StockLedgerCard({
  batchId,
  batchNumber,
  currentQuantity = 0,
  onStockChange,
}: StockLedgerCardProps) {
  const [adjustDialogOpen, setAdjustDialogOpen] = React.useState(false);
  const [lossDialogOpen, setLossDialogOpen] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);

  const { data: movements = [], error, isLoading: loading, mutate } = useSWR(
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

  const handleStockChange = (newQuantity: number) => {
    mutate(); // Refresh the movements list
    onStockChange?.(newQuantity);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/production/batches/${batchId}/stock-movements/export`);
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stock-movements-${batchNumber || batchId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5 text-emerald-600" />
            Stock Ledger
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAdjustDialogOpen(true)}
              className="text-emerald-600 hover:text-emerald-700"
            >
              <Plus className="h-4 w-4 mr-1" />
              Adjust
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLossDialogOpen(true)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Loss
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting || movements.length === 0}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
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

      {/* Stock Adjustment Dialog */}
      <StockAdjustmentDialog
        open={adjustDialogOpen}
        onOpenChange={setAdjustDialogOpen}
        batchId={batchId}
        batchNumber={batchNumber}
        currentQuantity={currentQuantity}
        onSuccess={handleStockChange}
      />

      {/* Loss Recording Dialog */}
      <RecordLossDialog
        open={lossDialogOpen}
        onOpenChange={setLossDialogOpen}
        batchId={batchId}
        batchNumber={batchNumber}
        currentQuantity={currentQuantity}
        onSuccess={handleStockChange}
      />
    </Card>
  );
}
