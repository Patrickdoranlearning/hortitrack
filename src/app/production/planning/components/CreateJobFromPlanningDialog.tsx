"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Layers } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/http/fetchJson";
import type { PlanningBatch } from "@/lib/planning/types";

const PROCESS_TYPES = [
  { value: "potting", label: "Potting" },
  { value: "propagation", label: "Propagation" },
  { value: "transplant", label: "Transplant" },
  { value: "spacing", label: "Spacing" },
  { value: "other", label: "Other" },
] as const;

// Pre-generate static options
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
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedBatches: PlanningBatch[];
  onSuccess: () => void;
};

export function CreateJobFromPlanningDialog({ open, onOpenChange, selectedBatches, onSuccess }: Props) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = React.useState(false);

  // Calculate totals
  const totals = React.useMemo(() => ({
    count: selectedBatches.length,
    plants: selectedBatches.reduce((sum, b) => sum + b.quantity, 0),
  }), [selectedBatches]);

  // Generate suggested name from batches
  const suggestedName = React.useMemo(() => {
    if (selectedBatches.length === 0) return "";
    const varieties = [...new Set(selectedBatches.map((b) => b.varietyName).filter(Boolean))];
    if (varieties.length === 1) {
      return `${varieties[0]} - Week ${CURRENT_WEEK}`;
    }
    return `Mixed Batch Job - Week ${CURRENT_WEEK}`;
  }, [selectedBatches]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: suggestedName,
      description: "",
      processType: undefined,
      machine: "",
      location: "",
      scheduledWeek: CURRENT_WEEK,
      scheduledYear: CURRENT_YEAR,
    },
  });

  // Update name when batches change
  React.useEffect(() => {
    if (open && suggestedName) {
      form.setValue("name", suggestedName);
    }
  }, [open, suggestedName, form]);

  async function handleSubmit(values: FormValues) {
    if (selectedBatches.length === 0) return;

    setSubmitting(true);
    try {
      await fetchJson("/api/tasks/jobs", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          batchIds: selectedBatches.map((b) => b.id),
        }),
      });
      toast({ title: "Job created successfully" });
      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({
        title: "Failed to create job",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !submitting && onOpenChange(value)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Production Job</DialogTitle>
          <DialogDescription>
            Create a job from the {selectedBatches.length} selected ghost batch{selectedBatches.length !== 1 ? "es" : ""}.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Selected Batches Summary */}
            <div className="rounded-lg border bg-muted/50 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Selected Batches</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{totals.count} batches</Badge>
                  <Badge variant="outline">
                    <Layers className="mr-1 h-3 w-3" />
                    {totals.plants.toLocaleString()} plants
                  </Badge>
                </div>
              </div>
              <ScrollArea className="h-24">
                <div className="space-y-1 text-xs text-muted-foreground">
                  {selectedBatches.map((batch) => (
                    <div key={batch.id} className="flex justify-between">
                      <span>{batch.varietyName} · {batch.sizeName}</span>
                      <span>{batch.quantity.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

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

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={submitting}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || selectedBatches.length === 0}>
                {submitting ? "Creating..." : "Create Job"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


