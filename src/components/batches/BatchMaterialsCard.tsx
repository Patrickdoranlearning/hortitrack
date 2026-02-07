"use client";

import { useState, useEffect } from "react";
import { Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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
  lotNumber: string;
  quantityConsumed: number;
};

type MaterialsResponse = {
  planned: unknown[];
  consumed: ConsumedItem[];
  checklist: ChecklistItem[];
};

interface BatchMaterialsCardProps {
  batchId: string;
}

const STATUS_CONFIG: Record<
  ChecklistItem["status"],
  { label: string; className: string }
> = {
  confirmed: {
    label: "Confirmed",
    className:
      "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  },
  partial: {
    label: "Partial",
    className:
      "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  pending: {
    label: "Pending",
    className:
      "border-transparent bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  },
};

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function BatchMaterialsCard({ batchId }: BatchMaterialsCardProps) {
  const [data, setData] = useState<MaterialsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchMaterials() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/worker/batches/${batchId}/materials`
        );
        const json = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          throw new Error(json?.error || `Failed to load materials (${res.status})`);
        }

        setData(json);
      } catch (err: unknown) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to load materials";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchMaterials();

    return () => {
      cancelled = true;
    };
  }, [batchId]);

  const checklist = data?.checklist ?? [];
  const consumed = data?.consumed ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="h-5 w-5 text-muted-foreground" />
          Materials
          {checklist.length > 0 && (
            <Badge variant="secondary" className="text-xs ml-auto">
              {checklist.filter((c) => c.status === "confirmed").length}/{checklist.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && <LoadingSkeleton />}

        {error && (
          <div className="text-sm text-red-600 py-2">{error}</div>
        )}

        {!loading && !error && checklist.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No materials planned for this batch.
          </p>
        )}

        {!loading && !error && checklist.length > 0 && (
          <div className="space-y-3">
            {checklist.map((item) => {
              const statusConfig = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
              const lotNumbers = consumed
                .filter((c) => c.materialId === item.materialId)
                .map((c) => c.lotNumber);
              const uniqueLots = [...new Set(lotNumbers)];

              return (
                <div
                  key={item.materialId}
                  className="flex items-start justify-between gap-4 rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">
                        {item.materialName}
                      </span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {item.partNumber}
                      </Badge>
                    </div>

                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        Planned:{" "}
                        <span className="font-medium text-foreground">
                          {item.quantityPlanned.toLocaleString()} {item.baseUom}
                        </span>
                      </span>
                      <span>
                        Consumed:{" "}
                        <span className="font-medium text-foreground">
                          {item.quantityConsumed > 0
                            ? `${item.quantityConsumed.toLocaleString()} ${item.baseUom}`
                            : "--"}
                        </span>
                      </span>
                    </div>

                    {uniqueLots.length > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Lot:{" "}
                        {uniqueLots.map((lot, idx) => (
                          <span key={lot}>
                            <span className="font-mono">{lot}</span>
                            {idx < uniqueLots.length - 1 ? ", " : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <Badge className={statusConfig.className}>
                    {statusConfig.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
