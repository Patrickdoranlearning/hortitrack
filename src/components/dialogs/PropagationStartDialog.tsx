
"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HortiDialog } from "@/components/horti/HortiDialog";
import { ComboBoxEntity } from "@/components/horti/ComboBoxEntity";
import { PropagationStartSchema, PropagationStartInput } from "@/lib/validators/batchSchemas";
import { useActiveOrg } from "@/server/org/context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";

export function PropagationStartDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void; }) {
  const orgId = useActiveOrg()!;
  const form = useForm<PropagationStartInput>({
    resolver: zodResolver(PropagationStartSchema),
    defaultValues: { planted_at: new Date(), initial_tray_qty: 1 },
    mode: "onChange",
  });

  const size = form.watch("size_id") as any;
  const trayQty = form.watch("initial_tray_qty") ?? 0;
  const cellMultiple = (form.getValues() as any)?.size?.cell_multiple ?? null; // if you store selected object
  const totalPreview = cellMultiple ? trayQty * cellMultiple : trayQty;

  async function submit() {
    const values = form.getValues();
    const res = await fetch("/api/batches/propagation-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, orgId }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast({ variant: "destructive", title: "Failed to create batch", description: data.error || "Unknown error" });
      return;
    }
    toast({ title: "Batch created", description: `#${data.batch_number} (${data.quantity} plants)` });
    onOpenChange(false);
  }

  return (
    <HortiDialog
      title="Propagation Start"
      description="Fast-create a propagation batch. Quantity is tray qty × cell multiplier."
      open={open}
      onOpenChange={onOpenChange}
      onSubmit={submit}
      disablePrimary={!form.formState.isValid}
    >
      <div className="col-span-12 md:col-span-6">
        <ComboBoxEntity
          label="Variety"
          entity="varieties"
          value={null}
          onChange={(it) => form.setValue("plant_variety_id", it.id, { shouldValidate: true })}
          orgId={orgId}
          placeholder="Search variety"
        />
      </div>
      <div className="col-span-12 md:col-span-6">
        <ComboBoxEntity
          label="Size"
          entity="sizes"
          trayOnly
          value={null}
          onChange={(it) => {
            form.setValue("size_id", it.id, { shouldValidate: true });
            (form as any).setValue("size", it);
          }}
          orgId={orgId}
          placeholder="Search tray size"
        />
      </div>
      <div className="col-span-12 md:col-span-6">
        <ComboBoxEntity
          label="Location"
          entity="locations"
          value={null}
          onChange={(it) => form.setValue("location_id", it.id, { shouldValidate: true })}
          orgId={orgId}
          placeholder="Select location"
        />
      </div>
      <div className="col-span-12 md:col-span-6">
        <ComboBoxEntity
          label="Supplier (optional)"
          entity="suppliers"
          value={null}
          onChange={(it) => form.setValue("supplier_id", it?.id, { shouldValidate: true })}
          orgId={orgId}
          placeholder="Default: Doran Nurseries"
        />
      </div>
      <div className="col-span-6">
        <Label>Planted Date</Label>
        <Input type="date" value={form.watch("planted_at")?.toISOString?.().slice(0,10)} onChange={(e) => form.setValue("planted_at", new Date(e.target.value))} />
      </div>
      <div className="col-span-3">
        <Label>Tray Quantity</Label>
        <Input type="number" min={1} value={trayQty} onChange={(e) => form.setValue("initial_tray_qty", Number(e.target.value), { shouldValidate: true })} />
      </div>
      <div className="col-span-3">
        <Label>Total (preview)</Label>
        <Input readOnly value={Number.isFinite(totalPreview) ? totalPreview : ""} />
      </div>
    </HortiDialog>
  );
}
