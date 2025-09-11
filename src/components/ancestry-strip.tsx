"use client";
import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type Mini = {
  id: string;
  batchNumber: string;
  plantVariety: string;
  plantFamily: string;
  size: string;
  supplier?: string|null;
  producedWeek?: string|null;
};

export default function AncestryStrip({ currentId }: { currentId: string }) {
  const [items, setItems] = useState<Mini[]>([]);
  const { toast } = useToast();

  useEffect(() => { 
    if (!currentId) return;
    (async () => {
      try {
        const res = await fetch(`/api/batches/${currentId}`);
        const j = await res.json();
        if (!res.ok) throw new Error(j.error?.message || "Failed to fetch ancestry");
        const arr = j?.data?.ancestry ?? [];
        setItems(arr);
      } catch (e: any) {
        toast({ variant: "destructive", title: "Failed to load ancestry", description: e.message });
      }
    })(); 
  }, [currentId]); // Removed toast from dependency array
  
  // Render logic will go here
  return (
    <div className="flex items-center gap-2 overflow-x-auto p-2">
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          <Card className="p-2 text-sm shrink-0">
            <div className="font-bold">{item.batchNumber}</div>
            <div>{item.plantVariety}</div>
            <div className="text-xs text-muted-foreground">{item.size}</div>
          </Card>
          {index < items.length - 1 && <span className="text-muted-foreground">&rarr;</span>}
        </React.Fragment>
      ))}
      {items.length === 0 && <div className="text-sm text-muted-foreground">No ancestry data available.</div>}
    </div>
  );
}
