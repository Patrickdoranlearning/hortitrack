"use client";

import * as React from "react";
import { Minus, Plus, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PlantCountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expectedQuantity: number;
  startedAt: string | null;
  onComplete: (actualQuantity: number) => Promise<void>;
}

/**
 * Modal dialog for capturing plant count on task completion.
 * Features large number input with +/- buttons and productivity preview.
 */
export function PlantCountDialog({
  open,
  onOpenChange,
  expectedQuantity,
  startedAt,
  onComplete,
}: PlantCountDialogProps) {
  const [quantity, setQuantity] = React.useState(expectedQuantity);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset quantity when dialog opens
  React.useEffect(() => {
    if (open) {
      setQuantity(expectedQuantity);
      setError(null);
    }
  }, [open, expectedQuantity]);

  // Calculate estimated productivity
  const productivity = React.useMemo(() => {
    if (!startedAt || quantity <= 0) return null;

    const startTime = new Date(startedAt);
    const now = new Date();
    const durationMinutes = (now.getTime() - startTime.getTime()) / 1000 / 60;

    if (durationMinutes <= 0) return null;

    const plantsPerHour = Math.round((quantity / durationMinutes) * 60);
    const hours = Math.floor(durationMinutes / 60);
    const minutes = Math.round(durationMinutes % 60);

    return {
      plantsPerHour,
      durationDisplay: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
    };
  }, [startedAt, quantity]);

  const handleQuantityChange = (value: number) => {
    const newValue = Math.max(0, Math.min(99999, value));
    setQuantity(newValue);
    setError(null);
  };

  const handleIncrement = (amount: number) => {
    handleQuantityChange(quantity + amount);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "") {
      setQuantity(0);
    } else {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) {
        handleQuantityChange(parsed);
      }
    }
  };

  const handleSubmit = async () => {
    if (quantity <= 0) {
      setError("Please enter a valid plant count");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onComplete(quantity);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete task");
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Complete Task
          </DialogTitle>
          <DialogDescription>
            Enter the number of plants you processed.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {/* Main quantity input */}
          <div className="space-y-2">
            <Label htmlFor="plant-count" className="text-center block">
              Plants Processed
            </Label>
            <div className="flex items-center justify-center gap-3">
              {/* Decrement buttons */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-14 w-14 rounded-full"
                onClick={() => handleIncrement(-10)}
                disabled={quantity <= 0 || isSubmitting}
              >
                <span className="text-lg font-semibold">-10</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={() => handleIncrement(-1)}
                disabled={quantity <= 0 || isSubmitting}
              >
                <Minus className="h-5 w-5" />
              </Button>

              {/* Number input */}
              <Input
                id="plant-count"
                type="number"
                inputMode="numeric"
                value={quantity}
                onChange={handleInputChange}
                className="w-28 h-16 text-center text-2xl font-bold"
                disabled={isSubmitting}
              />

              {/* Increment buttons */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={() => handleIncrement(1)}
                disabled={isSubmitting}
              >
                <Plus className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-14 w-14 rounded-full"
                onClick={() => handleIncrement(10)}
                disabled={isSubmitting}
              >
                <span className="text-lg font-semibold">+10</span>
              </Button>
            </div>
          </div>

          {/* Expected vs actual comparison */}
          {expectedQuantity > 0 && quantity !== expectedQuantity && (
            <div className="text-center text-sm">
              <span className="text-muted-foreground">Expected: </span>
              <span className="font-medium">{expectedQuantity.toLocaleString()}</span>
              <span className="text-muted-foreground"> plants</span>
              {quantity > expectedQuantity && (
                <span className="ml-2 text-green-600">
                  (+{(quantity - expectedQuantity).toLocaleString()})
                </span>
              )}
              {quantity < expectedQuantity && (
                <span className="ml-2 text-amber-600">
                  ({(quantity - expectedQuantity).toLocaleString()})
                </span>
              )}
            </div>
          )}

          {/* Quick adjust buttons */}
          <div className="flex justify-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => handleQuantityChange(Math.round(expectedQuantity * 0.9))}
              disabled={isSubmitting}
            >
              90%
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => handleQuantityChange(expectedQuantity)}
              disabled={isSubmitting}
            >
              100%
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => handleQuantityChange(Math.round(expectedQuantity * 1.1))}
              disabled={isSubmitting}
            >
              110%
            </Button>
          </div>

          {/* Productivity preview */}
          {productivity && (
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">
                Time: {productivity.durationDisplay}
              </p>
              <p className="text-lg font-semibold">
                {productivity.plantsPerHour.toLocaleString()} plants/hour
              </p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="h-12 sm:h-10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={quantity <= 0 || isSubmitting}
            className="h-14 sm:h-10 text-lg sm:text-sm font-semibold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Completing...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Complete Task
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
