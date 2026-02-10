"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Layers, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { JobBatch } from "@/server/production/jobs";

const PROCESS_TYPES = [
  { value: "potting", label: "Potting" },
  { value: "propagation", label: "Propagation" },
  { value: "transplant", label: "Transplant" },
  { value: "spacing", label: "Spacing" },
  { value: "other", label: "Other" },
] as const;

// Pre-generate static options (outside component to avoid re-creation)
const WEEK_OPTIONS = Array.from({ length: 52 }, (_, i) => ({
  value: i + 1,
  label: `Week ${i + 1}`,
}));

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2];

const CURRENT_WEEK = Math.ceil(
  (new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) /
    (7 * 24 * 60 * 60 * 1000)
);

const schema = z.object({
  name: z.string().min(1, "Job name is required"),
  description: z.string().optional(),
  processType: z.enum(["potting", "propagation", "transplant", "spacing", "other"]).optional(),
  machine: z.string().optional(),
  location: z.string().optional(),
  scheduledWeek: z.number().int().min(1).max(53).optional(),
  scheduledYear: z.number().int().optional(),
  batchIds: z.array(z.string()).min(1, "Select at least one batch"),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableBatches: JobBatch[];
  onSubmit: (values: FormValues) => Promise<void>;
};

export function CreateJobDialog({ open, onOpenChange, availableBatches, onSubmit }: Props) {
  const [submitting, setSubmitting] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  // Use local state for selections to avoid form.watch re-renders
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      processType: undefined,
      machine: "",
      location: "",
      scheduledWeek: CURRENT_WEEK,
      scheduledYear: CURRENT_YEAR,
      batchIds: [],
    },
  });

  // Reset selections when dialog closes
  React.useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
      setSearchQuery("");
      form.reset();
    }
  }, [open, form]);

  // Filter batches by search
  const filteredBatches = React.useMemo(() => {
    if (!searchQuery.trim()) return availableBatches;
    const q = searchQuery.toLowerCase();
    return availableBatches.filter(
      (b) =>
        b.varietyName?.toLowerCase().includes(q) ||
        b.batchNumber?.toLowerCase().includes(q) ||
        b.sizeName?.toLowerCase().includes(q)
    );
  }, [availableBatches, searchQuery]);

  // Calculate totals for selected batches
  const selectedTotals = React.useMemo(() => {
    const selected = availableBatches.filter((b) => selectedIds.has(b.batchId));
    return {
      count: selected.length,
      plants: selected.reduce((sum, b) => sum + b.quantity, 0),
    };
  }, [availableBatches, selectedIds]);

  const toggleBatch = React.useCallback((batchId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  }, []);

  const selectAll = React.useCallback(() => {
    setSelectedIds(new Set(filteredBatches.map((b) => b.batchId)));
  }, [filteredBatches]);

  const clearSelection = React.useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  async function handleSubmit(values: Omit<FormValues, "batchIds">) {
    if (selectedIds.size === 0) return;
    
    setSubmitting(true);
    try {
      await onSubmit({
        ...values,
        batchIds: Array.from(selectedIds),
      });
      form.reset();
      setSelectedIds(new Set());
      onOpenChange(false);
    } catch {
      // Job creation failed silently
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !submitting && onOpenChange(value)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Production Job</DialogTitle>
          <DialogDescription>
            Group ghost batches into a job that can be assigned to staff.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {/* Job Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Tunnel 3 Potting Week 7" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Process Type and Location */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="processType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Process Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PROCESS_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location/Tunnel</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Tunnel 3" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Machine */}
              <FormField
                control={form.control}
                name="machine"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Machine (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Potting Machine 1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Scheduled Week/Year */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="scheduledWeek"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scheduled Week</FormLabel>
                      <Select
                        onValueChange={(val) => field.onChange(parseInt(val, 10))}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select week" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {WEEK_OPTIONS.map((week) => (
                            <SelectItem key={week.value} value={week.value.toString()}>
                              {week.label}
                              {week.value === CURRENT_WEEK && " (current)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="scheduledYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year</FormLabel>
                      <Select
                        onValueChange={(val) => field.onChange(parseInt(val, 10))}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select year" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {YEAR_OPTIONS.map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea rows={2} placeholder="Any additional notes..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Batch Selection - NOT a FormField to avoid re-render issues */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Select Ghost Batches</label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={selectAll}
                      disabled={filteredBatches.length === 0}
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearSelection}
                      disabled={selectedIds.size === 0}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search batches..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Selection Summary */}
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="secondary">
                      {selectedTotals.count} batch{selectedTotals.count !== 1 ? "es" : ""} selected
                    </Badge>
                    <Badge variant="outline">
                      <Layers className="mr-1 h-3 w-3" />
                      {selectedTotals.plants.toLocaleString()} plants
                    </Badge>
                  </div>
                )}

                {/* Batch List */}
                <ScrollArea className="h-48 border rounded-md">
                  <div className="p-2 space-y-1">
                    {filteredBatches.length === 0 ? (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        {availableBatches.length === 0
                          ? "No ghost batches available"
                          : "No batches match your search"}
                      </div>
                    ) : (
                      filteredBatches.map((batch) => {
                        const isSelected = selectedIds.has(batch.batchId);
                        return (
                          <button
                            key={batch.batchId}
                            type="button"
                            className={cn(
                              "flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-muted/50 w-full text-left",
                              isSelected && "bg-primary/10"
                            )}
                            onClick={() => toggleBatch(batch.batchId)}
                          >
                            <div
                              className={cn(
                                "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                                isSelected
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-input"
                              )}
                            >
                              {isSelected && <Check className="h-3 w-3" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate">
                                  {batch.varietyName ?? "Unknown"}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {batch.status}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {batch.batchNumber} · {batch.sizeName} ·{" "}
                                {batch.quantity.toLocaleString()} plants
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>

                {/* Validation message */}
                {selectedIds.size === 0 && (
                  <p className="text-sm text-destructive">Select at least one batch</p>
                )}
              </div>
            </div>

            <DialogFooter className="border-t pt-4 mt-4">
              <Button
                type="button"
                variant="ghost"
                disabled={submitting}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || selectedIds.size === 0}>
                {submitting ? "Creating..." : "Create Job"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
