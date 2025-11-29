
"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ActionForm } from "./ActionForm";
import type { Batch, NurseryLocation } from "@/lib/types";
import { fetchJson } from "@/lib/http";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  batch: Batch | null;
  locations: NurseryLocation[];
};

export function ActionDialog({ open, onOpenChange, batch, locations = [] }: Props) {
  const [localLocations, setLocalLocations] = React.useState(locations);
  const [loading, setLoading] = React.useState(!locations.length);

  React.useEffect(() => {
    if (!open || locations.length) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const json = await fetchJson<any>("/api/catalog/locations");
        const items = Array.isArray(json) ? json : [];
        if (!cancelled) setLocalLocations(items.map((item: any) => ({id: item.value, name: item.label})));
      } catch (e) {
        console.error("[ActionDialog] load locations failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, locations.length]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Action</DialogTitle>
          <DialogDescription>
            {batch
              ? `Apply an action to batch #${batch.batchNumber ?? batch.id}.`
              : "Select a batch to log an action."}
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <p>Loading locations...</p>
        ) : !batch ? (
          <p className="text-sm text-muted-foreground">
            Select a batch to log an action.
          </p>
        ) : (
          <ActionForm 
            batch={batch} 
            locations={localLocations}
            onCancel={() => onOpenChange(false)}
            onSuccess={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
