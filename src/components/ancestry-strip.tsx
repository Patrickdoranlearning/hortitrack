"use client";
import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type Mini = { id: string; batchNumber: string; plantVariety: string; plantFamily: string; size: string; supplier?: string|null; producedWeek?: string|null };

export default function AncestryStrip({ currentId }: { currentId: string }) {
  const [items, setItems] = useState<Mini[]>([]);
  const { toast } = useToast();

  useEffect(()=>{ 
    if (!currentId) return;
    (async ()=>{
      try {
        const res = await fetch(`/api/batches/${currentId}`);
        const j = await res.json();
        if (!res.ok) throw new Error(j.error?.message || "Failed to fetch ancestry");
        const arr = j?.data?.ancestry ?? [];
        setItems(arr);
      } catch (e: any) {
        toast({ variant: "destructive", title: "Failed to load ancestry", description: e.message });
      }
  })(); }, [currentId, toast]);

  if (!items.length) return <p className="text-sm text-muted-foreground">No ancestry data.</p>;

  return (
    <div className="flex items-stretch gap-3 overflow-x-auto py-2">
      {items.map((b, i)=>(
        <a key={b.id} href={`/?batch=${b.id}`} className="min-w-[220px]">
          <Card className="p-3 hover:border-primary transition h-full">
            <div className="text-xs text-muted-foreground">#{b.batchNumber}</div>
            <div className="font-medium">{b.plantVariety}</div>
            <div className="text-sm">{b.plantFamily} • {b.size}</div>
            {b.supplier && <div className="text-xs">Supplier: {b.supplier}</div>}
            {b.producedWeek && <div className="text-xs">Week: {b.producedWeek}</div>}
          </Card>
        </a>
      ))}
    </div>
  );
}
