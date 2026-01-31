"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useBatchDetail } from "@/hooks/useBatchDetail";
import { PlantPassportCard } from "@/components/batches/PlantPassportCard";
import { StockLedgerCard } from "@/components/batches/StockLedgerCard";
import { PlantHealthCard } from "@/components/batches/PlantHealthCard";
import { ScoutTab } from "@/components/batch/ScoutTab";
import AncestryStrip from "@/components/ancestry-strip";
import { Package, Heart, Search, ImageIcon, GitBranch } from "lucide-react";

// Lazy load gallery to avoid slowing down initial render
const BatchGallerySection = dynamic(
  () => import("@/components/batches/BatchGallerySection"),
  {
    loading: () => (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        Loading photos...
      </div>
    ),
    ssr: false
  }
);

type TabKey = "summary" | "stock" | "health" | "scout" | "photos" | "ancestry";

export function BatchDetail({
  batchId,
  initialTab = "summary",
}: { batchId: string; initialTab?: TabKey }) {
  const { data, error, isLoading } = useBatchDetail(batchId);
  const [tab, setTab] = React.useState<TabKey>(initialTab);
  React.useEffect(() => setTab(initialTab), [initialTab]);

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-6 w-40 mb-4" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-destructive">
        Failed to load batch. Please try again.
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 text-sm text-muted-foreground">Batch not found.</div>;
  }

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
      <TabsList className="flex-wrap h-auto gap-1">
        <TabsTrigger value="summary">Summary</TabsTrigger>
        <TabsTrigger value="stock" className="flex items-center gap-1">
          <Package className="h-3.5 w-3.5" />
          Stock
        </TabsTrigger>
        <TabsTrigger value="health" className="flex items-center gap-1">
          <Heart className="h-3.5 w-3.5" />
          Health
        </TabsTrigger>
        <TabsTrigger value="scout" className="flex items-center gap-1">
          <Search className="h-3.5 w-3.5" />
          Scout
        </TabsTrigger>
        <TabsTrigger value="photos" className="flex items-center gap-1">
          <ImageIcon className="h-3.5 w-3.5" />
          Photos
        </TabsTrigger>
        <TabsTrigger value="ancestry" className="flex items-center gap-1">
          <GitBranch className="h-3.5 w-3.5" />
          Ancestry
        </TabsTrigger>
      </TabsList>

      {/* Summary Tab */}
      <TabsContent value="summary" className="pt-3">
        <div className="space-y-4">
          <div className="p-6 space-y-2">
            <div className="text-sm"><span className="font-medium">Batch #:</span> {data.batchNumber}</div>
            <div className="text-sm"><span className="font-medium">Variety:</span> {data.variety}</div>
            {data.family && <div className="text-sm"><span className="font-medium">Family:</span> {data.family}</div>}
            {data.size && <div className="text-sm"><span className="font-medium">Size:</span> {data.size}</div>}
            {data.supplierName && <div className="text-sm"><span className="font-medium">Supplier:</span> {data.supplierName}</div>}
            {data.productionWeek && <div className="text-sm"><span className="font-medium">Production Week:</span> {data.productionWeek}</div>}
            <div className="text-sm"><span className="font-medium">Status:</span> {data.status}</div>
          </div>
          <PlantPassportCard batchId={batchId} />
        </div>
      </TabsContent>

      {/* Stock Tab */}
      <TabsContent value="stock" className="pt-3">
        <StockLedgerCard batchId={batchId} />
      </TabsContent>

      {/* Health Tab */}
      <TabsContent value="health" className="pt-3">
        <PlantHealthCard batchId={batchId} batchNumber={data.batchNumber} />
      </TabsContent>

      {/* Scout Tab */}
      <TabsContent value="scout" className="pt-3">
        <ScoutTab batchId={batchId} batchNumber={data.batchNumber} />
      </TabsContent>

      {/* Photos Tab */}
      <TabsContent value="photos" className="pt-3">
        <BatchGallerySection batchId={batchId} />
      </TabsContent>

      {/* Ancestry Tab */}
      <TabsContent value="ancestry" className="pt-3">
        <AncestryStrip currentId={batchId} />
      </TabsContent>
    </Tabs>
  );
}
