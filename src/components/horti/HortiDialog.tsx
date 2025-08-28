
"use client";
import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type HortiDialogProps = {
  title: string;
  description?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit?: () => void;
  primaryLabel?: string;
  secondaryLabel?: string;
  disablePrimary?: boolean;
  children: React.ReactNode;
};

export function HortiDialog({
  title, description, open, onOpenChange, onSubmit, primaryLabel = "Save", secondaryLabel = "Save & New", disablePrimary, children
}: HortiDialogProps) {

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && onSubmit) onSubmit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onSubmit]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] md:max-w-[760px] lg:max-w-[960px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="mt-2 grid grid-cols-12 gap-3">
          {children}
        </div>
        <DialogFooter className="gap-2">
          {secondaryLabel && <Button type="submit" variant="secondary" onClick={() => onSubmit?.()}>{secondaryLabel}</Button>}
          <Button type="submit" disabled={disablePrimary} onClick={() => onSubmit?.()}>{primaryLabel}</Button>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel (Esc)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
