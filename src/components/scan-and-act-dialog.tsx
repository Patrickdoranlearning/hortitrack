
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
};

export default function ScanAndActDialog({ open, onOpenChange, onDetected }: Props) {
  const { toast } = useToast();

  async function handleDecoded(text: string) {
    onDetected(text);
    try {
      // Intentionally not showing toasts here as the parent component (HomePageView) does.
      // This dialog's only job is to decode and pass the raw text up.
    } catch (e: any) {
      track("scan_lookup_result", { result: "error", message: e?.message });
      toast({ variant: 'destructive', title: 'Error', description: 'An unexpected client error occurred.' });
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
