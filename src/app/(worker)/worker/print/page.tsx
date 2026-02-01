"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  Search,
  Package,
  MapPin,
  Box,
  Clock,
  ChevronRight,
  Loader2,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { vibrateTap } from "@/lib/haptics";
import useSWR from "swr";

interface RecentPrint {
  type: "batch" | "location" | "lot";
  id: string;
  label: string;
  subLabel?: string;
  printedAt: string;
}

interface SearchResult {
  type: "batch" | "location" | "lot";
  id: string;
  label: string;
  subLabel?: string;
}

async function searchItems(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 2) return [];

  const res = await fetch(`/api/worker/print/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

export default function PrintHubPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"search" | "recent">("search");
  const [recentPrints, setRecentPrints] = useState<RecentPrint[]>([]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load recent prints from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("worker-recent-prints");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setRecentPrints(parsed.slice(0, 10));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Search results
  const { data: searchResults, isLoading: searching } = useSWR(
    debouncedQuery.length >= 2 ? `print-search:${debouncedQuery}` : null,
    () => searchItems(debouncedQuery),
    { revalidateOnFocus: false }
  );

  const handleBack = () => {
    vibrateTap();
    router.back();
  };

  const handleSelectItem = (item: SearchResult | RecentPrint) => {
    vibrateTap();

    // Add to recent prints
    const newRecent: RecentPrint = {
      type: item.type,
      id: item.id,
      label: item.label,
      subLabel: item.subLabel,
      printedAt: new Date().toISOString(),
    };

    const updatedRecents = [
      newRecent,
      ...recentPrints.filter((r) => !(r.type === item.type && r.id === item.id)),
    ].slice(0, 10);

    setRecentPrints(updatedRecents);
    localStorage.setItem("worker-recent-prints", JSON.stringify(updatedRecents));

    // Navigate to print page
    const path = item.type === "batch"
      ? `/worker/print/batch/${item.id}`
      : item.type === "location"
      ? `/worker/print/location/${item.id}`
      : `/worker/print/lot/${item.id}`;

    router.push(path);
  };

  const handleScan = () => {
    vibrateTap();
    router.push("/worker/scan?action=print");
  };

  const getItemIcon = (type: "batch" | "location" | "lot") => {
    switch (type) {
      case "batch":
        return <Package className="h-5 w-5" />;
      case "location":
        return <MapPin className="h-5 w-5" />;
      case "lot":
        return <Box className="h-5 w-5" />;
    }
  };

  const getItemTypeName = (type: "batch" | "location" | "lot") => {
    switch (type) {
      case "batch":
        return "Batch";
      case "location":
        return "Location";
      case "lot":
        return "Material Lot";
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4">
          <Button
            variant="ghost"
            size="sm"
            className="min-h-[44px] -ml-2"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <h1 className="font-semibold flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Print Labels
          </h1>

          <Button
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px] -mr-2"
            onClick={handleScan}
          >
            <ScanLine className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quick Print</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-3 gap-3">
              <QuickPrintButton
                icon={<Package className="h-6 w-6" />}
                label="Batch"
                onClick={() => {
                  vibrateTap();
                  setActiveTab("search");
                  setSearchQuery("");
                }}
              />
              <QuickPrintButton
                icon={<MapPin className="h-6 w-6" />}
                label="Location"
                onClick={() => {
                  vibrateTap();
                  setActiveTab("search");
                  setSearchQuery("");
                }}
              />
              <QuickPrintButton
                icon={<Box className="h-6 w-6" />}
                label="Material Lot"
                onClick={() => {
                  vibrateTap();
                  setActiveTab("search");
                  setSearchQuery("");
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Search and Recent Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "search" | "recent")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search" className="min-h-[44px]">
              <Search className="h-4 w-4 mr-2" />
              Search
            </TabsTrigger>
            <TabsTrigger value="recent" className="min-h-[44px]">
              <Clock className="h-4 w-4 mr-2" />
              Recent
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="mt-4 space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search batch number, location name..."
                className="pl-10 h-12 text-base"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Search Results */}
            {searchQuery.length >= 2 && (
              <div className="space-y-2">
                {searching && !searchResults && (
                  <div className="text-center py-8 text-muted-foreground">
                    Searching...
                  </div>
                )}

                {!searching && searchResults && searchResults.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No results found for &quot;{searchQuery}&quot;
                  </div>
                )}

                {searchResults && searchResults.length > 0 && (
                  <Card>
                    <CardContent className="p-2 space-y-1">
                      {searchResults.map((item) => (
                        <ResultItem
                          key={`${item.type}-${item.id}`}
                          icon={getItemIcon(item.type)}
                          typeName={getItemTypeName(item.type)}
                          label={item.label}
                          subLabel={item.subLabel}
                          onClick={() => handleSelectItem(item)}
                        />
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {searchQuery.length < 2 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p>Enter at least 2 characters to search</p>
                <p className="text-xs mt-1">Search for batches, locations, or material lots</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="recent" className="mt-4">
            {recentPrints.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p>No recent prints</p>
                <p className="text-xs mt-1">Your print history will appear here</p>
              </div>
            ) : (
              <Card>
                <CardContent className="p-2 space-y-1">
                  {recentPrints.map((item, index) => (
                    <ResultItem
                      key={`recent-${item.type}-${item.id}-${index}`}
                      icon={getItemIcon(item.type)}
                      typeName={getItemTypeName(item.type)}
                      label={item.label}
                      subLabel={item.subLabel}
                      timestamp={item.printedAt}
                      onClick={() => handleSelectItem(item)}
                    />
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Tips */}
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium mb-2">Tips</h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>- Scan a barcode to quickly find and reprint labels</li>
              <li>- Multiple copies can be printed at once</li>
              <li>- Labels are optimized for standard label printers</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuickPrintButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      className="h-20 flex flex-col items-center justify-center gap-2"
      onClick={onClick}
    >
      {icon}
      <span className="text-xs">{label}</span>
    </Button>
  );
}

function ResultItem({
  icon,
  typeName,
  label,
  subLabel,
  timestamp,
  onClick,
}: {
  icon: React.ReactNode;
  typeName: string;
  label: string;
  subLabel?: string;
  timestamp?: string;
  onClick: () => void;
}) {
  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return "Yesterday";
    return date.toLocaleDateString("en-IE", { day: "numeric", month: "short" });
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg",
        "cursor-pointer active:bg-muted/50 transition-all",
        "touch-manipulation hover:bg-muted/30"
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase">{typeName}</span>
        </div>
        <div className="font-medium truncate">{label}</div>
        {subLabel && (
          <div className="text-sm text-muted-foreground truncate">{subLabel}</div>
        )}
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        {timestamp && (
          <span className="text-xs">{formatTimestamp(timestamp)}</span>
        )}
        <ChevronRight className="h-5 w-5 flex-shrink-0" />
      </div>
    </div>
  );
}
