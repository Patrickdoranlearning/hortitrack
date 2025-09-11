// src/components/checkin-dialog.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckinForm } from "./checkin-form";
import { CheckinFormInput } from "@/types/batch";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type CheckinDialogProps = {
  trigger?: React.ReactNode;
};

export function CheckinDialog({ trigger }: CheckinDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  async function onSubmit(values: CheckinFormInput) {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/batches/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to create batch.");
      }

      const batch = await res.json();
      toast({
        title: "Batch Created",
        description: `Batch #${batch.batchNumber} has been successfully checked in.`,
      });
      setOpen(false); // Close dialog on success
      router.push(`/?batch=${batch.id}`); // Navigate to the new batch
    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function onCancel() {
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button>New Check-in Batch</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>New Check-in Batch</DialogTitle>
          <DialogDescription>
            Fill in the details below to create a new check-in batch.
          </DialogDescription>
        </DialogHeader>
        <CheckinForm 
          onSubmit={onSubmit} 
          onCancel={onCancel} 
          isLoading={isLoading} 
          error={error} 
        />
      </DialogContent>
    </Dialog>
  );
}
