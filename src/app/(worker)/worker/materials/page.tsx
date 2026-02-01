"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package,
  Search,
  ClipboardCheck,
  TruckIcon,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  ScanLine,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PullToRefresh } from "@/components/worker/PullToRefresh";
import { vibrateTap, vibrateSuccess } from "@/lib/haptics";
import { cn } from "@/lib/utils";

interface LowStockItem {
  id: string;
  name: string;
  partNumber: string;
  categoryName: string;
  totalOnHand: number;
  reorderPoint: number | null;
  uom: string;
  isOutOfStock: boolean;
}

interface MaterialsStats {
  lowStockCount: number;
  categories: string[];
}

export default function WorkerMaterialsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<MaterialsStats | null>(null);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = async () => {
    try {
      const res = await fetch("/api/worker/materials?stockStatus=low&pageSize=5");
      if (res.ok) {
        const data = await res.json();
        setStats({
          lowStockCount: data.lowStockCount,
          categories: data.categories,
        });
        setLowStockItems(data.items);
      }
    } catch (error) {
      console.error("Failed to fetch materials data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = async () => {
    vibrateTap();
    setRefreshing(true);
    await fetchData();
    vibrateSuccess();
    setRefreshing(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/worker/materials/stock?q=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  return (
    <PullToRefresh onRefresh={handleRefresh} refreshing={refreshing}>
      <div className="px-4 py-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Materials</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="min-h-[44px] min-w-[44px]"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>

        {/* Search Bar with Scan Button */}
        <form onSubmit={handleSearch}>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search materials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 text-base"
              />
            </div>
            <Link href="/worker/scan?context=material">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-12 w-12 flex-shrink-0"
                onClick={() => vibrateTap()}
              >
                <ScanLine className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </form>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/worker/materials/stock">
            <Card className="transition-all active:scale-[0.98] hover:shadow-md h-full">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center min-h-[100px]">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                  <ClipboardCheck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="font-medium">Check Stock</span>
                <span className="text-xs text-muted-foreground">View levels</span>
              </CardContent>
            </Card>
          </Link>

          <Link href="/worker/materials/receive">
            <Card className="transition-all active:scale-[0.98] hover:shadow-md h-full">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center min-h-[100px]">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-2">
                  <TruckIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <span className="font-medium">Receive Delivery</span>
                <span className="text-xs text-muted-foreground">Log materials</span>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Low Stock Alerts */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h3 className="font-medium">Low Stock Alerts</h3>
              {stats && stats.lowStockCount > 0 && (
                <Badge variant="outline" className="text-amber-600 border-amber-600">
                  {stats.lowStockCount}
                </Badge>
              )}
            </div>
            {stats && stats.lowStockCount > 5 && (
              <Link
                href="/worker/materials/stock?stockStatus=low"
                className="text-sm text-primary"
              >
                View all
              </Link>
            )}
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : lowStockItems.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No low stock alerts</p>
                <p className="text-sm">All materials are at healthy levels</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {lowStockItems.map((item) => (
                <Link key={item.id} href={`/worker/materials/${item.id}`}>
                  <Card className="transition-all active:scale-[0.99] hover:shadow-sm">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{item.name}</span>
                          {item.isOutOfStock && (
                            <Badge variant="destructive" className="text-xs">
                              Out
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="font-mono">{item.partNumber}</span>
                          <span className="text-xs">{item.categoryName}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <div className="text-right">
                          <div
                            className={cn(
                              "font-medium",
                              item.isOutOfStock
                                ? "text-destructive"
                                : "text-amber-600"
                            )}
                          >
                            {item.totalOnHand} {item.uom}
                          </div>
                          {item.reorderPoint && (
                            <div className="text-xs text-muted-foreground">
                              Min: {item.reorderPoint}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Category Quick Links */}
        {stats && stats.categories.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium flex items-center gap-2">
              <Package className="h-5 w-5" />
              Browse by Category
            </h3>
            <div className="flex flex-wrap gap-2">
              {stats.categories.slice(0, 8).map((category) => (
                <Link
                  key={category}
                  href={`/worker/materials/stock?category=${encodeURIComponent(category)}`}
                >
                  <Badge
                    variant="outline"
                    className="px-3 py-1.5 text-sm cursor-pointer hover:bg-accent"
                  >
                    {category}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
