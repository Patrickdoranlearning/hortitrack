"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Package,
  Search,
  ArrowLeft,
  RefreshCw,
  ChevronRight,
  Filter,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { PullToRefresh } from "@/components/worker/PullToRefresh";
import { vibrateTap, vibrateSuccess } from "@/lib/haptics";
import { cn } from "@/lib/utils";

interface StockItem {
  id: string;
  partNumber: string;
  name: string;
  categoryName: string;
  uom: string;
  totalOnHand: number;
  totalAvailable: number;
  reorderPoint: number | null;
  isLowStock: boolean;
  isOutOfStock: boolean;
}

type StockStatus = "all" | "low" | "out";

export default function WorkerStockCheckPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialCategory = searchParams.get("category") || "all";
  const initialStatus = (searchParams.get("stockStatus") as StockStatus) || "all";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<StockItem[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [stockStatus, setStockStatus] = useState<StockStatus>(initialStatus);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      if (stockStatus !== "all") params.set("stockStatus", stockStatus);
      params.set("pageSize", "100"); // Load more for mobile scrolling

      const res = await fetch(`/api/worker/materials?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
        setAllCategories(data.categories);
      }
    } catch (error) {
      console.error("Failed to fetch stock data:", error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory, stockStatus]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    vibrateTap();
    setRefreshing(true);
    await fetchData();
    vibrateSuccess();
    setRefreshing(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    fetchData();
  };

  // Group items by category for display
  const groupedItems = useMemo(() => {
    const groups: Record<string, StockItem[]> = {};
    items.forEach((item) => {
      if (!groups[item.categoryName]) {
        groups[item.categoryName] = [];
      }
      groups[item.categoryName].push(item);
    });
    return groups;
  }, [items]);

  const categoryOrder = Object.keys(groupedItems).sort();

  const getStockStatusColor = (item: StockItem) => {
    if (item.isOutOfStock) return "text-destructive";
    if (item.isLowStock) return "text-amber-600";
    return "text-green-600";
  };

  const getStockStatusBg = (item: StockItem) => {
    if (item.isOutOfStock) return "bg-destructive/10";
    if (item.isLowStock) return "bg-amber-500/10";
    return "";
  };

  return (
    <PullToRefresh onRefresh={handleRefresh} refreshing={refreshing}>
      <div className="pb-4">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background border-b px-4 py-3 space-y-3">
          <div className="flex items-center gap-2">
            <Link href="/worker/materials">
              <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h2 className="text-lg font-semibold flex-1">Stock Levels</h2>
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

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search by name or part number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 text-base"
              />
            </div>
            <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="min-h-[44px] min-w-[44px]"
                >
                  <Filter className="h-5 w-5" />
                  {(selectedCategory !== "all" || stockStatus !== "all") && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[70vh]">
                <SheetHeader>
                  <SheetTitle>Filter Stock</SheetTitle>
                </SheetHeader>
                <div className="space-y-6 mt-4">
                  {/* Stock Status Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Stock Status</label>
                    <Tabs
                      value={stockStatus}
                      onValueChange={(v) => setStockStatus(v as StockStatus)}
                    >
                      <TabsList className="w-full">
                        <TabsTrigger value="all" className="flex-1">
                          All
                        </TabsTrigger>
                        <TabsTrigger value="low" className="flex-1">
                          Low Stock
                        </TabsTrigger>
                        <TabsTrigger value="out" className="flex-1">
                          Out
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  {/* Category Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto">
                      <Badge
                        variant={selectedCategory === "all" ? "default" : "outline"}
                        className="px-3 py-1.5 cursor-pointer text-sm"
                        onClick={() => setSelectedCategory("all")}
                      >
                        All Categories
                      </Badge>
                      {allCategories.map((cat) => (
                        <Badge
                          key={cat}
                          variant={selectedCategory === cat ? "default" : "outline"}
                          className="px-3 py-1.5 cursor-pointer text-sm"
                          onClick={() => setSelectedCategory(cat)}
                        >
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Button
                    className="w-full h-12"
                    onClick={() => setFilterSheetOpen(false)}
                  >
                    Apply Filters
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </form>

          {/* Active Filters */}
          {(selectedCategory !== "all" || stockStatus !== "all") && (
            <div className="flex gap-2 flex-wrap">
              {selectedCategory !== "all" && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => setSelectedCategory("all")}
                >
                  {selectedCategory} x
                </Badge>
              )}
              {stockStatus !== "all" && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => setStockStatus("all")}
                >
                  {stockStatus === "low" ? "Low Stock" : "Out of Stock"} x
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-4 py-4">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No materials found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="space-y-6">
              {categoryOrder.map((category) => (
                <div key={category} className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground sticky top-[140px] bg-background py-1">
                    {category} ({groupedItems[category].length})
                  </h3>
                  <div className="space-y-2">
                    {groupedItems[category].map((item) => (
                      <Link key={item.id} href={`/worker/materials/${item.id}`}>
                        <Card
                          className={cn(
                            "transition-all active:scale-[0.99]",
                            getStockStatusBg(item)
                          )}
                        >
                          <CardContent className="p-3 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">
                                  {item.name}
                                </span>
                                {item.isOutOfStock && (
                                  <Badge variant="destructive" className="text-xs">
                                    Out
                                  </Badge>
                                )}
                                {item.isLowStock && !item.isOutOfStock && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs text-amber-600 border-amber-600"
                                  >
                                    Low
                                  </Badge>
                                )}
                              </div>
                              <span className="text-sm text-muted-foreground font-mono">
                                {item.partNumber}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className={cn("font-semibold", getStockStatusColor(item))}>
                                {item.totalOnHand.toLocaleString()}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {item.uom}
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}
