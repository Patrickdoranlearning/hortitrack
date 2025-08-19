
"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ScannerClient from "@/components/Scanner/ScannerClient";
import { track } from "@/lib/telemetry";
import { getIdTokenOrNull } from "@/lib/auth/client";
import { useToast } from "@/hooks/use-toast";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDetected: (text: string) => void;
  onFound?: (batch: any) => void;
};

export default function ScanAndActDialog({ open, onOpenChange, onDetected, onFound }: Props) {
  const { toast } = useToast();

  async function handleDecoded(text: string) {
    onDetected(text);
    try {
      const idToken = await getIdTokenOrNull();
      const res = await fetch("/api/batches/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ code: text }),
      });
      if (res.ok) {
        const { batch, summary } = await res.json();
        track("scan_lookup_result", { result: "found", by: summary?.by ?? "unknown" });
        onFound?.(batch);
        onOpenChange(false);
      } else if (res.status === 404) {
        track("scan_lookup_result", { result: "not_found" });
        toast({ variant: 'destructive', title: 'Not Found', description: 'No batch found for the scanned code.' });
      } else {
        track("scan_lookup_result", { result: "error", status: res.status });
        toast({ variant: 'destructive', title: 'Error', description: 'An error occurred while looking up the batch.' });
      }
    } catch (e: any) {
      track("scan_lookup_result", { result: "error", message: e?.message });
      toast({ variant: 'destructive', title: 'Error', description: 'A network error occurred.' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan code</DialogTitle>
        </DialogHeader>

        {open && <ScannerClient onDecoded={handleDecoded} />}

      </DialogContent>
    </Dialog>
  );
}
