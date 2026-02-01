"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Package,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Camera,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PickItem, BatchPick } from "@/server/sales/picking";

interface PickingItemCardProps {
  item: PickItem;
  onSelect: (item: PickItem) => void;
  showProgress?: boolean;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pending: {
    label: "To Pick",
    color: "bg-muted text-muted-foreground",
    icon: Package,
  },
  picked: {
    label: "Picked",
    color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    icon: CheckCircle2,
  },
  short: {
    label: "Short",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    icon: AlertTriangle,
  },
  substituted: {
    label: "Substituted",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    icon: RefreshCw,
  },
  skipped: {
    label: "Skipped",
    color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    icon: AlertTriangle,
  },
};

export function PickingItemCard({ item, onSelect, showProgress = true }: PickingItemCardProps) {
  const config = statusConfig[item.status] || statusConfig.pending;
  const StatusIcon = config.icon;
  const isPending = item.status === "pending";
  const progress = item.targetQty > 0 ? Math.round((item.pickedQty / item.targetQty) * 100) : 0;
  const hasBatchPicks = item.batchPicks && item.batchPicks.length > 0;
  const isMultiBatch = hasBatchPicks && item.batchPicks!.length > 1;
  const productName = item.productName || `${item.plantVariety || ""} ${item.size ? `- ${item.size}` : ""}`.trim();

  return (
    <Card
      onClick={() => onSelect(item)}
      className={cn(
        "p-4 transition-all touch-manipulation cursor-pointer",
        isPending && "active:scale-[0.98] border-l-4 border-l-amber-500",
        item.status === "picked" && "border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-950/30",
        item.status === "short" && "border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/30",
        item.status === "substituted" && "border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/30"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div
          className={cn(
            "flex items-center justify-center w-12 h-12 rounded-lg shrink-0",
            isPending ? "bg-muted" : config.color
          )}
        >
          <StatusIcon className="h-6 w-6" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className="font-semibold truncate text-base">
              {productName}
            </h4>
            <Badge className={cn("shrink-0", config.color)}>{config.label}</Badge>
          </div>

          {/* Variety and Size */}
          {item.plantVariety && item.size && item.productName && (
            <p className="text-sm text-muted-foreground truncate mb-2">
              {item.plantVariety} - {item.size}
            </p>
          )}

          {/* Location */}
          {item.batchLocation && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="font-medium">{item.batchLocation}</span>
            </div>
          )}

          {/* Progress Bar */}
          {showProgress && (
            <div className="mb-2">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">Progress</span>
                <span className={cn(
                  "font-medium",
                  progress >= 100 && "text-green-600",
                  progress > 0 && progress < 100 && "text-amber-600"
                )}>
                  {item.pickedQty}/{item.targetQty}
                </span>
              </div>
              <Progress
                value={progress}
                className={cn(
                  "h-2",
                  progress >= 100 && "[&>div]:bg-green-500",
                  progress > 0 && progress < 100 && "[&>div]:bg-amber-500"
                )}
              />
            </div>
          )}

          {/* Batch Info */}
          {hasBatchPicks ? (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">
                {isMultiBatch ? "Picked from:" : "Batch:"}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {item.batchPicks!.map((bp) => (
                  <Badge
                    key={bp.id}
                    variant="outline"
                    className="font-mono text-xs py-0.5"
                  >
                    {bp.batchNumber}
                    {isMultiBatch && <span className="ml-1 text-muted-foreground">({bp.quantity})</span>}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (item.originalBatchNumber || item.pickedBatchNumber) ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Batch:</span>
              <Badge variant="outline" className="font-mono text-xs">
                {item.pickedBatchNumber || item.originalBatchNumber}
              </Badge>
            </div>
          ) : null}

          {/* Action Button for Pending Items */}
          {isPending && (
            <Button
              variant="default"
              size="sm"
              className="w-full mt-3 h-11 gap-2 bg-primary/90"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(item);
              }}
            >
              <Camera className="h-4 w-4" />
              SCAN TO CFRM
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
