"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/lib/toast";
import {
  Droplets,
  Scissors,
  Star,
  Loader2,
  Info,
} from "lucide-react";
import { logBatchHealthEvent, type BatchHealthEventInput } from "@/app/actions/batch-health";

// Simplified to only care actions
// - Treatment/Fertilizer: Use "Apply Treatment" flow (regulated, full compliance)
// - Readings (EC/pH): Use Scout Mode
type EventType = "irrigation" | "pruning" | "grading";

interface AddHealthLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  batchNumber?: string;
  onSuccess?: () => void;
}

const EVENT_TYPE_META: Record<EventType, { label: string; icon: React.ElementType; color: string; description: string }> = {
  irrigation: {
    label: "Irrigation",
    icon: Droplets,
    color: "text-blue-500",
    description: "Record watering activity"
  },
  pruning: {
    label: "Pruning",
    icon: Scissors,
    color: "text-amber-600",
    description: "Record pruning or trimming"
  },
  grading: {
    label: "Grading",
    icon: Star,
    color: "text-violet-600",
    description: "Record quality grading"
  },
};

export function AddHealthLogDialog({
  open,
  onOpenChange,
  batchId,
  batchNumber,
  onSuccess,
}: AddHealthLogDialogProps) {
  const [eventType, setEventType] = React.useState<EventType>("irrigation");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form state
  const [method, setMethod] = React.useState("Drip");
  const [notes, setNotes] = React.useState("");

  const resetForm = () => {
    setMethod("Drip");
    setNotes("");
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const input: BatchHealthEventInput = {
        batchId,
        eventType,
        notes: notes || undefined,
      };

      // Add type-specific fields
      if (eventType === "irrigation") {
        input.method = method;
      }
      // pruning and grading just use notes

      const result = await logBatchHealthEvent(input);

      if (result.success) {
        toast.success(`${EVENT_TYPE_META[eventType].label} recorded for batch`);
        resetForm();
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(result.error || "Failed to log event");
      }
    } catch (error) {
      toast.error(String(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Care Event</DialogTitle>
          <DialogDescription>
            Record a care activity for batch {batchNumber ? `#${batchNumber}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info about other flows */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p>For <strong>treatments</strong> or <strong>fertilizer</strong>, use the "Apply Treatment" button.</p>
              <p className="mt-1">For <strong>EC/pH readings</strong>, use Scout Mode.</p>
            </div>
          </div>

          {/* Event Type Selector */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Event Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(EVENT_TYPE_META) as [EventType, typeof EVENT_TYPE_META[EventType]][]).map(([type, meta]) => {
                const Icon = meta.icon;
                const isSelected = eventType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setEventType(type)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-muted hover:border-primary/50"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${isSelected ? meta.color : "text-muted-foreground"}`} />
                    <span className="text-xs font-medium">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Irrigation Form */}
          {eventType === "irrigation" && (
            <div>
              <Label htmlFor="irrMethod">Irrigation Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Drip">Drip</SelectItem>
                  <SelectItem value="Overhead">Overhead</SelectItem>
                  <SelectItem value="Hand Water">Hand Water</SelectItem>
                  <SelectItem value="Flood">Flood</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Pruning/Grading - just notes */}
          {(eventType === "pruning" || eventType === "grading") && (
            <div className="text-sm text-muted-foreground">
              {EVENT_TYPE_META[eventType].description}. Add details below.
            </div>
          )}

          {/* Notes - common to all */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Log Event"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddHealthLogDialog;
