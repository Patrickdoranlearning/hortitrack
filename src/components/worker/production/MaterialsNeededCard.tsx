"use client";

import * as React from "react";
import useSWR from "swr";
import {
  Package,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { vibrateTap } from "@/lib/haptics";

interface MaterialPreviewItem {
  materialId: string;
  materialName: string;
  partNumber: string;
  quantityRequired: number;
  quantityAvailable: number;
  baseUom: string;
  isShortage: boolean;
}

interface MaterialPreviewResponse {
  preview: MaterialPreviewItem[];
}

interface MaterialsNeededCardProps {
  sizeId: string;
  quantity: number;
  className?: string;
  /** Compact mode for inline display */
  compact?: boolean;
}

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  });

/**
 * Mobile-optimized card showing materials that will be consumed.
 * Displays shortages with visual warnings.
 */
export function MaterialsNeededCard({
  sizeId,
  quantity,
  className,
  compact = false,
}: MaterialsNeededCardProps) {
  const [expanded, setExpanded] = React.useState(!compact);

  const { data, isLoading, error } = useSWR<MaterialPreviewResponse>(
    sizeId && quantity > 0
      ? `/api/materials/consumption/preview?sizeId=${sizeId}&quantity=${quantity}`
      : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  const materials = data?.preview ?? [];
  const hasShortages = materials.some((m) => m.isShortage);
  const totalMaterials = materials.length;

  const handleToggle = () => {
    vibrateTap();
    setExpanded(!expanded);
  };

  // Don't render if no materials are linked to this size
  if (!isLoading && !error && totalMaterials === 0) {
    return null;
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Materials Needed
            {hasShortages && (
              <Badge variant="destructive" className="ml-2">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Shortage
              </Badge>
            )}
          </CardTitle>
          {compact && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleToggle}
              className="min-h-[44px] min-w-[44px]"
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
        {!expanded && totalMaterials > 0 && (
          <p className="text-xs text-muted-foreground">
            {totalMaterials} material{totalMaterials !== 1 && "s"} will be
            consumed
          </p>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {isLoading && (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Loading materials...
            </div>
          )}

          {error && (
            <div className="text-sm text-muted-foreground py-4 text-center">
              Unable to load material preview
            </div>
          )}

          {!isLoading && !error && totalMaterials === 0 && (
            <div className="text-sm text-muted-foreground py-4">
              <p>No materials linked to this size.</p>
              <p className="text-xs mt-1">
                Link materials in the Materials Catalog to enable
                auto-consumption.
              </p>
            </div>
          )}

          {!isLoading && !error && totalMaterials > 0 && (
            <div className="space-y-3">
              {hasShortages && (
                <Alert variant="destructive" className="py-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Some materials have insufficient stock. Batches can still be
                    created, but stock levels will go negative.
                  </AlertDescription>
                </Alert>
              )}

              {/* Material list - mobile optimized cards instead of table */}
              <div className="space-y-2">
                {materials.map((item) => (
                  <div
                    key={item.materialId}
                    className={cn(
                      "p-3 rounded-lg border",
                      item.isShortage
                        ? "border-destructive/50 bg-destructive/5"
                        : "border-border"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {item.materialName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.partNumber}
                        </p>
                      </div>
                      {item.isShortage ? (
                        <Badge variant="destructive" className="flex-shrink-0">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Shortage
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="flex-shrink-0 border-green-500 text-green-600"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          OK
                        </Badge>
                      )}
                    </div>

                    <div className="flex justify-between mt-2 text-xs">
                      <span className="text-muted-foreground">Required:</span>
                      <span className="font-medium">
                        {item.quantityRequired.toLocaleString()} {item.baseUom}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Available:</span>
                      <span
                        className={cn(
                          "font-medium",
                          item.isShortage && "text-destructive"
                        )}
                      >
                        {item.quantityAvailable.toLocaleString()} {item.baseUom}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                Materials will be automatically deducted when the batch is
                created.
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default MaterialsNeededCard;
