"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { MapPin, Loader2, Search } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Location {
  id: string;
  name: string;
}

interface MoveLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  currentLocation: string | null;
  onSuccess: (message: string) => void;
}

export function MoveLocationDialog({
  open,
  onOpenChange,
  batchId,
  currentLocation,
  onSuccess,
}: MoveLocationDialogProps) {
  const { toast } = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fetch locations when dialog opens
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        setLoadingLocations(true);
        const response = await fetch("/api/catalog/locations");

        if (!response.ok) {
          throw new Error("Failed to load locations");
        }

        const data = await response.json();
        // Transform from {value, label} to {id, name}
        const locs: Location[] = data.map((loc: { value: string; label: string }) => ({
          id: loc.value,
          name: loc.label,
        }));
        setLocations(locs);
      } catch {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load locations",
        });
      } finally {
        setLoadingLocations(false);
      }
    };

    if (open) {
      fetchLocations();
    }
  }, [open, toast]);

  const filteredLocations = locations.filter((loc) =>
    loc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!selectedLocationId) {
      toast({
        variant: "destructive",
        title: "Select location",
        description: "Please select a destination location",
      });
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(`/api/worker/batches/${batchId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move",
          locationId: selectedLocationId,
          notes: notes.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to move batch");
      }

      const data = await response.json();
      onSuccess(data.message || "Batch moved successfully");

      // Reset form
      setSelectedLocationId(null);
      setNotes("");
      setSearchQuery("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Move failed",
        description: error instanceof Error ? error.message : "Failed to move batch",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      onOpenChange(false);
      setSelectedLocationId(null);
      setNotes("");
      setSearchQuery("");
    }
  };

  const selectedLocation = locations.find((l) => l.id === selectedLocationId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Move Batch
          </DialogTitle>
          <DialogDescription>
            Select a new location for this batch
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Current location */}
          {currentLocation && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">Current: </span>
              <span className="font-medium">{currentLocation}</span>
            </div>
          )}

          {/* Location search */}
          <div className="space-y-2">
            <Label>Destination</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search locations..."
                className="pl-9 h-12"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Location list */}
          <div className="max-h-[200px] overflow-y-auto border rounded-lg">
            {loadingLocations ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLocations.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No locations found
              </div>
            ) : (
              filteredLocations.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  className={cn(
                    "w-full px-4 py-3 text-left text-sm transition-colors",
                    "border-b last:border-b-0",
                    "focus:outline-none focus:bg-accent",
                    selectedLocationId === loc.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-accent"
                  )}
                  onClick={() => setSelectedLocationId(loc.id)}
                >
                  <div className="flex items-center gap-2">
                    <MapPin
                      className={cn(
                        "h-4 w-4 flex-shrink-0",
                        selectedLocationId === loc.id
                          ? "text-primary"
                          : "text-muted-foreground"
                      )}
                    />
                    <span className="truncate">{loc.name}</span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Selected location indicator */}
          {selectedLocation && (
            <div className="rounded-lg bg-primary/10 p-3 text-sm text-primary">
              <span className="font-medium">Moving to: </span>
              {selectedLocation.name}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="move-notes">Notes (optional)</Label>
            <Textarea
              id="move-notes"
              placeholder="Add any notes about this move..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
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
              disabled={!selectedLocationId || submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Moving...
                </>
              ) : (
                "Confirm Move"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
