"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ActionForm } from "./ActionForm";
import type { Batch, NurseryLocation } from "@/lib/types";
import { fetchJson } from "@/lib/http";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultBatchIds: string[];
  locations: NurseryLocation[];
};

export function ActionDialog({ open, onOpenChange, defaultBatchIds, locations = [] }: Props) {
  const [localLocations, setLocalLocations] = React.useState(locations);
  const [loading, setLoading] = React.useState(!locations.length);
  const selectedBatch = { id: defaultBatchIds[0] } as Batch; // Simplified for the new form

  React.useEffect(() => {
    if (!open || locations.length) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { data: json } = await fetchJson<any>("/api/locations", { headers: { Accept: "application/json" } });
        const items = Array.isArray(json?.items) ? json.items : (Array.isArray(json) ? json : []);
        if (!cancelled) setLocalLocations(items);
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
            Apply an action to batch #{selectedBatch.batchNumber || selectedBatch.id}. Your changes will be logged.
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <p>Loading locations...</p>
        ) : (
          <ActionForm 
            batch={selectedBatch} 
            locations={localLocations}
            onCancel={() => onOpenChange(false)}
            onSuccess={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
