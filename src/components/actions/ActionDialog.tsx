
"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ActionForm } from "./ActionForm";
import { ActionMode, ACTION_MODE_LABELS } from "./types";
import type { Batch, NurseryLocation } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  batch: Batch | null;
  locations: NurseryLocation[];
  mode: ActionMode;
  onSuccess?: () => void;
};

export function ActionDialog({ open, onOpenChange, batch, locations = [], mode, onSuccess }: Props) {
  const resolvedLocations = React.useMemo(() => locations ?? [], [locations]);
  const hasLocations = resolvedLocations.length > 0;

  // Defensive: ensure mode is valid
  const safeMode = mode && ACTION_MODE_LABELS[mode] ? mode : "MOVE";
  const modeConfig = ACTION_MODE_LABELS[safeMode];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" aria-describedby="action-dialog-description">
        <DialogHeader>
          <DialogTitle>{modeConfig.title}</DialogTitle>
          <DialogDescription id="action-dialog-description">
            {modeConfig.description}
          </DialogDescription>
        </DialogHeader>
        
        {!batch ? (
          <p className="text-sm text-muted-foreground">
            Select a batch to log an action.
          </p>
        ) : !hasLocations ? (
          <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground space-y-2">
            <p>No nursery locations available.</p>
            <p>Add locations under Settings → Locations so moves can be logged.</p>
          </div>
        ) : (
          <ActionForm
            batch={batch}
            locations={resolvedLocations}
            mode={safeMode}
            onCancel={() => onOpenChange(false)}
            onSuccess={() => {
              onOpenChange(false);
              onSuccess?.();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
