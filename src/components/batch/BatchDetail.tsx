"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useBatchDetail } from "@/hooks/useBatchDetail";
import { AncestryTab } from "./AncestryTab";
import { PlantPassportCard } from "./PlantPassportCard";
import { computePassportFromBatch } from "@/lib/passport";

type TabKey = "summary" | "log" | "photos" | "ancestry" | "ai";

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

  const passport = data.currentPassport ? null : computePassportFromBatch(data);
  const p = data.currentPassport ?? passport;

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
      <TabsList>
        <TabsTrigger value="summary">Summary</TabsTrigger>
        <TabsTrigger value="log">Log History</TabsTrigger>
        <TabsTrigger value="photos">Photos</TabsTrigger>
        <TabsTrigger value="ancestry">Ancestry</TabsTrigger>
        <TabsTrigger value="ai">AI Tools</TabsTrigger>
      </TabsList>

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
            {p && <PlantPassportCard
                family={p.aFamily}
                producerCode={p.bProducerCode}
                batchNumber={p.cBatchNumber}
                countryCode={p.dCountryCode}
                source={p.source}
                hasHistoryLink={p.source === "Internal"}
                onOpenHistory={() => {/* open a dialog listing /batches/{id}/passports */}}
            />}

            {passport?.warnings.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                {passport.warnings.join(" ")}
                </p>
            ) : null}
        </div>
      </TabsContent>

      <TabsContent value="log">
        {/* TODO: plug your existing Log History component, passing batchId */}
        <div className="p-6 text-sm text-muted-foreground">Log History goes here.</div>
      </TabsContent>

      <TabsContent value="photos">
        {/* TODO: plug your existing Photos component, passing batchId */}
        <div className="p-6 text-sm text-muted-foreground">Photos go here.</div>
      </TabsContent>

      <TabsContent value="ancestry">
        <AncestryTab batchId={batchId} />
      </TabsContent>

      <TabsContent value="ai">
        {/* TODO: plug your existing AI tools panel */}
        <div className="p-6 text-sm text-muted-foreground">AI Tools go here.</div>
      </TabsContent>
    </Tabs>
  );
}
