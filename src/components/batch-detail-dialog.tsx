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
  ClipboardList,
  Sprout,
  BarChart2,
  Trash2,
  Share2,
} from "lucide-react";
import type { Batch } from '@/lib/types';
import { ProductionProtocolDialog } from "./production-protocol-dialog";
import { CareRecommendationsDialog } from "./care-recommendations-dialog";
import { Badge } from "./ui/badge";
import { BatchChatDialog } from "./batch-chat-dialog";
import { BatchDistributionBar } from "./batch-distribution-bar";
import AncestryStrip from "./ancestry-strip";
import { PlantPassportCard } from "./batches/PlantPassportCard";

interface BatchDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: Batch | null;
  onEdit: (batch: Batch) => void;
  onTransplant: (batch: Batch) => void;
  onLogAction: (batch: Batch) => void;
  onGenerateProtocol: (batch: Batch) => void;
  onCareRecommendations: (batch: Batch) => void;
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
}: BatchDetailDialogProps) {

  const [isChatOpen, setIsChatOpen] = React.useState(false);

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
                  {batch.sourceType === "Purchase" && batch.id && (
                     <PlantPassportCard batchId={batch.id} />
                  )}
                </TabsContent>
                <TabsContent value="history">
                  <div className="max-h-60 overflow-y-auto text-sm space-y-2 mt-4">
                    {(batch.logHistory ?? []).slice().reverse().map((log, index) => (
                      <div key={index} className="flex justify-between">
                        <span>{log.note || `${log.type} action`}</span>
                        <span className="text-muted-foreground">
                          {new Date(log.date).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="ancestry">
                    <AncestryStrip currentId={batch.id!} />
                </TabsContent>
              </Tabs>
            </div>

            <div className="space-y-3 flex flex-col">
              <h4 className="font-semibold text-lg">Actions</h4>
              <Button onClick={() => onEdit(batch)} variant="outline"><Pencil /> Edit Batch</Button>
              <Button onClick={() => onTransplant(batch)} variant="outline" disabled={(batch.quantity ?? 0) === 0}><Sprout /> Transplant</Button>
              <Button onClick={() => onLogAction(batch)} variant="outline"><ClipboardList /> Log Action</Button>
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
