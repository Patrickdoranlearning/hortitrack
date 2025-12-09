"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Pencil,
  Sprout,
  BarChart2,
  Trash2,
  Share2,
  Loader2,
} from "lucide-react";
import type { Batch } from '@/lib/types';
import { ProductionProtocolDialog } from "./production-protocol-dialog";
import { CareRecommendationsDialog } from "./care-recommendations-dialog";
import { Badge } from "./ui/badge";
import { BatchChatDialog } from "./batch-chat-dialog";
import { BatchDistributionBar } from "./batch-distribution-bar";
import AncestryStrip from "./ancestry-strip";
import { PlantPassportCard } from "./batches/PlantPassportCard";
import { ActionMenuButton } from "@/components/actions/ActionMenuButton";
import type { ActionMode } from "@/components/actions/types";

type BatchEvent = {
  id: string;
  type: string;
  at: string;
  created_at: string;
  by_user_id: string | null;
  payload: Record<string, any> | null;
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  DUMP: "Stock Dumped",
  MOVE: "Moved",
  MOVE_IN: "Received from Split",
  CHECKIN: "Check-in",
  NOTE: "Note Added",
  PROPAGATE: "Propagated",
  TRANSPLANT: "Transplanted",
  STATUS_CHANGE: "Status Changed",
  PICKED: "Picked for Order",
  SOLD: "Sold",
  ARCHIVE: "Archived",
};

interface BatchDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: Batch | null;
  onEdit: (batch: Batch) => void;
  onTransplant: (batch: Batch) => void;
  onLogAction: (batch: Batch, mode: ActionMode) => void;
  onGenerateProtocol: (batch: Batch) => void;
  onCareRecommendations: (batch: Batch) => void;
  onSelectRelatedBatch?: (batchId: string) => void;
}

export function BatchDetailDialog({
  open,
  onOpenChange,
  batch,
  onEdit,
  onTransplant,
  onLogAction,
  onGenerateProtocol,
  onCareRecommendations,
  onSelectRelatedBatch,
}: BatchDetailDialogProps) {

  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [events, setEvents] = React.useState<BatchEvent[]>([]);
  const [eventsLoading, setEventsLoading] = React.useState(false);
  const [eventsError, setEventsError] = React.useState<string | null>(null);

  // Fetch events when dialog opens or batch changes
  React.useEffect(() => {
    if (!open || !batch?.id) {
      setEvents([]);
      return;
    }

    let cancelled = false;
    setEventsLoading(true);
    setEventsError(null);

    fetch(`/api/production/batches/${batch.id}/events`)
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || res.statusText);
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setEvents(data.items || []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setEventsError(err?.message || String(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setEventsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, batch?.id]);

  const getStatusVariant = (status: Batch['status']): 'default' | 'secondary' | 'destructive' | 'outline' | 'accent' | 'info' => {
     switch (status) {
      case 'Ready for Sale':
      case 'Looking Good':
        return 'accent';
      case 'Propagation':
      case 'Plugs/Liners':
        return 'info';
      case 'Potted':
        return 'default';
      case 'Archived':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const distribution = React.useMemo(() => {
    if (!batch) return { inStock: 0, transplanted: 0, lost: 0 };

    let transplanted = 0;
    let lost = 0;

    (batch.logHistory ?? []).forEach(log => {
      if (log.type === 'TRANSPLANT_TO') {
        transplanted += log.qty || 0;
      }
      if (log.type === 'LOSS') {
        lost += Math.abs(log.qty || 0);
      }
    });
    
    // Ensure consistency: inStock should be what's left
    const inStock = (batch.initialQuantity ?? 0) - transplanted - lost;
    
    // Adjust if current quantity doesn't match calculation (e.g. from manual adjustments)
    if (inStock !== (batch.quantity ?? 0)) {
        lost += (inStock - (batch.quantity ?? 0));
    }
    
    return { inStock: (batch.quantity ?? 0), transplanted, lost };
  }, [batch]);


  if (!batch) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl grid-rows-[auto_1fr_auto] max-h-[90vh]">
          <DialogHeader>
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="font-headline text-3xl">{batch.plantVariety}</DialogTitle>
                <DialogDescription>
                  Batch #{batch.batchNumber} • {batch.plantFamily}
                </DialogDescription>
              </div>
               <Badge variant={getStatusVariant(batch.status)} className="text-sm">{batch.status}</Badge>
            </div>
          </DialogHeader>

          <div className="grid md:grid-cols-3 gap-6 overflow-y-auto pr-2 -mr-2">
            <div className="md:col-span-2 space-y-6">
              <Tabs defaultValue="summary">
                <TabsList>
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="history">Log History</TabsTrigger>
                  <TabsTrigger value="ancestry">Ancestry</TabsTrigger>
                </TabsList>
                <TabsContent value="summary" className="pt-4 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Location</p>
                      <p className="font-medium">{batch.location || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Size</p>
                      <p className="font-medium">{batch.size}</p>
                    </div>
                     <div>
                      <p className="text-muted-foreground">Planting Date</p>
                      <p className="font-medium">{new Date(batch.plantingDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Supplier</p>
                      <p className="font-medium">{batch.supplier || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Category</p>
                      <p className="font-medium">{batch.category}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Stock Distribution</p>
                    <BatchDistributionBar distribution={distribution} initialQuantity={batch.initialQuantity ?? 0} />
                  </div>
                  {batch.id && (
                    <PlantPassportCard batchId={batch.id} />
                  )}
                </TabsContent>
                <TabsContent value="history">
                  <div className="max-h-80 overflow-y-auto mt-4">
                    {eventsLoading && (
                      <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Loading events...
                      </div>
                    )}
                    {eventsError && (
                      <div className="text-sm text-red-600 py-4">{eventsError}</div>
                    )}
                    {!eventsLoading && !eventsError && events.length === 0 && (
                      <div className="text-muted-foreground py-4 text-center">No events logged yet.</div>
                    )}
                    {!eventsLoading && events.length > 0 && (
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-background border-b">
                          <tr className="text-left text-muted-foreground">
                            <th className="py-2 pr-2 font-medium w-28">Date</th>
                            <th className="py-2 px-2 font-medium">Event</th>
                            <th className="py-2 px-2 font-medium text-right w-20">Qty</th>
                            <th className="py-2 pl-2 font-medium">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {events.map((event) => {
                            const payload = typeof event.payload === "string" 
                              ? JSON.parse(event.payload) 
                              : event.payload;
                            const typeLabel = EVENT_TYPE_LABELS[event.type] || event.type;
                            
                            // Extract quantity from various payload fields
                            const qty = payload?.units_picked 
                              || payload?.units_dumped 
                              || payload?.units_moved 
                              || payload?.quantityActual
                              || payload?.quantity
                              || null;
                            
                            // Determine if this is a decrease (negative) event
                            const isDecrease = ["DUMP", "PICKED", "SOLD", "TRANSPLANT"].includes(event.type);
                            
                            // Build details string
                            const details: string[] = [];
                            if (payload?.to_location_name) details.push(`→ ${payload.to_location_name}`);
                            if (payload?.order_number) details.push(`Order #${payload.order_number}`);
                            if (payload?.customer_name) details.push(payload.customer_name);
                            if (payload?.reason) details.push(payload.reason);
                            if (payload?.status) details.push(`Status: ${payload.status}`);
                            if (payload?.notes) details.push(payload.notes);
                            
                            return (
                              <tr key={event.id} className="hover:bg-muted/30">
                                <td className="py-2 pr-2 text-muted-foreground whitespace-nowrap">
                                  {new Date(event.at || event.created_at).toLocaleDateString('en-GB', { 
                                    day: '2-digit', 
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </td>
                                <td className="py-2 px-2 font-medium">
                                  {typeLabel}
                                </td>
                                <td className={`py-2 px-2 text-right font-mono ${
                                  qty 
                                    ? isDecrease 
                                      ? 'text-red-600' 
                                      : 'text-green-600'
                                    : 'text-muted-foreground'
                                }`}>
                                  {qty ? (isDecrease ? `-${qty}` : `+${qty}`) : '—'}
                                </td>
                                <td className="py-2 pl-2 text-muted-foreground truncate max-w-[180px]" title={details.join(' · ')}>
                                  {details.join(' · ') || '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="ancestry">
                    <AncestryStrip
                      currentId={batch.id!}
                      onSelectBatch={(id) => onSelectRelatedBatch?.(id)}
                    />
                </TabsContent>
              </Tabs>
            </div>

            <div className="space-y-3 flex flex-col">
              <h4 className="font-semibold text-lg">Actions</h4>
              <Button onClick={() => onEdit(batch)} variant="outline"><Pencil /> Edit Batch</Button>
              <Button onClick={() => onTransplant(batch)} variant="outline" disabled={(batch.quantity ?? 0) === 0}><Sprout /> Transplant</Button>
              <ActionMenuButton batch={batch} onSelect={(mode) => onLogAction(batch, mode)} className="w-full" />
              <Button onClick={() => setIsChatOpen(true)} variant="outline"><Share2 /> Chat about Batch</Button>
              
              <div className="!mt-auto pt-4 border-t">
                  <h4 className="font-semibold text-lg mb-3">AI Tools</h4>
                  <div className="space-y-3">
                      <Button onClick={() => onCareRecommendations(batch)} variant="secondary" className="w-full justify-start"><BarChart2 /> Care Recommendations</Button>
                      <Button onClick={() => onGenerateProtocol(batch)} variant="secondary" className="w-full justify-start"><Trash2 /> Production Protocol</Button>
                  </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <BatchChatDialog 
        open={isChatOpen}
        onOpenChange={setIsChatOpen}
        batchId={batch?.id}
        batchNumber={batch?.batchNumber}
      />
    </>
  );
}
