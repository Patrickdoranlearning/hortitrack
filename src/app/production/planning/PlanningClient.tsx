"use client";

import * as React from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ModulePageHeader } from "@/ui/layout/ModulePageHeader";
import { PlanningTimeline } from "./components/PlanningTimeline";
import { IncomingBatchDialog } from "./components/IncomingBatchDialog";
import { FutureAllocationDialog } from "./components/FutureAllocationDialog";
import { ProtocolDrawer } from "./components/ProtocolDrawer";
import type { PlanningSnapshot, ProtocolSummary } from "@/lib/planning/types";
import { Badge } from "@/components/ui/badge";
import { fetchJson } from "@/lib/http/fetchJson";
import { format } from "date-fns";

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

  const {
    data: snapshot = initialSnapshot,
    mutate: refreshSnapshot,
    isValidating: snapshotLoading,
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
              <CardTitle>Ghost batches</CardTitle>
              <CardDescription>
                Incoming deliveries and planned batches awaiting execution.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {ghostBatches.length === 0 && (
                <p className="text-sm text-muted-foreground">No ghost batches scheduled.</p>
              )}
              {ghostBatches.map((batch) => (
                <div key={batch.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">
                        {batch.varietyName ?? "Variety"} · {batch.sizeName ?? "Size"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Ready {formatDate(batch.readyDate)} · {batch.quantity} units
                      </div>
                    </div>
                    <Badge variant="outline">{batch.status}</Badge>
                  </div>
                  {batch.parentBatchId && (
                    <p className="text-xs text-muted-foreground mt-1">
                      From {batch.parentBatchId.slice(0, 8)} · Protocol {batch.protocolId ?? "—"}
                    </p>
                  )}
                </div>
              ))}
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

