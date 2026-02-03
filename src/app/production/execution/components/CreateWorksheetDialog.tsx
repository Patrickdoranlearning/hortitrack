"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2, FileSpreadsheet } from "lucide-react";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/http/fetchJson";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedBatchIds: string[];
  onSuccess: () => void;
};

type CreateWorksheetResponse = {
  worksheet: {
    id: string;
    name: string;
  };
};

export function CreateWorksheetDialog({
  open,
  onOpenChange,
  selectedBatchIds,
  onSuccess,
}: Props) {
  const { toast } = useToast();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [scheduledDate, setScheduledDate] = React.useState<Date | undefined>();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Generate default name when dialog opens
  React.useEffect(() => {
    if (open && selectedBatchIds.length > 0) {
      const today = format(new Date(), "yyyy-MM-dd");
      setName(`Worksheet ${today}`);
      setDescription("");
      setScheduledDate(undefined);
    }
  }, [open, selectedBatchIds.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the worksheet.",
        variant: "destructive",
      });
      return;
    }

    if (selectedBatchIds.length === 0) {
      toast({
        title: "No batches selected",
        description: "Please select at least one batch.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetchJson<CreateWorksheetResponse>(
        "/api/production/execution-worksheets",
        {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            scheduledDate: scheduledDate ? format(scheduledDate, "yyyy-MM-dd") : undefined,
            batchIds: selectedBatchIds,
          }),
        }
      );

      toast({
        title: "Worksheet created",
        description: `"${response.worksheet.name}" with ${selectedBatchIds.length} batches.`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({
        title: "Failed to create worksheet",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Create Execution Worksheet
            </DialogTitle>
            <DialogDescription>
              Create a saved worksheet with{" "}
              <strong>{selectedBatchIds.length}</strong> selected batch
              {selectedBatchIds.length !== 1 ? "es" : ""}. You can print and
              track progress.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Worksheet Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Morning Propagation"
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Notes about this worksheet..."
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label>Scheduled Date (optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !scheduledDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduledDate}
                    onSelect={setScheduledDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Summary */}
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <div className="font-medium mb-1">Summary</div>
              <div className="text-muted-foreground">
                {selectedBatchIds.length} batch
                {selectedBatchIds.length !== 1 ? "es" : ""} will be added to
                this worksheet. Progress will be tracked automatically when
                batches are actualized.
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Worksheet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
