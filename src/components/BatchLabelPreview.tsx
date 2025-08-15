
// src/components/BatchLabelPreview.tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import LabelPreview from "./LabelPreview";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  batch: {
    id: string;
    batchNumber: string;
    plantVariety: string;
    plantFamily: string;
    size: string;
    initialQuantity: number;
  };
};

export default function BatchLabelPreview({ open, onOpenChange, batch }: Props) {
  
  const printToZebra = async () => {
    // fetch ZPL from server then POST to /api/labels/print
    const zplRes = await fetch(`/api/labels/batch/${batch.id}/zpl`);
    const zpl = await zplRes.text();
    const res = await fetch(`/api/labels/print`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ zpl, copies: 1 }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(`Print failed: ${j?.error || res.statusText}`);
    } else {
      onOpenChange(false);
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
                dataMatrixPayload={batch.id}
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
