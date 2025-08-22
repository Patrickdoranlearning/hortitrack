// src/app/production/batches/new/propagation/page.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PropagationFormSchema, PropagationFormInput } from "@/types/batch";
import { calcUnitsFromTrays } from "@/lib/quantity";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PropagationPage() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);

  const form = useForm<PropagationFormInput>({
    resolver: zodResolver(PropagationFormSchema),
    defaultValues: {
      variety: "",
      sizeId: "",
      sizeMultiple: 104,
      fullTrays: 0,
      partialCells: 0,
      locationId: "",
      plantingDate: new Date().toISOString().slice(0,10),
    },
  });

  const watch = form.watch();
  const total = (() => {
    try {
      return calcUnitsFromTrays(watch.fullTrays || 0, watch.partialCells || 0, watch.sizeMultiple || 1);
    } catch {
      return 0;
    }
  })();

  async function onSubmit(values: PropagationFormInput) {
    setErr(null);
    const res = await fetch("/api/batches/propagation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "Failed");
      return;
    }
    const batch = await res.json();
    router.push(`/`); // or open dialog
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <Card>
        <CardHeader><CardTitle>New Propagation Batch</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}

          <div className="grid gap-2">
            <Label>Variety</Label>
            <Input {...form.register("variety")} placeholder="e.g., Veronica 'Blue'" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Size Multiple</Label>
              <Input type="number" {...form.register("sizeMultiple", { valueAsNumber: true })} />
            </div>
            <div className="grid gap-2">
              <Label>Full Trays</Label>
              <Input type="number" {...form.register("fullTrays", { valueAsNumber: true })} />
            </div>
            <div className="grid gap-2">
              <Label>Partial Cells</Label>
              <Input type="number" {...form.register("partialCells", { valueAsNumber: true })} />
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            Total Units: <span className="font-medium">{total}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Location</Label>
              <Input {...form.register("locationId")} placeholder="Tunnel ID" />
            </div>
            <div className="grid gap-2">
              <Label>Planting Date</Label>
              <Input type="date" {...form.register("plantingDate")} />
            </div>
          </div>

          <Button onClick={form.handleSubmit(onSubmit)}>Create Batch</Button>
        </CardContent>
      </Card>
    </div>
  );
}
