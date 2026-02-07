"use client";

import { useState, useEffect, useCallback } from "react";
import { Package, Check, AlertCircle, Loader2, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { vibrateTap } from "@/lib/haptics";

type ChecklistItem = {
  materialId: string;
  materialName: string;
  partNumber: string;
  baseUom: string;
  quantityPlanned: number;
  quantityConsumed: number;
  status: "pending" | "confirmed" | "partial";
};

type ConsumedItem = {
  materialId: string;
  materialName: string;
  partNumber: string;
  lotNumber: string;
  quantityConsumed: number;
  uom: string;
  consumedAt: string;
  consumedBy: string | null;
};

type MaterialsResponse = {
  planned: unknown[];
  consumed: ConsumedItem[];
  checklist: ChecklistItem[];
};

interface BatchMaterialsViewProps {
  batchId: string;
  onConfirmMaterial?: (item: ChecklistItem) => void;
}

export function BatchMaterialsView({ batchId, onConfirmMaterial }: BatchMaterialsViewProps) {
  const [data, setData] = useState<MaterialsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMaterials = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/worker/batches/${batchId}/materials`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load materials");
      }
      const json: MaterialsResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load materials");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-sm text-muted-foreground mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchMaterials}>
          Try Again
        </Button>
      </div>
    );
  }

  if (!data || data.checklist.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Package className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          No materials planned for this batch.
        </p>
      </div>
    );
  }

  const confirmedCount = data.checklist.filter((c) => c.status === "confirmed").length;
  const totalCount = data.checklist.length;

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-medium">Materials Checklist</h3>
        <Badge
          variant={confirmedCount === totalCount ? "default" : "secondary"}
          className="text-xs"
        >
          {confirmedCount}/{totalCount} confirmed
        </Badge>
      </div>

      {/* Checklist Items */}
      {data.checklist.map((item) => {
        const consumedLots = data.consumed.filter(
          (c) => c.materialId === item.materialId
        );

        return (
          <MaterialChecklistCard
            key={item.materialId}
            item={item}
            consumedLots={consumedLots}
            onConfirm={() => {
              vibrateTap();
              onConfirmMaterial?.(item);
            }}
          />
        );
      })}

      {/* Refresh */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        onClick={fetchMaterials}
      >
        <Loader2 className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
        Refresh
      </Button>
    </div>
  );
}

function MaterialChecklistCard({
  item,
  consumedLots,
  onConfirm,
}: {
  item: ChecklistItem;
  consumedLots: ConsumedItem[];
  onConfirm: () => void;
}) {
  const statusConfig = {
    confirmed: {
      icon: <Check className="h-5 w-5 text-green-600" />,
      badge: <Badge className="bg-green-100 text-green-700 border-green-200">Confirmed</Badge>,
      border: "border-green-200 bg-green-50/50",
    },
    partial: {
      icon: <AlertCircle className="h-5 w-5 text-amber-600" />,
      badge: <Badge className="bg-amber-100 text-amber-700 border-amber-200">Partial</Badge>,
      border: "border-amber-200 bg-amber-50/50",
    },
    pending: {
      icon: <Package className="h-5 w-5 text-muted-foreground" />,
      badge: <Badge variant="secondary">Pending</Badge>,
      border: "border-border",
    },
  };

  const config = statusConfig[item.status];

  return (
    <div className={cn("rounded-lg border p-4 space-y-2", config.border)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{config.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{item.materialName}</span>
            {config.badge}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {item.partNumber}
          </p>
          <div className="flex items-center gap-4 mt-1.5 text-xs">
            <span>
              Planned: <strong>{item.quantityPlanned.toLocaleString()}</strong>{" "}
              {item.baseUom}
            </span>
            <span>
              Confirmed:{" "}
              <strong>
                {item.quantityConsumed > 0
                  ? item.quantityConsumed.toLocaleString()
                  : "--"}
              </strong>{" "}
              {item.quantityConsumed > 0 ? item.baseUom : ""}
            </span>
          </div>

          {/* Consumed lots */}
          {consumedLots.length > 0 && (
            <div className="mt-2 space-y-1">
              {consumedLots.map((lot, idx) => (
                <div
                  key={`${lot.lotNumber}-${idx}`}
                  className="text-xs text-muted-foreground flex items-center gap-2"
                >
                  <span className="font-mono">{lot.lotNumber}</span>
                  <span>{lot.quantityConsumed.toLocaleString()} {lot.uom}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirm button for pending/partial */}
      {item.status !== "confirmed" && (
        <Button
          variant="outline"
          size="sm"
          className="w-full min-h-[44px]"
          onClick={onConfirm}
        >
          <ScanLine className="h-4 w-4 mr-2" />
          {item.status === "partial" ? "Add More" : "Confirm Material"}
        </Button>
      )}
    </div>
  );
}

export type { ChecklistItem };
