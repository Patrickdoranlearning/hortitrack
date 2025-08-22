// src/components/batch/NewBatchChooserDialog.tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NewBatchChooserDialog({
  open, onOpenChange
}: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Batch</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Link href="/production/batches/new/propagation">
            <Button className="w-full" size="lg">Propagation Batch</Button>
          </Link>
          <Link href="/production/batches/new/checkin">
            <Button className="w-full" variant="secondary" size="lg">Check-in Batch</Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
