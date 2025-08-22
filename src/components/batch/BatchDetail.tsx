"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useBatchDetail } from "@/hooks/useBatchDetail";
import { AncestryTab } from "./AncestryTab";
import { useBatchDetailDialog } from "@/stores/useBatchDetailDialog";
import { useAncestryNavPreference } from "@/lib/prefs";
import { logError } from "@/lib/log";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";

type TabKey = "summary" | "log" | "photos" | "ancestry" | "ai";

export function BatchDetail({
  batchId,
  initialTab = "summary",
}: { batchId: string; initialTab?: TabKey }) {
  const { data, error, isLoading, mutate } = useBatchDetail(batchId);
  const [activeTab, setActiveTab] = React.useState<TabKey>(initialTab);
  const { open } = useBatchDetailDialog();
  const { stayOnAncestry, setStayOnAncestry } = useAncestryNavPreference();
  const [loadingToId, setLoadingToId] = React.useState<string | null>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleOpenAncestor = (toBatchNumber: string, cardIndex: number) => {
    track("ui.ancestry.card_click", { fromBatchId: batchId, toBatchId: toBatchNumber, cardIndex });
    setLoadingToId(toBatchNumber);
    try {
        open(toBatchNumber, stayOnAncestry ? "ancestry" : "summary");
    } catch (e) {
        logError("ancestry_nav_failed", { toBatchNumber, error: String(e) });
        toast({ title: "Couldn’t open that batch. Please try again.", variant: "destructive" });
    } finally {
        setLoadingToId(null);
    }
  };

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
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="w-full">
      <TabsList>
        <TabsTrigger value="summary">Summary</TabsTrigger>
        <TabsTrigger value="log">Log History</TabsTrigger>
        <TabsTrigger value="photos">Photos</TabsTrigger>
        <TabsTrigger value="ancestry">Ancestry</TabsTrigger>
        <TabsTrigger value="ai">AI Tools</TabsTrigger>
      </TabsList>

      <TabsContent value="summary">
        <div className="p-6 space-y-2">
          <div className="text-sm"><span className="font-medium">Batch #:</span> {data.batchNumber}</div>
          <div className="text-sm"><span className="font-medium">Variety:</span> {data.variety}</div>
          {data.family && <div className="text-sm"><span className="font-medium">Family:</span> {data.family}</div>}
          {data.size && <div className="text-sm"><span className="font-medium">Size:</span> {data.size}</div>}
          {data.supplierName && <div className="text-sm"><span className="font-medium">Supplier:</span> {data.supplierName}</div>}
          {data.productionWeek && <div className="text-sm"><span className="font-medium">Production Week:</span> {data.productionWeek}</div>}
          <div className="text-sm"><span className="font-medium">Status:</span> {data.status}</div>
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
        <AncestryTab 
            nodes={data.ancestryNodes || null} 
            currentBatchNumber={data.batchNumber} 
            onOpenBatch={handleOpenAncestor} 
            loadingToId={loadingToId}
            stayOnAncestry={stayOnAncestry}
            onToggleStayOnAncestry={setStayOnAncestry}
        />
      </TabsContent>

      <TabsContent value="ai">
        {/* TODO: plug your existing AI tools panel */}
        <div className="p-6 text-sm text-muted-foreground">AI Tools go here.</div>
      </TabsContent>
    </Tabs>
  );
}
