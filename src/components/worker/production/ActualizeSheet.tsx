"use client";

import * as React from "react";
import { useState, useCallback, useMemo } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Minus,
  Plus,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { vibrateTap, vibrateSuccess, vibrateError } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { MaterialsNeededCard } from "./MaterialsNeededCard";

interface GhostBatch {
  id: string;
  batchNumber: string;
  varietyName: string | null;
  sizeName: string | null;
  sizeId: string | null;
  locationId: string | null;
  locationName: string | null;
  plannedQuantity: number;
  status: string;
}

interface Location {
  id: string;
  name: string;
  nurserySite: string | null;
}

interface ActualizeSheetProps {
  batch: GhostBatch;
  locations: Location[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Mobile-optimized sheet for actualizing ghost (planned) batches.
 * Converts a planned batch to an active batch with actual quantities.
 */
export function ActualizeSheet({
  batch,
  locations,
  open,
  onOpenChange,
  onSuccess,
}: ActualizeSheetProps) {
  const { toast } = useToast();

  // Form state
  const [actualQuantity, setActualQuantity] = useState(batch.plannedQuantity);
  const [actualLocationId, setActualLocationId] = useState(batch.locationId || "");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset form when batch changes
  React.useEffect(() => {
    if (open) {
      setActualQuantity(batch.plannedQuantity);
      setActualLocationId(batch.locationId || "");
      setNotes("");
    }
  }, [open, batch]);

  // Computed values
  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === actualLocationId),
    [locations, actualLocationId]
  );

  const quantityDifference = actualQuantity - batch.plannedQuantity;
  const hasQuantityDifference = quantityDifference !== 0;
  const hasLocationChange = actualLocationId !== batch.locationId;

  // Quantity adjustment handlers
  const incrementQuantity = useCallback(() => {
    vibrateTap();
    setActualQuantity((q) => q + 1);
  }, []);

  const decrementQuantity = useCallback(() => {
    vibrateTap();
    setActualQuantity((q) => Math.max(0, q - 1));
  }, []);

  // Submit
  const handleSubmit = useCallback(async () => {
    if (actualQuantity <= 0) {
      toast({
        title: "Invalid quantity",
        description: "Actual quantity must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    vibrateTap();
    setSubmitting(true);

    try {
      const response = await fetch("/api/production/batches/actualize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batches: [
            {
              batch_id: batch.id,
              actual_quantity: actualQuantity,
              actual_location_id: actualLocationId || undefined,
              actual_date: new Date().toISOString().split("T")[0],
              notes: notes || undefined,
              size_id: batch.sizeId || undefined,
            },
          ],
          consume_materials: true,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to actualize batch");
      }

      vibrateSuccess();
      toast({
        title: "Batch actualized",
        description: `${batch.batchNumber} is now active with ${actualQuantity.toLocaleString()} plants`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      vibrateError();
      const message =
        error instanceof Error ? error.message : "Failed to actualize batch";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    batch,
    actualQuantity,
    actualLocationId,
    notes,
    toast,
    onOpenChange,
    onSuccess,
  ]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>Actualize Batch</SheetTitle>
          <SheetDescription>
            Convert planned batch to active production
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Batch info */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-mono text-sm font-medium">
                    {batch.batchNumber}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {batch.varietyName || "Unknown variety"}
                  </p>
                </div>
                <Badge variant="secondary">{batch.status}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Size:</span>
                  <p className="font-medium">{batch.sizeName || "Unknown"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Planned:</span>
                  <p className="font-medium">
                    {batch.plannedQuantity.toLocaleString()} plants
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actual quantity */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <Label>Actual Quantity</Label>

              <div className="flex items-center justify-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-14 w-14"
                  onClick={decrementQuantity}
                  disabled={actualQuantity <= 0}
                >
                  <Minus className="h-6 w-6" />
                </Button>

                <div className="text-center min-w-[140px]">
                  <Input
                    type="number"
                    value={actualQuantity}
                    onChange={(e) =>
                      setActualQuantity(Math.max(0, parseInt(e.target.value) || 0))
                    }
                    className="text-center text-2xl font-bold h-14"
                    min={0}
                  />
                  <p className="text-xs text-muted-foreground mt-1">plants</p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-14 w-14"
                  onClick={incrementQuantity}
                >
                  <Plus className="h-6 w-6" />
                </Button>
              </div>

              {hasQuantityDifference && (
                <div
                  className={cn(
                    "text-center text-sm",
                    quantityDifference > 0 ? "text-green-600" : "text-amber-600"
                  )}
                >
                  {quantityDifference > 0 ? "+" : ""}
                  {quantityDifference.toLocaleString()} from planned
                </div>
              )}
            </CardContent>
          </Card>

          {/* Location override */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <Label>Actual Location</Label>
                {hasLocationChange && (
                  <Badge variant="secondary" className="text-xs">
                    Changed
                  </Badge>
                )}
              </div>

              <Select
                value={actualLocationId}
                onValueChange={setActualLocationId}
              >
                <SelectTrigger className="min-h-[56px]">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.nurserySite && `${loc.nurserySite} - `}
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {batch.locationName && hasLocationChange && (
                <p className="text-xs text-muted-foreground">
                  Originally planned for: {batch.locationName}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about the actualization..."
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Materials preview */}
          {batch.sizeId && actualQuantity > 0 && (
            <MaterialsNeededCard
              sizeId={batch.sizeId}
              quantity={actualQuantity}
              compact
            />
          )}

          {/* Warning for zero quantity */}
          {actualQuantity === 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Setting quantity to 0 will mark this batch as failed. Consider
                adding notes explaining why.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <SheetFooter className="flex-row gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="flex-1 min-h-[56px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 min-h-[56px]"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Actualizing...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Actualize Batch
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default ActualizeSheet;
