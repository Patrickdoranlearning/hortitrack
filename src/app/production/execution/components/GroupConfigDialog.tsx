"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { fetchJson } from "@/lib/http/fetchJson";
import type { PlanningBatch } from "@/lib/planning/types";
import type { ExecutionGroup, FilterCriteria } from "@/server/production/execution-groups";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: ExecutionGroup | null;
  onSaved: () => void;
  batches: PlanningBatch[];
};

const colorOptions = [
  { value: "#10B981", label: "Green" },
  { value: "#3B82F6", label: "Blue" },
  { value: "#8B5CF6", label: "Purple" },
  { value: "#F59E0B", label: "Amber" },
  { value: "#EF4444", label: "Red" },
  { value: "#6B7280", label: "Gray" },
];

const statusOptions = [
  { value: "Incoming", label: "Incoming" },
  { value: "Planned", label: "Planned" },
  { value: "Plugs/Liners", label: "Plugs/Liners" },
];

const phaseOptions = [
  { value: "propagation", label: "Propagation" },
  { value: "growing", label: "Growing" },
  { value: "finishing", label: "Finishing" },
];

export function GroupConfigDialog({ open, onOpenChange, group, onSaved, batches }: Props) {
  const [loading, setLoading] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [color, setColor] = React.useState("#3B82F6");
  const [selectedStatuses, setSelectedStatuses] = React.useState<string[]>([]);
  const [selectedPhases, setSelectedPhases] = React.useState<string[]>([]);

  // Reset form when dialog opens or group changes
  React.useEffect(() => {
    if (open) {
      if (group) {
        setName(group.name);
        setDescription(group.description ?? "");
        setColor(group.color ?? "#3B82F6");
        setSelectedStatuses(group.filterCriteria.statuses ?? []);
        setSelectedPhases(group.filterCriteria.phases ?? []);
      } else {
        setName("");
        setDescription("");
        setColor("#3B82F6");
        setSelectedStatuses([]);
        setSelectedPhases([]);
      }
    }
  }, [open, group]);

  // Preview matching batches
  const previewBatches = React.useMemo(() => {
    return batches.filter((batch) => {
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(batch.status)) {
        return false;
      }
      if (selectedPhases.length > 0) {
        if (!batch.phase || !selectedPhases.includes(batch.phase)) {
          return false;
        }
      }
      return true;
    });
  }, [batches, selectedStatuses, selectedPhases]);

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const togglePhase = (phase: string) => {
    setSelectedPhases((prev) =>
      prev.includes(phase) ? prev.filter((p) => p !== phase) : [...prev, phase]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    setLoading(true);
    try {
      const filterCriteria: FilterCriteria = {};
      if (selectedStatuses.length > 0) filterCriteria.statuses = selectedStatuses;
      if (selectedPhases.length > 0) filterCriteria.phases = selectedPhases;

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        color,
        filterCriteria,
      };

      if (group) {
        await fetchJson(`/api/production/execution-groups/${group.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await fetchJson("/api/production/execution-groups", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      onSaved();
    } catch (error) {
      console.error("Failed to save group:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{group ? "Edit Group" : "Create Group"}</DialogTitle>
          <DialogDescription>
            Configure the group name and filter criteria to define which batches appear.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Incoming Plants"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this group contains"
              rows={2}
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {colorOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setColor(opt.value)}
                  className={`h-8 w-8 rounded-full border-2 transition-all ${
                    color === opt.value ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: opt.value }}
                  title={opt.label}
                />
              ))}
            </div>
          </div>

          {/* Filter: Statuses */}
          <div className="space-y-2">
            <Label>Filter by Status</Label>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((opt) => (
                <Badge
                  key={opt.value}
                  variant={selectedStatuses.includes(opt.value) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleStatus(opt.value)}
                >
                  {opt.label}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Leave empty to include all statuses.
            </p>
          </div>

          {/* Filter: Phases */}
          <div className="space-y-2">
            <Label>Filter by Phase</Label>
            <div className="flex flex-wrap gap-2">
              {phaseOptions.map((opt) => (
                <Badge
                  key={opt.value}
                  variant={selectedPhases.includes(opt.value) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => togglePhase(opt.value)}
                >
                  {opt.label}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Leave empty to include all phases.
            </p>
          </div>

          {/* Preview */}
          <div className="space-y-2 pt-2 border-t">
            <Label>Preview</Label>
            <p className="text-sm text-muted-foreground">
              {previewBatches.length} batch{previewBatches.length !== 1 ? "es" : ""} match
              {previewBatches.length === 1 ? "es" : ""} this criteria
            </p>
            {previewBatches.length > 0 && previewBatches.length <= 5 && (
              <div className="text-xs text-muted-foreground space-y-1">
                {previewBatches.map((b) => (
                  <div key={b.id}>
                    {b.varietyName ?? "Unknown"} - {b.quantity} units ({b.status})
                  </div>
                ))}
              </div>
            )}
            {previewBatches.length > 5 && (
              <p className="text-xs text-muted-foreground">
                Showing first 5 of {previewBatches.length} batches...
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {group ? "Save Changes" : "Create Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
