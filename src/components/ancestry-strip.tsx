"use client";
import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Mini = {
  id: string;
  batchNumber?: string | number | null;
  plantVariety?: string | null;
  plantFamily?: string | null;
  size?: string | null;
  status?: string | null;
  quantity?: number | null;
  initialQuantity?: number | null;
};

type ResponseShape = {
  parents: Mini[];
  current: Mini | null;
  children: Mini[];
};

function MiniBatchCard({
  data,
  highlight,
  onSelect,
}: {
  data: Mini;
  highlight?: boolean;
  onSelect?: (id: string) => void;
}) {
  if (!data) return null;
  const clickable = typeof onSelect === "function";
  const body = (
    <Card
      className={cn(
        "min-w-[200px] shrink-0 p-3 text-sm transition",
        highlight ? "border-primary shadow" : "",
        clickable ? "cursor-pointer hover:border-primary/60" : ""
      )}
    >
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {highlight ? "Current batch" : "Batch"}
      </div>
      <div className="font-semibold text-base">
        #{data.batchNumber ?? "—"}
      </div>
      <div className="text-sm line-clamp-1">{data.plantVariety ?? "—"}</div>
      <div className="mt-1 text-xs text-muted-foreground">
        {data.size ?? "—"} • {data.status ?? "Unknown"}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Started</p>
          <p className="font-medium">
            {data.initialQuantity ?? data.quantity ?? 0}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Current</p>
          <p className="font-medium">{data.quantity ?? 0}</p>
        </div>
      </div>
    </Card>
  );

  if (!clickable) return body;
  return (
    <button
      type="button"
      onClick={() => onSelect?.(data.id)}
      className="shrink-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/60"
    >
      {body}
    </button>
  );
}

export default function AncestryStrip({
  currentId,
  onSelectBatch,
}: {
  currentId: string;
  onSelectBatch?: (id: string) => void;
}) {
  const [data, setData] = useState<ResponseShape | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!currentId) return;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/production/batches/${currentId}/ancestry`
        );
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "Failed to load ancestry");
        setData({
          parents: j.parents ?? [],
          current: j.current ?? null,
          children: j.children ?? [],
        });
      } catch (e: any) {
        toast({
          variant: "destructive",
          title: "Failed to load ancestry",
          description: e?.message ?? "Unknown error",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [currentId, toast]);

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto p-2">
        {[...Array(3)].map((_, idx) => (
          <Skeleton key={idx} className="h-24 w-[180px] rounded-xl" />
        ))}
      </div>
    );
  }

  if (!data || (!data.parents.length && !data.children.length && !data.current)) {
    return (
      <div className="text-sm text-muted-foreground">
        No ancestry data available.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 overflow-x-auto p-2">
      {data.parents.map((parent) => (
        <React.Fragment key={parent.id}>
          <MiniBatchCard data={parent} onSelect={onSelectBatch} />
          <span className="text-muted-foreground text-lg">→</span>
        </React.Fragment>
      ))}
      {data.current && (
        <MiniBatchCard
          data={data.current}
          highlight
          onSelect={onSelectBatch}
        />
      )}
      {data.children.length > 0 && data.current && (
        <span className="text-muted-foreground text-lg">→</span>
      )}
      {data.children.map((child, idx) => (
        <React.Fragment key={child.id}>
          <MiniBatchCard data={child} onSelect={onSelectBatch} />
          {idx < data.children.length - 1 && (
            <span className="text-muted-foreground text-lg">→</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
