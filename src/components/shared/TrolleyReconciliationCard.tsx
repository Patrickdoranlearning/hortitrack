"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, ArrowRight, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type TrolleyReconciliationCardProps = {
  estimated: number | null;
  actual: number | null;
  showVariance?: boolean;
  className?: string;
  compact?: boolean;
};

export function TrolleyReconciliationCard({
  estimated,
  actual,
  showVariance = true,
  className,
  compact = false,
}: TrolleyReconciliationCardProps) {
  // Calculate variance
  const hasEstimate = estimated !== null && estimated !== undefined;
  const hasActual = actual !== null && actual !== undefined;
  const canCompare = hasEstimate && hasActual;

  let variance: number | null = null;
  let variancePercent: number | null = null;
  let varianceStatus: "match" | "over" | "under" | "unknown" = "unknown";

  if (canCompare) {
    variance = actual - estimated;
    variancePercent = estimated > 0 ? Math.round((variance / estimated) * 100) : null;

    if (variance === 0) {
      varianceStatus = "match";
    } else if (variance > 0) {
      varianceStatus = "over";
    } else {
      varianceStatus = "under";
    }
  }

  // Compact variant for inline display
  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 text-sm", className)}>
        <Truck className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">
          {hasEstimate ? estimated : "?"} est
        </span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <span className={cn(
          "font-medium",
          hasActual && varianceStatus === "match" && "text-green-600",
          hasActual && varianceStatus === "over" && "text-amber-600",
          hasActual && varianceStatus === "under" && "text-green-600",
          !hasActual && "text-muted-foreground"
        )}>
          {hasActual ? actual : "?"} actual
        </span>
        {showVariance && canCompare && variance !== 0 && (
          <Badge
            variant={varianceStatus === "over" ? "warning" : "secondary"}
            className="ml-1"
          >
            {variance > 0 ? "+" : ""}{variance}
          </Badge>
        )}
      </div>
    );
  }

  // Full card variant
  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Truck className="h-4 w-4" />
          Trolley Reconciliation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {/* Estimated */}
          <div className="text-center">
            <div className="text-2xl font-bold text-muted-foreground">
              {hasEstimate ? estimated : "-"}
            </div>
            <div className="text-xs text-muted-foreground">Estimated</div>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Actual */}
          <div className="text-center">
            <div
              className={cn(
                "text-2xl font-bold",
                hasActual && varianceStatus === "match" && "text-green-600",
                hasActual && varianceStatus === "over" && "text-amber-600",
                hasActual && varianceStatus === "under" && "text-green-600",
                !hasActual && "text-muted-foreground"
              )}
            >
              {hasActual ? actual : "-"}
            </div>
            <div className="text-xs text-muted-foreground">Actual</div>
          </div>
        </div>

        {/* Variance indicator */}
        {showVariance && canCompare && (
          <div className="mt-4 pt-3 border-t">
            <div className="flex items-center justify-center gap-2">
              {varianceStatus === "match" && (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600">
                    Estimate matched actual
                  </span>
                </>
              )}
              {varianceStatus === "over" && (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-amber-600">
                    Used {variance} more trolley{Math.abs(variance!) !== 1 && "s"} than estimated
                    {variancePercent !== null && ` (+${variancePercent}%)`}
                  </span>
                </>
              )}
              {varianceStatus === "under" && (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600">
                    Used {Math.abs(variance!)} fewer trolley{Math.abs(variance!) !== 1 && "s"} than estimated
                    {variancePercent !== null && ` (${variancePercent}%)`}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Waiting for actual */}
        {hasEstimate && !hasActual && (
          <div className="mt-4 pt-3 border-t">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <span className="text-sm">Awaiting picking completion</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
