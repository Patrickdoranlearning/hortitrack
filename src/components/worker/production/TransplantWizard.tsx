"use client";

import * as React from "react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Package,
  MapPin,
  Calculator,
  Minus,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/lib/toast";
import { vibrateTap, vibrateSuccess, vibrateError } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { calculateTotalPlants, calculateRemainder } from "@/lib/shared";
import { ParentBatchSelector, type ParentBatchOption } from "./ParentBatchSelector";
import { MaterialsNeededCard } from "./MaterialsNeededCard";

type Step = "parent" | "destination" | "quantity" | "confirm";

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

interface TransplantWizardProps {
  sizes: Size[];
  locations: Location[];
  defaultLocationId?: string;
  /** Pre-selected parent batch (e.g., from scan or batch detail) */
  initialParentBatch?: ParentBatchOption;
  onSuccess?: (childBatch: { id: string; batchNumber: string }) => void;
  onCancel?: () => void;
}

const STEPS: { id: Step; label: string }[] = [
  { id: "parent", label: "Source" },
  { id: "destination", label: "Destination" },
  { id: "quantity", label: "Quantity" },
  { id: "confirm", label: "Confirm" },
];

/**
 * Mobile-optimized transplant wizard.
 * Multi-step flow for creating a child batch from a parent batch.
 */
export function TransplantWizard({
  sizes,
  locations,
  defaultLocationId,
  initialParentBatch,
  onSuccess,
  onCancel,
}: TransplantWizardProps) {
  const router = useRouter();

  // State
  const [currentStep, setCurrentStep] = useState<Step>(
    initialParentBatch ? "destination" : "parent"
  );
  const [submitting, setSubmitting] = useState(false);

  // Form data
  const [parentBatch, setParentBatch] = useState<ParentBatchOption | null>(
    initialParentBatch || null
  );
  const [sizeId, setSizeId] = useState<string>("");
  const [locationId, setLocationId] = useState<string>(defaultLocationId || "");
  const [containers, setContainers] = useState<number>(1);
  const [notes, setNotes] = useState<string>("");
  const [writeOffRemainder, setWriteOffRemainder] = useState(false);
  const [archiveParentIfEmpty, setArchiveParentIfEmpty] = useState(true);

  // Set default location when locations load
  useEffect(() => {
    if (!locationId && locations.length > 0) {
      setLocationId(defaultLocationId || locations[0].id);
    }
  }, [locations, locationId, defaultLocationId]);

  // Set default size based on parent batch
  useEffect(() => {
    if (parentBatch && !sizeId) {
      // Find matching size by name if possible
      const matchingSize = sizes.find(
        (s) => s.name === parentBatch.sizeName
      );
      if (matchingSize) {
        setSizeId(matchingSize.id);
      }
    }
  }, [parentBatch, sizes, sizeId]);

  // Computed values
  const selectedSize = useMemo(
    () => sizes.find((s) => s.id === sizeId),
    [sizes, sizeId]
  );

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === locationId),
    [locations, locationId]
  );

  const cellMultiple = selectedSize?.cellMultiple ?? 1;
  const requiredUnits = calculateTotalPlants(containers, cellMultiple);
  const parentAvailable = parentBatch?.quantity ?? 0;
  const insufficient = requiredUnits > parentAvailable;
  const remainderUnits = calculateRemainder(parentAvailable, requiredUnits);

  // Step navigation
  const stepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const progressPercent = ((stepIndex + 1) / STEPS.length) * 100;

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case "parent":
        return !!parentBatch;
      case "destination":
        return !!sizeId && !!locationId;
      case "quantity":
        return containers > 0 && !insufficient;
      case "confirm":
        return true;
      default:
        return false;
    }
  }, [currentStep, parentBatch, sizeId, locationId, containers, insufficient]);

  const goNext = useCallback(() => {
    vibrateTap();
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  }, [stepIndex]);

  const goBack = useCallback(() => {
    vibrateTap();
    const prevIndex = stepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    } else if (onCancel) {
      onCancel();
    }
  }, [stepIndex, onCancel]);

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
    if (!parentBatch || !sizeId || !locationId || containers <= 0) {
      return;
    }

    vibrateTap();
    setSubmitting(true);

    try {
      const response = await fetch("/api/worker/production/transplant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentBatchId: parentBatch.id,
          sizeId,
          locationId,
          containers,
          notes: notes || undefined,
          archiveParentIfEmpty,
          writeOffRemainder: writeOffRemainder && remainderUnits > 0,
          remainderUnits: writeOffRemainder ? remainderUnits : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create transplant");
      }

      vibrateSuccess();
      toast.success(`Batch ${result.childBatch.batchNumber} created with ${requiredUnits.toLocaleString()} plants`);

      if (onSuccess) {
        onSuccess(result.childBatch);
      } else {
        router.push(`/worker/batches/${result.childBatch.id}`);
      }
    } catch (error) {
      vibrateError();
      const message = error instanceof Error ? error.message : "Failed to create transplant";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }, [
    parentBatch,
    sizeId,
    locationId,
    containers,
    notes,
    archiveParentIfEmpty,
    writeOffRemainder,
    remainderUnits,
    requiredUnits,
    router,
    onSuccess,
  ]);

  return (
    <div className="flex flex-col h-full">
      {/* Progress indicator */}
      <div className="px-4 py-3 border-b bg-background sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((step, idx) => (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-1 text-xs font-medium",
                idx <= stepIndex ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                  idx < stepIndex && "bg-primary text-primary-foreground",
                  idx === stepIndex && "bg-primary text-primary-foreground",
                  idx > stepIndex && "bg-muted"
                )}
              >
                {idx < stepIndex ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  idx + 1
                )}
              </div>
              <span className="hidden sm:inline">{step.label}</span>
            </div>
          ))}
        </div>
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Step 1: Select Parent Batch */}
        {currentStep === "parent" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="text-center mb-6">
              <Package className="h-12 w-12 mx-auto text-primary mb-2" />
              <h2 className="text-xl font-semibold">Select Parent Batch</h2>
              <p className="text-muted-foreground text-sm">
                Choose the batch you want to transplant from
              </p>
            </div>

            <Label>Parent Batch</Label>
            <ParentBatchSelector
              value={parentBatch}
              onChange={setParentBatch}
              placeholder="Search and select parent batch"
            />

            {parentBatch && (
              <Card className="mt-4">
                <CardContent className="p-4">
                  <h3 className="font-medium text-sm text-muted-foreground mb-2">
                    Selected Batch Details
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Variety:</span>
                      <p className="font-medium">
                        {parentBatch.varietyName || "Unknown"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Size:</span>
                      <p className="font-medium">
                        {parentBatch.sizeName || "Unknown"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Location:</span>
                      <p className="font-medium">
                        {parentBatch.locationName || "Unknown"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Available:</span>
                      <p className="font-medium text-primary">
                        {parentBatch.quantity.toLocaleString()} plants
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step 2: Destination */}
        {currentStep === "destination" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="text-center mb-6">
              <MapPin className="h-12 w-12 mx-auto text-primary mb-2" />
              <h2 className="text-xl font-semibold">Destination Setup</h2>
              <p className="text-muted-foreground text-sm">
                Choose size and location for the new batch
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Target Size / Container</Label>
                <Select value={sizeId} onValueChange={setSizeId}>
                  <SelectTrigger className="min-h-[56px]">
                    <SelectValue placeholder="Select a size" />
                  </SelectTrigger>
                  <SelectContent>
                    {sizes.map((size) => (
                      <SelectItem key={size.id} value={size.id}>
                        <div className="flex flex-col items-start">
                          <span>{size.name}</span>
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
              </div>

              <div>
                <Label>Destination Location</Label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger className="min-h-[56px]">
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
            </div>

            {selectedSize && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-medium text-sm text-muted-foreground mb-2">
                    Size Details
                  </h3>
                  <div className="flex justify-between text-sm">
                    <span>Cells per container:</span>
                    <span className="font-medium">
                      {selectedSize.cellMultiple || 1}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step 3: Quantity */}
        {currentStep === "quantity" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="text-center mb-6">
              <Calculator className="h-12 w-12 mx-auto text-primary mb-2" />
              <h2 className="text-xl font-semibold">Set Quantity</h2>
              <p className="text-muted-foreground text-sm">
                How many containers are you transplanting?
              </p>
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

            {/* Calculated units display */}
            <Card className="mt-4">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Plants per container:
                  </span>
                  <span className="font-medium">{cellMultiple}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total plants:</span>
                  <span
                    className={cn(
                      "font-bold text-lg",
                      insufficient ? "text-destructive" : "text-primary"
                    )}
                  >
                    {requiredUnits.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Available in parent:
                  </span>
                  <span className="font-medium">
                    {parentAvailable.toLocaleString()}
                  </span>
                </div>
                {!insufficient && remainderUnits > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Remainder after:
                    </span>
                    <span className="font-medium">
                      {remainderUnits.toLocaleString()}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {insufficient && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Not enough plants! The parent batch only has{" "}
                  {parentAvailable.toLocaleString()} plants available.
                </AlertDescription>
              </Alert>
            )}

            {/* Write-off remainder checkbox */}
            {!insufficient && remainderUnits > 0 && (
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <Checkbox
                  id="writeOff"
                  checked={writeOffRemainder}
                  onCheckedChange={(v) => setWriteOffRemainder(Boolean(v))}
                />
                <div className="flex-1">
                  <Label htmlFor="writeOff" className="text-sm font-medium">
                    Write off remainder ({remainderUnits.toLocaleString()} plants)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Log remaining plants as loss after transplant
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Confirm */}
        {currentStep === "confirm" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="text-center mb-6">
              <CheckCircle2 className="h-12 w-12 mx-auto text-primary mb-2" />
              <h2 className="text-xl font-semibold">Confirm Transplant</h2>
              <p className="text-muted-foreground text-sm">
                Review the details before creating
              </p>
            </div>

            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="pb-3 border-b">
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    From (Parent Batch)
                  </h3>
                  <p className="font-mono font-medium">
                    {parentBatch?.batchNumber}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {parentBatch?.varietyName}
                  </p>
                </div>

                <div className="pb-3 border-b">
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    To (New Child Batch)
                  </h3>
                  <p className="font-medium">{selectedSize?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedLocation?.nurserySite &&
                      `${selectedLocation.nurserySite} - `}
                    {selectedLocation?.name}
                  </p>
                </div>

                <div className="pb-3 border-b">
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Quantity
                  </h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-primary">
                      {requiredUnits.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground">plants</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {containers} container{containers !== 1 && "s"} x{" "}
                    {cellMultiple} per container
                  </p>
                </div>

                {writeOffRemainder && remainderUnits > 0 && (
                  <div className="pb-3 border-b">
                    <Badge variant="secondary">
                      {remainderUnits.toLocaleString()} plants will be written off
                    </Badge>
                  </div>
                )}

                <div>
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes about this transplant..."
                    rows={3}
                    className="mt-1"
                  />
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="archive"
                    checked={archiveParentIfEmpty}
                    onCheckedChange={(v) =>
                      setArchiveParentIfEmpty(Boolean(v))
                    }
                  />
                  <div className="flex-1">
                    <Label htmlFor="archive" className="text-sm font-medium">
                      Archive parent if empty
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically archive the parent batch if it reaches zero
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Materials preview */}
            {sizeId && requiredUnits > 0 && (
              <MaterialsNeededCard sizeId={sizeId} quantity={requiredUnits} />
            )}
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <div className="p-4 border-t bg-background sticky bottom-0 safe-area-inset-bottom">
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={submitting}
            className="flex-1 min-h-[56px]"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {stepIndex === 0 ? "Cancel" : "Back"}
          </Button>

          {currentStep === "confirm" ? (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
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
                  Create Transplant
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={goNext}
              disabled={!canProceed}
              className="flex-1 min-h-[56px]"
            >
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default TransplantWizard;
