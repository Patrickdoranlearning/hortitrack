// src/components/BatchLabelPreview.tsx
"use client";

import { useEffect, useRef } from "react";
import bwipjs from "bwip-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    // draw Data Matrix
    try {
      bwipjs.toCanvas(canvas, {
        bcid: "datamatrix",
        text: batch.id,          // keep synced with server payload
        scale: 3,                // module size
        padding: 0,
        // datamatrix params are auto by bwip-js – keep short payloads for reliability
      });
    } catch (err) {
      console.error("bwip-js error", err);
    }
  }, [open, batch.id]);

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
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Print Label • Batch #{batch.batchNumber}</DialogTitle>
        </DialogHeader>

        {/* 50×70mm preview box (203 dpi ~ 400×560 dots) */}
        <div className="mx-auto border rounded bg-white p-3"
             style={{ width: 300, height: 420 }}>
          <div className="grid grid-cols-[1fr_auto] gap-8">
            <div className="space-y-1 text-sm">
              <div className="font-semibold">Batch #{batch.batchNumber}</div>
              <div>Variety: {batch.plantVariety}</div>
              <div>Family: {batch.plantFamily}</div>
              <div>Size: {batch.size}</div>
              <div>Qty: {batch.initialQuantity}</div>
            </div>
            <canvas ref={canvasRef} width={140} height={140} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={printToZebra}>Print</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
