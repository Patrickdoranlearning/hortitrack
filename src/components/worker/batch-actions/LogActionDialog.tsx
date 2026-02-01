"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Loader2, Droplets, Wheat, Eye } from "lucide-react";
import { SprayIcon } from "@/components/icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type ActionType = "spray" | "water" | "feed" | "observation";

const ACTION_CONFIG: Record<
  ActionType,
  {
    title: string;
    description: string;
    icon: React.ReactNode;
    showProduct: boolean;
    productLabel?: string;
    productPlaceholder?: string;
    notesRequired: boolean;
    notesPlaceholder: string;
    submitLabel: string;
  }
> = {
  spray: {
    title: "Log Spray",
    description: "Record a spray treatment applied to this batch",
    icon: <SprayIcon className="h-5 w-5" />,
    showProduct: true,
    productLabel: "Product Name",
    productPlaceholder: "e.g., Fungicide XYZ",
    notesRequired: false,
    notesPlaceholder: "Add any details about the application...",
    submitLabel: "Log Spray",
  },
  water: {
    title: "Log Watering",
    description: "Record that this batch has been watered",
    icon: <Droplets className="h-5 w-5" />,
    showProduct: false,
    notesRequired: false,
    notesPlaceholder: "Add any notes about watering...",
    submitLabel: "Log Watering",
  },
  feed: {
    title: "Log Feeding",
    description: "Record fertilizer or feed applied to this batch",
    icon: <Wheat className="h-5 w-5" />,
    showProduct: true,
    productLabel: "Feed/Fertilizer",
    productPlaceholder: "e.g., 20-20-20 NPK",
    notesRequired: false,
    notesPlaceholder: "Add any details about the feed...",
    submitLabel: "Log Feed",
  },
  observation: {
    title: "Log Observation",
    description: "Record a general observation about this batch",
    icon: <Eye className="h-5 w-5" />,
    showProduct: false,
    notesRequired: true,
    notesPlaceholder: "Describe what you observed...",
    submitLabel: "Log Observation",
  },
};

interface LogActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  actionType: ActionType;
  onSuccess: (message: string) => void;
}

export function LogActionDialog({
  open,
  onOpenChange,
  batchId,
  actionType,
  onSuccess,
}: LogActionDialogProps) {
  const { toast } = useToast();
  const [productName, setProductName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const config = ACTION_CONFIG[actionType];

  // Reset form when dialog opens or action type changes
  useEffect(() => {
    if (open) {
      setProductName("");
      setNotes("");
    }
  }, [open, actionType]);

  const handleSubmit = async () => {
    // Validate notes if required
    if (config.notesRequired && !notes.trim()) {
      toast({
        variant: "destructive",
        title: "Notes required",
        description: "Please add a note describing your observation",
      });
      return;
    }

    try {
      setSubmitting(true);

      const payload: Record<string, unknown> = {
        action: actionType,
      };

      if (config.showProduct && productName.trim()) {
        payload.productName = productName.trim();
      }

      if (notes.trim()) {
        payload.notes = notes.trim();
      }

      const response = await fetch(`/api/worker/batches/${batchId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to log ${actionType}`);
      }

      const data = await response.json();
      onSuccess(data.message || `${config.title} recorded`);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Log failed",
        description: error instanceof Error ? error.message : `Failed to log ${actionType}`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      onOpenChange(false);
      setProductName("");
      setNotes("");
    }
  };

  const isValid = !config.notesRequired || notes.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {config.icon}
            {config.title}
          </DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Timestamp info */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <span className="text-muted-foreground">Time: </span>
            <span className="font-medium">
              {new Date().toLocaleString("en-IE", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </div>

          {/* Product name (for spray and feed) */}
          {config.showProduct && (
            <div className="space-y-2">
              <Label htmlFor="product-name">{config.productLabel}</Label>
              <Input
                id="product-name"
                placeholder={config.productPlaceholder}
                className="h-12"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="action-notes">
              Notes {config.notesRequired ? "(required)" : "(optional)"}
            </Label>
            <Textarea
              id="action-notes"
              placeholder={config.notesPlaceholder}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 h-12"
              onClick={handleClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 h-12"
              onClick={handleSubmit}
              disabled={!isValid || submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Logging...
                </>
              ) : (
                config.submitLabel
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
