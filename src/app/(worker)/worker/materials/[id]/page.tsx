"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import {
  Package,
  ArrowLeft,
  RefreshCw,
  MapPin,
  Calendar,
  Box,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PullToRefresh } from "@/components/worker/PullToRefresh";
import { vibrateTap, vibrateSuccess } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import type { WorkerMaterialDetail } from "@/types/worker";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function WorkerMaterialDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [material, setMaterial] = useState<WorkerMaterialDetail | null>(null);
  const [showAllLots, setShowAllLots] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/worker/materials/${id}`);
      if (res.ok) {
        const data = await res.json();
        setMaterial(data);
      }
    } catch {
      // Error handled by empty state UI
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    vibrateTap();
    setRefreshing(true);
    await fetchData();
    vibrateSuccess();
    setRefreshing(false);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString();
  };

  const isExpiringSoon = (dateStr: string | null) => {
    if (!dateStr) return false;
    const expiry = new Date(dateStr);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expiry <= thirtyDaysFromNow;
  };

  if (loading) {
    return (
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-6 w-48" />
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!material) {
    return (
      <div className="px-4 py-4">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/worker/materials/stock">
            <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h2 className="text-lg font-semibold">Material Not Found</h2>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>This material could not be found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayedLots = showAllLots ? material.lots : material.lots.slice(0, 3);

  return (
    <PullToRefresh onRefresh={handleRefresh} refreshing={refreshing}>
      <div className="px-4 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Link href="/worker/materials/stock">
            <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">{material.name}</h2>
            <span className="text-sm text-muted-foreground font-mono">
              {material.partNumber}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            className="min-h-[44px] min-w-[44px]"
          >
            <RefreshCw className={cn("h-5 w-5", refreshing && "animate-spin")} />
          </Button>
        </div>

        {/* Summary Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Badge variant="outline">{material.categoryName}</Badge>
              {material.isLowStock && (
                <Badge
                  variant="outline"
                  className="text-amber-600 border-amber-600"
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Low Stock
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Total Stock</div>
                <div
                  className={cn(
                    "text-2xl font-bold",
                    material.totalStock <= 0
                      ? "text-destructive"
                      : material.isLowStock
                        ? "text-amber-600"
                        : "text-green-600"
                  )}
                >
                  {material.totalStock.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">{material.uom}</div>
              </div>
              {material.reorderPoint && (
                <div>
                  <div className="text-sm text-muted-foreground">Reorder Point</div>
                  <div className="text-2xl font-bold text-muted-foreground">
                    {material.reorderPoint.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">{material.uom}</div>
                </div>
              )}
            </div>

            {material.description && (
              <div className="mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">{material.description}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock by Location */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Stock by Location
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {material.stockByLocation.map((stock) => (
                <div
                  key={stock.locationId ?? "general"}
                  className="flex items-center justify-between p-4"
                >
                  <div>
                    <div className="font-medium">{stock.locationName}</div>
                    {stock.reserved > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {stock.reserved} reserved
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div
                      className={cn(
                        "font-semibold",
                        stock.onHand <= 0 ? "text-destructive" : ""
                      )}
                    >
                      {stock.onHand.toLocaleString()} {material.uom}
                    </div>
                    {stock.available !== stock.onHand && (
                      <div className="text-xs text-muted-foreground">
                        {stock.available} available
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Lots */}
        {material.lots.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Box className="h-4 w-4" />
                Available Lots ({material.lots.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {displayedLots.map((lot) => (
                  <div key={lot.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-mono font-medium">{lot.lotNumber}</div>
                        {lot.supplierLotNumber && (
                          <div className="text-xs text-muted-foreground">
                            Supplier: {lot.supplierLotNumber}
                          </div>
                        )}
                        {lot.locationName && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            {lot.locationName}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {lot.quantity.toLocaleString()} {material.uom}
                        </div>
                        {lot.expiryDate && (
                          <div
                            className={cn(
                              "text-xs flex items-center justify-end gap-1",
                              isExpiringSoon(lot.expiryDate)
                                ? "text-amber-600"
                                : "text-muted-foreground"
                            )}
                          >
                            <Calendar className="h-3 w-3" />
                            Exp: {formatDate(lot.expiryDate)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {material.lots.length > 3 && (
                <div className="p-2 border-t">
                  <Button
                    variant="ghost"
                    className="w-full h-10"
                    onClick={() => setShowAllLots(!showAllLots)}
                  >
                    {showAllLots ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-2" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2" />
                        Show All ({material.lots.length} lots)
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* No lots message */}
        {material.lots.length === 0 && material.totalStock > 0 && (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">
              <Box className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No lot tracking for this material</p>
              <p className="text-xs">Stock is tracked at aggregate level</p>
            </CardContent>
          </Card>
        )}
      </div>
    </PullToRefresh>
  );
}
