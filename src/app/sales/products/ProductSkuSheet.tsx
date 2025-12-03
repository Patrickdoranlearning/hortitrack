"use client";

import { useTransition, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { createSkuAction } from "./actions";
import type { ProductSkuOption } from "./types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (sku: ProductSkuOption) => void;
};

const defaultForm = {
  code: "",
  displayName: "",
  description: "",
  barcode: "",
  vatRate: "13.5",
};

export default function ProductSkuSheet({ open, onOpenChange, onCreated }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState(defaultForm);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.barcode.trim()) {
      toast({ variant: "destructive", title: "Barcode required" });
      return;
    }
    startTransition(async () => {
      const result = await createSkuAction({
        code: form.code.trim() || undefined,
        displayName: form.displayName.trim(),
        description: form.description.trim() || undefined,
        barcode: form.barcode.trim(),
        vatRate: Number(form.vatRate),
      });
      if (!result.success) {
        toast({ variant: "destructive", title: "Failed to create SKU", description: result.error });
        return;
      }
      toast({ title: "SKU created" });
      const displayName = result.data.display_name || result.data.code;
      onCreated({
        id: result.data.id,
        code: result.data.code,
        label: displayName !== result.data.code ? `${displayName} • ${result.data.code}` : result.data.code,
        plantVarietyId: null,
        sizeId: null,
        defaultVatRate: result.data.default_vat_rate ?? null,
      });
      setForm(defaultForm);
      onOpenChange(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Create SKU</SheetTitle>
          <SheetDescription>Define reusable stock identifiers with barcodes.</SheetDescription>
        </SheetHeader>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label>SKU code (optional)</Label>
            <Input
              placeholder="auto-generated if empty"
              value={form.code}
              onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Display name</Label>
            <Input
              placeholder="e.g., Nursery SKU name"
              value={form.displayName}
              onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              rows={3}
              placeholder="e.g., General 1.5L Heather"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Barcode</Label>
            <Input
              required
              placeholder="Scan or type barcode"
              value={form.barcode}
              onChange={(event) => setForm((prev) => ({ ...prev, barcode: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Default VAT rate (%)</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={form.vatRate}
              onChange={(event) => setForm((prev) => ({ ...prev, vatRate: event.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create SKU"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

