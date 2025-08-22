"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { getBatchAncestry, getBatchSummary } from "@/lib/api/batches";
import { AncestryNode, BatchSummary, PlantPassport } from "@/types/batch";
import { AncestryTab } from "@/components/batch/AncestryTab";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft } from "lucide-react";
import { track } from "@/lib/analytics";
import { logError, logInfo } from "@/lib/log";
import { useAncestryNavPreference } from "@/lib/prefs";
import { PlantPassportCard } from "@/components/batch/PlantPassportCard";

type TabKey = "summary" | "log" | "photos" | "ancestry" | "ai";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  batchNumber: string;           // initial batch
};

function derivePassport(
  summary: { batchNumber: string; variety?: string | null } | null
): PlantPassport | null {
  if (!summary) return null;

  // Fallbacks:
  // A = Variety, C = Batch Number. B & D left blank unless your API provides them.
  // If you store these in settings, you can hydrate them here later.
  return {
    A_botanicalName: summary.variety ?? undefined,
    C_traceabilityCode: summary.batchNumber,
    // B_regNumber: settings?.regNumber,       // optional future enhancement
    // D_countryOfOrigin: settings?.origin,    // optional future enhancement
  };
}

export function BatchDetailDialog({ open, onOpenChange, batchNumber }: Props) {
  // Controlled in-dialog navigation
  const [activeBatch, setActiveBatch] = React.useState(batchNumber);
  const [summary, setSummary] = React.useState<{title: string; subtitle?: string, plantPassport?: PlantPassport; variety?: string; batchNumber: string;} | null>(null);
  const [ancestry, setAncestry] = React.useState<AncestryNode[] | null>(null);
  const [history, setHistory] = React.useState<string[]>([]); // stack of previous batchNumbers
  const [activeTab, setActiveTab] = React.useState<TabKey>("summary");
  const [loadingToId, setLoadingToId] = React.useState<string | null>(null);

  const { stayOnAncestry, setStayOnAncestry } = useAncestryNavPreference();
  const headerRef = React.useRef<HTMLHeadingElement | null>(null);
  const liveRef = React.useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();

  // Reset on initial open
  React.useEffect(() => {
    if (open) {
      setActiveBatch(batchNumber);
      setHistory([]);
      // keep the tab the user had last time? for now default Summary
      setActiveTab("summary");
    }
  }, [open, batchNumber]);

  // Fetch summary + ancestry when active batch changes
  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      setAncestry(null); // show skeletons
      try {
        const [s, a] = await Promise.all([
          getBatchSummary(activeBatch),
          getBatchAncestry(activeBatch),
        ]);
        if (cancelled) return;
        setSummary({
          title: `${s.batchNumber}${s.variety ? ` — ${s.variety}` : ""}`,
          subtitle: [s.variety, s.size, s.productionWeek].filter(Boolean).join(" · "),
          plantPassport: s.plantPassport,
          variety: s.variety,
          batchNumber: s.batchNumber,
        });
        setAncestry(a);
        // announce for screen readers
        const announcement = `Opened batch ${s.batchNumber}${s.variety ? ` — ${s.variety}` : ""}`;
        liveRef.current?.replaceChildren(document.createTextNode(announcement));
        // move focus to header
        headerRef.current?.focus();
        logInfo("dialog_batch_loaded", { batch: activeBatch, nodes: a.length });
      } catch (e) {
        logError("dialog_batch_load_failed", { batch: activeBatch, error: String(e) });
        toast({ title: "Couldn’t open that batch. Please try again.", variant: "destructive" });
      } finally {
        setLoadingToId(null);
      }
    }

    run();
    return () => { cancelled = true; };
  }, [activeBatch, toast]);

  function handleBack() {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setActiveBatch(prev);
    // preserve the tab user was on before click
  }

  async function openBatchInDialog(toBatch: string, cardIndex: number) {
    if (toBatch === activeBatch) {
      toast({ title: "Already viewing this batch." });
      return;
    }
    // optimistic UI: pressed state + spinner on card
    setLoadingToId(toBatch);
    setHistory((h) => [...h, activeBatch]);

    // Tab behavior
    setActiveTab(stayOnAncestry ? "ancestry" : "summary");

    try {
      track("ui.ancestry.card_click", { fromBatchId: activeBatch, toBatchId: toBatch, cardIndex });
      setActiveBatch(toBatch);
    } catch (e) {
      // If something goes wrong, revert history
      setHistory((h) => h.slice(0, -1));
      setLoadingToId(null);
      logError("ancestry_nav_failed", { toBatch, error: String(e) });
      toast({ title: "Couldn’t open that batch. Please try again.", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined} // Description is present but we don't tie to ID to avoid verbosity
        className="sm:max-w-4xl"
      >
        <DialogHeader>
          {/* ✅ Required by Radix: fixes your error */}
          <DialogTitle ref={headerRef} tabIndex={-1} className="outline-none">
            {summary?.title ?? "Loading…"}
          </DialogTitle>

          {/* Subtitle & Back control */}
          <div className="flex items-center justify-between mt-1">
            <DialogDescription>
              {summary?.subtitle ?? ""}
            </DialogDescription>

            {history.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
            )}
          </div>

          {/* SR live region for announcements */}
          <div ref={liveRef} aria-live="polite" className="sr-only" />
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="mt-2">
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="log">Log History</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="ancestry">Ancestry</TabsTrigger>
            <TabsTrigger value="ai">AI Tools</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="pt-3">
             <div className="grid gap-4 md:grid-cols-2">
              <PlantPassportCard
                passport={summary?.plantPassport ?? derivePassport(summary)}
                onCopy={() => {
                  const p = summary?.plantPassport ?? derivePassport(summary);
                  const text = [
                    `EU Plant Passport`,
                    `A: ${p?.A_botanicalName ?? "—"}`,
                    `B: ${p?.B_regNumber ?? "—"}`,
                    `C: ${p?.C_traceabilityCode ?? "—"}`,
                    `D: ${p?.D_countryOfOrigin ?? "—"}`
                  ].join("\n");
                  navigator.clipboard.writeText(text).catch(() => {/* ignore */});
                  toast({ title: "Copied to clipboard" });
                }}
                onPrint={() => {
                  window.print();
                }}
              />
              {/* Other summary widgets go here */}
            </div>
          </TabsContent>

          <TabsContent value="log" className="pt-3">
            {/* <BatchLogHistory batchNumber={activeBatch} /> */}
          </TabsContent>

          <TabsContent value="photos" className="pt-3">
            {/* <BatchPhotos batchNumber={activeBatch} /> */}
          </TabsContent>

          <TabsContent value="ancestry" className="pt-3">
            <AncestryTab
              nodes={ancestry}
              currentBatchNumber={activeBatch}
              onOpenBatch={openBatchInDialog}
              loadingToId={loadingToId}
              stayOnAncestry={stayOnAncestry}
              onToggleStayOnAncestry={setStayOnAncestry}
            />
          </TabsContent>

          <TabsContent value="ai" className="pt-3">
            {/* <BatchAiTools batchNumber={activeBatch} /> */}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
