
"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HortiDialog } from "@/components/horti/HortiDialog";
import { ComboBoxEntity } from "@/components/horti/ComboBoxEntity";
import { BatchCheckInSchema, BatchCheckInInput } from "@/lib/validators/batchSchemas";
import { useActiveOrg } from "@/server/org/context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRODUCTION_PHASE, PRODUCTION_STATUS } from "@/lib/enums";
import { toast } from "@/components/ui/use-toast";

export function BatchCheckInDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void; }) {
  const orgId = useActiveOrg()!;
  const form = useForm<BatchCheckInInput>({
    resolver: zodResolver(BatchCheckInSchema),
    defaultValues: { check_in_date: new Date(), phase: "potting", status: "Growing", tray_qty: 1 },
    mode: "onChange",
  });

  const trayQty = form.watch("tray_qty") ?? 0;
  const sizeObj = (form.getValues() as any)?.size;
  const totalPreview = sizeObj?.cell_multiple ? trayQty * sizeObj.cell_multiple : trayQty;

  async function submit() {
    const values = form.getValues();
    const res = await fetch("/api/batches/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, orgId }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast({ variant: "destructive", title: "Check-in failed", description: data.error || "Unknown error" });
      return;
    }
    toast({ title: "Batch checked-in", description: `#${data.batch_number} (${data.quantity} plants)` });
    onOpenChange(false);
  }

  return (
    <HortiDialog
      title="Batch Check-In"
      description="Create a new batch on arrival; update location/status/phase; log check-in."
      open={open}
      onOpenChange={onOpenChange}
      onSubmit={submit}
      disablePrimary={!form.formState.isValid}
    >
      <div className="col-span-12 md:col-span-6">
        <ComboBoxEntity label="Variety" entity="varieties" value={null} onChange={(it) => form.setValue("plant_variety_id", it.id, { shouldValidate: true })} orgId={orgId} />
      </div>
      <div className="col-span-12 md:col-span-6">
        <ComboBoxEntity label="Size" entity="sizes" value={null} onChange={(it) => { form.setValue("size_id", it.id, { shouldValidate: true }); (form as any).setValue("size", it); }} orgId={orgId} />
      </div>
      <div className="col-span-12 md:col-span-6">
        <ComboBoxEntity label="Location" entity="locations" value={null} onChange={(it) => form.setValue("location_id", it.id, { shouldValidate: true })} orgId={orgId} />
      </div>
      <div className="col-span-12 md:col-span-6">
        <ComboBoxEntity label="Supplier (optional)" entity="suppliers" value={null} onChange={(it) => form.setValue("supplier_id", it?.id, { shouldValidate: true })} orgId={orgId} />
      </div>
      <div className="col-span-6">
        <Label>Status</Label>
        <Select value={form.watch("status")} onValueChange={(v) => form.setValue("status", v as any, { shouldValidate: true })}>
          <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
          <SelectContent>
            {PRODUCTION_STATUS.filter(s => s !== "Archived").map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-6">
        <Label>Phase</Label>
        <Select value={form.watch("phase")} onValueChange={(v) => form.setValue("phase", v as any, { shouldValidate: true })}>
          <SelectTrigger><SelectValue placeholder="Select phase" /></SelectTrigger>
          <SelectContent>
            {PRODUCTION_PHASE.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-4">
        <Label>Check-In Date</Label>
        <Input type="date" value={form.watch("check_in_date")?.toISOString?.().slice(0,10)} onChange={(e) => form.setValue("check_in_date", new Date(e.target.value))} />
      </div>
      <div className="col-span-4">
        <Label>Tray Quantity</Label>
        <Input type="number" min={1} value={trayQty} onChange={(e) => form.setValue("tray_qty", Number(e.target.value), { shouldValidate: true })} />
      </div>
      <div className="col-span-4">
        <Label>Total (preview)</Label>
        <Input readOnly value={Number.isFinite(totalPreview) ? totalPreview : ""} />
      </div>

      <div className="col-span-12">
        <Label>Note (optional)</Label>
        <Input placeholder="Any note for the log..." onChange={(e) => form.setValue("note", e.target.value)} />
      </div>

      <div className="col-span-12 grid grid-cols-12 gap-3 border rounded-lg p-3">
        <div className="col-span-12 text-sm font-medium">Supplier Plant Passport (optional)</div>
        <div className="col-span-6">
          <Label>A) Family/Genus/Species</Label>
          <Input onChange={(e) => form.setValue("passport_a", e.target.value)} />
        </div>
        <div className="col-span-6">
          <Label>B) Producer Code</Label>
          <Input onChange={(e) => form.setValue("passport_b", e.target.value)} />
        </div>
        <div className="col-span-6">
          <Label>C) Supplier Batch No.</Label>
          <Input onChange={(e) => form.setValue("passport_c", e.target.value)} />
        </div>
        <div className="col-span-6">
          <Label>D) Country Code</Label>
          <Input onChange={(e) => form.setValue("passport_d", e.target.value)} />
        </div>
      </div>
    </HortiDialog>
  );
}
