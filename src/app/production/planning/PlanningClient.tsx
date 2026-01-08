"use client";

import * as React from "react";
import useSWR from "swr";
import { Check, Briefcase, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ModulePageHeader } from '@/ui/templates';
import { PlanningTimeline } from "./components/PlanningTimeline";
import { IncomingBatchDialog } from "./components/IncomingBatchDialog";
import { FutureAllocationDialog } from "./components/FutureAllocationDialog";
import { ProtocolDrawer } from "./components/ProtocolDrawer";
import { CreateJobFromPlanningDialog } from "./components/CreateJobFromPlanningDialog";
import { BatchCheckInDialog } from "@/components/dialogs/BatchCheckInDialog";
import type { IncomingBatchData } from "@/components/production/checkin";
import type { PlanningSnapshot, ProtocolSummary } from "@/lib/planning/types";
import { Badge } from "@/components/ui/badge";
import { fetchJson } from "@/lib/http/fetchJson";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Props = {
  initialSnapshot: PlanningSnapshot;
  initialProtocols: ProtocolSummary[];
};

const planningFetcher = (url: string) => fetchJson<PlanningSnapshot>(url);
const protocolFetcher = (url: string) =>
  fetchJson<{ protocols: ProtocolSummary[] }>(url).then((res) => res.protocols);

export default function PlanningClient({ initialSnapshot, initialProtocols }: Props) {
  const [incomingOpen, setIncomingOpen] = React.useState(false);
  const [allocationOpen, setAllocationOpen] = React.useState(false);
  const [protocolOpen, setProtocolOpen] = React.useState(false);
  const [createJobOpen, setCreateJobOpen] = React.useState(false);
  const [checkInOpen, setCheckInOpen] = React.useState(false);
  const [checkInBatch, setCheckInBatch] = React.useState<IncomingBatchData | null>(null);
  const [selectedBatchIds, setSelectedBatchIds] = React.useState<Set<string>>(new Set());

  const {
    data: snapshot = initialSnapshot,
    mutate: refreshSnapshot,
  } = useSWR("/api/production/planning", planningFetcher, {
    fallbackData: initialSnapshot,
  });

  const {
    data: protocols = initialProtocols,
    mutate: refreshProtocols,
    isValidating: protocolsLoading,
  } = useSWR("/api/production/protocols", protocolFetcher, {
    fallbackData: initialProtocols,
  });

  const ghostBatches = (snapshot?.batches ?? []).filter((batch) => batch.isGhost);
  const physicalBatches = (snapshot?.batches ?? []).filter((batch) => !batch.isGhost);

  const toggleBatchSelection = React.useCallback((batchId: string) => {
    setSelectedBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  }, []);

  const clearBatchSelection = React.useCallback(() => {
    setSelectedBatchIds(new Set());
  }, []);

  const selectedBatches = ghostBatches.filter((b) => selectedBatchIds.has(b.id));

  // Open check-in wizard for an incoming batch
  const handleCheckInBatch = React.useCallback((batch: typeof ghostBatches[0]) => {
    const incomingData: IncomingBatchData = {
      id: batch.id,
      batchNumber: batch.batchNumber ?? undefined,
      plantVarietyId: batch.varietyId ?? '',
      varietyName: batch.varietyName ?? undefined,
      sizeId: batch.sizeId ?? '',
      sizeName: batch.sizeName ?? undefined,
      supplierId: batch.supplierId ?? undefined,
      supplierName: batch.supplierName ?? undefined,
      expectedQuantity: batch.quantity,
      expectedDate: batch.readyDate ?? undefined,
      locationId: batch.locationId ?? undefined,
      locationName: batch.locationName ?? undefined,
      phase: batch.phase ?? undefined,
    };
    setCheckInBatch(incomingData);
    setCheckInOpen(true);
  }, []);

  return (
    <>
      <div className="space-y-6">
        <ModulePageHeader
          title="Production planning"
          description="Look ahead, assign protocols, and stage incoming stock."
          actionsSlot={
            <>
              <Button variant="outline" onClick={() => setIncomingOpen(true)}>
                Plan incoming batch
              </Button>
              <Button variant="outline" onClick={() => setAllocationOpen(true)}>
                Plan Batch
              </Button>
              <Button onClick={() => setProtocolOpen(true)}>New recipe</Button>
            </>
          }
        />

        <div className="grid gap-6 lg:grid-cols-[3fr,2fr]">
          <Card>
            <CardHeader>
              <CardTitle>Sales forecast vs production</CardTitle>
              <CardDescription>
                Includes physical, incoming, and planned batches over the next 12 months.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PlanningTimeline snapshot={snapshot} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Ghost batches</CardTitle>
                  <CardDescription>
                    Incoming deliveries and planned batches awaiting execution.
                  </CardDescription>
                </div>
                {selectedBatchIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {selectedBatchIds.size} selected
                    </Badge>
                    <Button
                      size="sm"
                      onClick={() => setCreateJobOpen(true)}
                    >
                      <Briefcase className="mr-1.5 h-4 w-4" />
                      Create Job
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={clearBatchSelection}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {ghostBatches.length === 0 && (
                <p className="text-sm text-muted-foreground">No ghost batches scheduled.</p>
              )}
              {ghostBatches.length > 0 && selectedBatchIds.size === 0 && (
                <p className="text-xs text-muted-foreground mb-2">
                  Click batches to select them for job creation.
                </p>
              )}
              {ghostBatches.map((batch) => {
                const isSelected = selectedBatchIds.has(batch.id);
                const isIncoming = batch.status === "Incoming";
                return (
                  <div
                    key={batch.id}
                    className={cn(
                      "border rounded-lg p-3 transition-colors",
                      isSelected && "border-primary bg-primary/5"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleBatchSelection(batch.id)}
                      className="w-full text-left hover:bg-muted/50 rounded-md -m-1 p-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                              isSelected
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-input"
                            )}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                          <div>
                            <div className="text-sm font-medium">
                              {batch.varietyName ?? "Variety"} · {batch.sizeName ?? "Size"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Ready {formatDate(batch.readyDate)} · {batch.quantity} units
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline">{batch.status}</Badge>
                      </div>
                      {batch.parentBatchId && (
                        <p className="text-xs text-muted-foreground mt-1 ml-7">
                          From {batch.parentBatchId.slice(0, 8)} · Protocol {batch.protocolId ?? "—"}
                        </p>
                      )}
                    </button>
                    {/* Check-in button for incoming batches */}
                    {isIncoming && (
                      <div className="mt-2 pt-2 border-t flex justify-end">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCheckInBatch(batch);
                          }}
                        >
                          <PackageCheck className="mr-1.5 h-4 w-4" />
                          Check In
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Production recipes</CardTitle>
            <CardDescription>Reusable routes for planning allocations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {protocolsLoading && <p className="text-sm text-muted-foreground">Refreshing protocols…</p>}
            {protocols.length === 0 && (
              <p className="text-sm text-muted-foreground">No recipes captured yet.</p>
            )}
            {protocols.map((protocol) => (
              <div key={protocol.id} className="border rounded-lg p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{protocol.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Target {protocol.targetVarietyName ?? "any variety"} · {protocol.route?.nodes.length ?? 0} stages
                    </p>
                  </div>
                  <Badge variant="outline">{protocol.isActive ? "Active" : "Paused"}</Badge>
                </div>
                {protocol.description && (
                  <p className="text-sm mt-2 text-muted-foreground">{protocol.description}</p>
                )}
                {protocol.route && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {protocol.route.nodes.map((node) => (
                      <Badge key={node.id} variant="secondary">
                        {node.label} · {node.durationDays ?? 0}d
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <IncomingBatchDialog
        open={incomingOpen}
        onOpenChange={setIncomingOpen}
        onSuccess={() => {
          refreshSnapshot();
        }}
      />
      <FutureAllocationDialog
        open={allocationOpen}
        onOpenChange={setAllocationOpen}
        parents={physicalBatches}
        protocols={protocols}
        onSuccess={() => {
          refreshSnapshot();
        }}
      />
      <ProtocolDrawer
        open={protocolOpen}
        onOpenChange={setProtocolOpen}
        onSuccess={() => {
          refreshProtocols();
        }}
      />
      <CreateJobFromPlanningDialog
        open={createJobOpen}
        onOpenChange={setCreateJobOpen}
        selectedBatches={selectedBatches}
        onSuccess={() => {
          refreshSnapshot();
          clearBatchSelection();
        }}
      />
      <BatchCheckInDialog
        open={checkInOpen}
        onOpenChange={(open) => {
          setCheckInOpen(open);
          if (!open) setCheckInBatch(null);
        }}
        incomingBatch={checkInBatch}
        onSuccess={() => {
          refreshSnapshot();
          setCheckInBatch(null);
        }}
      />
    </>
  );
}

function formatDate(value: string | null) {
  if (!value) return "TBC";
  try {
    return format(new Date(value), "dd MMM yyyy");
  } catch {
    return value;
  }
}

