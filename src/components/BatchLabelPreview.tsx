// src/components/BatchLabelPreview.tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import LabelPreview from "./LabelPreview";
import { useToast } from "@/hooks/use-toast";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  batch: {
    id: string;
    batchNumber: string;
    plantVariety: string;
    plantFamily: string;
    size: string;
    location?: string;
    initialQuantity: number;
    quantity: number;
  };
};

export default function BatchLabelPreview({ open, onOpenChange, batch }: Props) {
  const { toast } = useToast();

  const printToZebra = async () => {
    try {
      const res = await fetch(`/api/labels/print`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          batchNumber: batch.batchNumber,
          variety: batch.plantVariety,
          family: batch.plantFamily,
          quantity: batch.initialQuantity, // Usually print with initial quantity
          size: batch.size,
          location: batch.location,
          payload: `ht:batch:${batch.batchNumber}`, // Or batch.id
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || res.statusText);
      }
      
      toast({
        title: "Print Job Sent",
        description: "The label has been sent to the printer.",
      });
      onOpenChange(false);

    } catch (e: any) {
       toast({
        variant: "destructive",
        title: "Print Failed",
        description: e.message || "Could not connect to the printer.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-fit">
        <DialogHeader>
          <DialogTitle>Print Label • Batch #{batch.batchNumber}</DialogTitle>
        </DialogHeader>

        <div className="mx-auto my-4 scale-125">
            <LabelPreview 
                batchNumber={batch.batchNumber}
                variety={batch.plantVariety}
                family={batch.plantFamily}
                quantity={batch.initialQuantity}
                size={batch.size}
                location={batch.location}
                dataMatrixPayload={`ht:batch:${batch.batchNumber}`}
            />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={printToZebra}>Print</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
