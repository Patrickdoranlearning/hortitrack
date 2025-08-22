"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useBatchDetail } from "@/hooks/useBatchDetail";
import { AncestryTab } from "./AncestryTab";
import PlantPassportCard from "@/components/batch/PlantPassportCard";
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

  const passport = computePassportFromBatch(data);

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
            <div className="grid grid-cols-2 gap-4 text-sm p-4 border rounded-lg">
                <div>
                    <p className="text-muted-foreground">Batch #</p>
                    <p className="font-medium">{data.batchNumber}</p>
                </div>
                 <div>
                    <p className="text-muted-foreground">Variety</p>
                    <p className="font-medium">{data.variety}</p>
                </div>
                <div>
                    <p className="text-muted-foreground">Family</p>
                    <p className="font-medium">{data.family || 'N/A'}</p>
                </div>
                <div>
                    <p className="text-muted-foreground">Size</p>
                    <p className="font-medium">{data.size || 'N/A'}</p>
                </div>
                <div>
                    <p className="text-muted-foreground">Supplier</p>
                    <p className="font-medium">{data.supplierName || 'N/A'}</p>
                </div>
                <div>
                    <p className="text-muted-foreground">Prod. Week</p>
                    <p className="font-medium">{data.productionWeek || 'N/A'}</p>
                </div>
                 <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className="font-medium">{data.status}</p>
                </div>
            </div>
            <PlantPassportCard
                family={passport.aFamily}
                producerCode={passport.bProducerCode}
                batchNumber={passport.cBatchNumber}
                countryCode={passport.dCountryCode}
                status={data.status ?? null}
            />
            {passport.warnings.length > 0 ? (
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
