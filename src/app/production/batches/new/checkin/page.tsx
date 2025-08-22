// src/app/production/batches/new/checkin/page.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckinFormSchema, CheckinFormInput } from "@/types/batch";
import { calcUnitsFromContainers } from "@/lib/quantity";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function CheckinPage() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);

  const form = useForm<CheckinFormInput>({
    resolver: zodResolver(CheckinFormSchema),
    defaultValues: {
      variety: "",
      sizeId: "",
      sizeMultiple: 1,
      phase: "Potted",
      containers: 0,
      totalUnits: 0,
      overrideTotal: false,
      locationId: "T21",
      incomingDate: new Date().toISOString().slice(0,10),
      supplierId: "",
      passportA: "",
      passportB: "",
      passportC: "",
      passportD: "IE",
      photos: [],
    },
  });

  const w = form.watch();
  const computedTotal = calcUnitsFromContainers(w.containers || 0, w.sizeMultiple || 1);

  async function onSubmit(values: CheckinFormInput) {
    setErr(null);
    const res = await fetch("/api/batches/checkin", {
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
    router.push(`/`);
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <Card>
        <CardHeader><CardTitle>New Check-in Batch</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}

          <div className="grid gap-2">
            <Label>Variety</Label>
            <Input {...form.register("variety")} />
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="grid gap-2">
              <Label>Size Multiple</Label>
              <Input type="number" {...form.register("sizeMultiple", { valueAsNumber: true })} />
            </div>
            <div className="grid gap-2">
              <Label>Containers</Label>
              <Input type="number" {...form.register("containers", { valueAsNumber: true })} />
            </div>
            <div className="grid gap-2">
              <Label>Total Units</Label>
              <Input
                type="number"
                disabled={!w.overrideTotal}
                {...form.register("totalUnits", { valueAsNumber: true })}
              />
            </div>
            <div className="grid gap-2">
              <Label className="flex items-center gap-2">Manual Override <Switch checked={w.overrideTotal} onCheckedChange={(v)=>form.setValue("overrideTotal", v)} /></Label>
            </div>
          </div>

          {!w.overrideTotal ? (
            <div className="text-sm text-muted-foreground">
              Total Units (auto): <span className="font-medium">{computedTotal}</span>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Location</Label>
              <Input {...form.register("locationId")} />
            </div>
            <div className="grid gap-2">
              <Label>Incoming Date</Label>
              <Input type="date" {...form.register("incomingDate")} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Supplier</Label>
            <Input {...form.register("supplierId")} placeholder="supplier doc id" />
          </div>

          <div className="mt-2 border rounded p-3">
            <div className="font-medium mb-2">Supplier Plant Passport</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>A Family</Label><Input {...form.register("passportA")} /></div>
              <div className="grid gap-2"><Label>B Producer Code</Label><Input {...form.register("passportB")} /></div>
              <div className="grid gap-2"><Label>C Supplier Batch No.</Label><Input {...form.register("passportC")} /></div>
              <div className="grid gap-2"><Label>D Country Code</Label><Input {...form.register("passportD")} /></div>
            </div>
          </div>

          <Button onClick={form.handleSubmit((v) => {
            if (!v.overrideTotal) v.totalUnits = computedTotal;
            onSubmit(v);
          })}>Create Batch</Button>
        </CardContent>
      </Card>
    </div>
  );
}
