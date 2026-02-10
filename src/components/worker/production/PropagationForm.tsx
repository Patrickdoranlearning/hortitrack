"use client";

import * as React from "react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Sprout,
  MapPin,
  Calculator,
  Minus,
  Plus,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VarietyComboboxGrouped } from "@/components/ui/variety-combobox-grouped";
import { toast } from "@/lib/toast";
import { vibrateTap, vibrateSuccess, vibrateError } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { calculateTotalPlants } from "@/lib/shared";
import { MaterialsNeededCard } from "./MaterialsNeededCard";

interface Variety {
  id: string;
  name: string;
  family: string | null;
}

interface Size {
  id: string;
  name: string;
  cellMultiple: number;
  containerType: string | null;
}

interface Location {
  id: string;
  name: string;
  nurserySite: string | null;
}

interface PropagationFormProps {
  varieties: Variety[];
  sizes: Size[];
  locations: Location[];
  defaultLocationId?: string;
  onSuccess?: (batch: { id: string; batchNumber: string }) => void;
  onCancel?: () => void;
}

/**
 * Mobile-optimized propagation form.
 * Simplified single-page form for creating seed/cutting batches.
 */
export function PropagationForm({
  varieties,
  sizes,
  locations,
  defaultLocationId,
  onSuccess,
  onCancel,
}: PropagationFormProps) {
  const router = useRouter();

  // Form state
  const [varietyId, setVarietyId] = useState<string>("");
  const [sizeId, setSizeId] = useState<string>("");
  const [locationId, setLocationId] = useState<string>(defaultLocationId || "");
  const [containers, setContainers] = useState<number>(1);
  const [plantedAt, setPlantedAt] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Set default location when locations load
  useEffect(() => {
    if (!locationId && locations.length > 0) {
      setLocationId(defaultLocationId || locations[0].id);
    }
  }, [locations, locationId, defaultLocationId]);

  // Auto-select prop tray sizes first
  const sortedSizes = useMemo(() => {
    return [...sizes].sort((a, b) => {
      const aIsProp = a.containerType === "prop_tray";
      const bIsProp = b.containerType === "prop_tray";
      if (aIsProp && !bIsProp) return -1;
      if (!aIsProp && bIsProp) return 1;

      const aIsPlug = a.containerType === "plug_tray";
      const bIsPlug = b.containerType === "plug_tray";
      if (aIsPlug && !bIsPlug) return -1;
      if (!aIsPlug && bIsPlug) return 1;

      return a.name.localeCompare(b.name);
    });
  }, [sizes]);

  // Computed values
  const selectedVariety = useMemo(
    () => varieties.find((v) => v.id === varietyId),
    [varieties, varietyId]
  );

  const selectedSize = useMemo(
    () => sizes.find((s) => s.id === sizeId),
    [sizes, sizeId]
  );

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === locationId),
    [locations, locationId]
  );

  const cellMultiple = selectedSize?.cellMultiple ?? 1;
  const totalUnits = calculateTotalPlants(containers, cellMultiple);

  // Validation
  const isValid = varietyId && sizeId && locationId && containers > 0;

  // Handle quantity adjustment with large touch targets
  const incrementContainers = useCallback(() => {
    vibrateTap();
    setContainers((c) => c + 1);
  }, []);

  const decrementContainers = useCallback(() => {
    vibrateTap();
    setContainers((c) => Math.max(1, c - 1));
  }, []);

  // Submit
  const handleSubmit = useCallback(async () => {
    if (!isValid) return;

    vibrateTap();
    setSubmitting(true);

    try {
      const response = await fetch("/api/worker/production/propagate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plantVarietyId: varietyId,
          sizeId,
          locationId,
          containers,
          plantedAt: plantedAt || undefined,
          notes: notes || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create propagation");
      }

      vibrateSuccess();
      toast.success(`Batch ${result.batch.batchNumber} created with ${totalUnits.toLocaleString()} plants`);

      if (onSuccess) {
        onSuccess(result.batch);
      } else {
        router.push(`/worker/batches/${result.batch.id}`);
      }
    } catch (error) {
      vibrateError();
      const message =
        error instanceof Error ? error.message : "Failed to create propagation";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }, [
    isValid,
    varietyId,
    sizeId,
    locationId,
    containers,
    plantedAt,
    notes,
    totalUnits,
    router,
    onSuccess,
  ]);

  const handleCancel = useCallback(() => {
    vibrateTap();
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  }, [onCancel, router]);

  // Completion readiness indicator
  const readiness = [
    { label: "Variety", ok: Boolean(varietyId) },
    { label: "Size", ok: Boolean(sizeId) },
    { label: "Location", ok: Boolean(locationId) },
    { label: "Containers", ok: containers > 0 },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-background sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sprout className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-lg font-semibold">New Propagation</h1>
              <p className="text-xs text-muted-foreground">
                Start seeds or cuttings
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            {readiness.map((item) => (
              <div
                key={item.label}
                className={cn(
                  "w-2 h-2 rounded-full",
                  item.ok ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Form content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Variety selection */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Sprout className="h-4 w-4" />
              Variety
            </div>

            <VarietyComboboxGrouped
              varieties={varieties}
              value={varietyId}
              onSelect={setVarietyId}
              placeholder="Search varieties..."
              triggerClassName="min-h-[56px]"
            />

            {selectedVariety && (
              <div className="text-sm text-muted-foreground">
                Family: <span className="font-medium">{selectedVariety.family || "Unknown"}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Size and Location */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <MapPin className="h-4 w-4" />
              Tray Setup
            </div>

            <div>
              <Label>Size / Container</Label>
              <Select value={sizeId} onValueChange={setSizeId}>
                <SelectTrigger className="min-h-[56px] mt-1">
                  <SelectValue placeholder="Select a size" />
                </SelectTrigger>
                <SelectContent>
                  {sortedSizes.map((size) => (
                    <SelectItem key={size.id} value={size.id}>
                      <div className="flex flex-col items-start">
                        <div className="flex items-center gap-2">
                          <span>{size.name}</span>
                          {size.containerType === "prop_tray" && (
                            <Badge variant="secondary" className="text-xs">
                              Prop
                            </Badge>
                          )}
                        </div>
                        {size.containerType && (
                          <span className="text-xs text-muted-foreground">
                            {size.containerType}
                            {size.cellMultiple > 1 &&
                              ` - ${size.cellMultiple} cells`}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSize && (
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedSize.cellMultiple || 1} cells per container
                </p>
              )}
            </div>

            <div>
              <Label>Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger className="min-h-[56px] mt-1">
                  <SelectValue placeholder="Select a location" />
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
            </div>
          </CardContent>
        </Card>

        {/* Quantity */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Calculator className="h-4 w-4" />
              Quantity
            </div>

            {/* Large touch-friendly quantity input */}
            <div className="flex items-center justify-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-14 w-14"
                onClick={decrementContainers}
                disabled={containers <= 1}
              >
                <Minus className="h-6 w-6" />
              </Button>

              <div className="text-center min-w-[120px]">
                <Input
                  type="number"
                  value={containers}
                  onChange={(e) =>
                    setContainers(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  onFocus={(e) => e.target.select()}
                  className="text-center text-2xl font-bold h-14"
                  min={1}
                />
                <p className="text-xs text-muted-foreground mt-1">containers</p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-14 w-14"
                onClick={incrementContainers}
              >
                <Plus className="h-6 w-6" />
              </Button>
            </div>

            {selectedSize && (
              <div className="text-center">
                <span className="text-2xl font-bold text-primary">
                  {totalUnits.toLocaleString()}
                </span>
                <span className="text-muted-foreground ml-2">total plants</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Date and Notes */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Additional Details
            </div>

            <div>
              <Label>Planting Date</Label>
              <Input
                type="date"
                value={plantedAt}
                onChange={(e) => setPlantedAt(e.target.value)}
                className="min-h-[56px] mt-1"
              />
            </div>

            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Use bottom heat for first 48 hours"
                rows={3}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Materials preview */}
        {sizeId && totalUnits > 0 && (
          <MaterialsNeededCard sizeId={sizeId} quantity={totalUnits} />
        )}
      </div>

      {/* Bottom actions */}
      <div className="p-4 border-t bg-background sticky bottom-0 safe-area-inset-bottom">
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={submitting}
            className="flex-1 min-h-[56px]"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex-1 min-h-[56px]"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Create Batch
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PropagationForm;
