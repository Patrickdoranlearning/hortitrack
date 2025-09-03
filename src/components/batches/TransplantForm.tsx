// src/components/batches/TransplantForm.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TransplantRequestSchema, TransplantRequest } from "@/lib/validators/transplant";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormField, FormItem, FormLabel, FormMessage, FormControl } from "@/components/ui/form";
import { toast } from "sonner";
import { getBrowserSupabase, getAccessToken } from "@/lib/supabase/browserClient";

// You likely have generic Select components:
import { Select, SelectTrigger, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectValue } from "@/components/ui/select";

type BatchSummary = {
  id: string;
  batch_number: string;
  quantity: number;
  plant_variety_id: string;
  supplier_id: string | null;
};

type SizeRow = { id: string; name: string; container_type: "pot" | "tray"; cell_multiple: number };
type LocationRow = { id: string; name: string };

export function TransplantForm(props: {
  parentBatch: BatchSummary;
  onSuccess?: (childBatchId: string) => void;
  onCancel?: () => void;
}) {
  const sb = getBrowserSupabase();
  const [sizes, setSizes] = useState<SizeRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [authIssue, setAuthIssue] = useState<string | null>(null);

  const form = useForm<TransplantRequest>({
    resolver: zodResolver(TransplantRequestSchema),
    defaultValues: {
      parentBatchId: props.parentBatch.id,
      newBatchNumber: "",
      newSizeId: undefined as any,
      newLocationId: undefined as any,
      containers: 1,
      dumpAndArchiveRemainder: false,
      passportOverrideA: "",
      passportOverrideB: "",
      passportOverrideC: "",
      passportOverrideD: "",
    },
    mode: "onChange",
  });

  const selectedSize = useMemo(() => sizes.find(s => s.id === form.watch("newSizeId")), [sizes, form.watch("newSizeId")]);
  const sizeMultiple = selectedSize?.cell_multiple ?? 1;
  const containers = Number(form.watch("containers") || 0);
  const totalUnits = containers * sizeMultiple;

  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken(sb);
        if (!token) {
          setAuthIssue("Please sign in to load sizes and locations.");
          return;
        }
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const [sRes, lRes] = await Promise.all([
          fetch("/api/lookups/sizes", { cache: "no-store", headers }),
          fetch("/api/lookups/locations", { cache: "no-store", headers }),
        ]);
        const sJson = await sRes.json();
        const lJson = await lRes.json();
        if (!sRes.ok) throw new Error(sJson?.error || "Sizes load failed");
        if (!lRes.ok) throw new Error(lJson?.error || "Locations load failed");
        setSizes(sJson.sizes as SizeRow[]);
        setLocations(lJson.locations as LocationRow[]);
        setAuthIssue(null);
      } catch (e: any) {
        console.error("[TransplantForm] lookups failed:", e);
        setAuthIssue(e?.message ?? "Failed to load lookups");
      }
    })();
  }, [sb]);

  async function onSubmit(values: TransplantRequest) {
    try {
      if (!selectedSize) {
        toast.error("Please choose a size.");
        return;
      }
      setLoading(true);
      const token = await getAccessToken(sb);
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) (headers as any).Authorization = `Bearer ${token}`;
      const res = await fetch("/api/production/transplants", {
        method: "POST",
        headers,
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Transplant failed");
      toast.success(`Created batch ${json.childBatchNumber}`);
      props.onSuccess?.(json.childBatchId);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  const parentRemaining = Math.max(0, props.parentBatch.quantity - totalUnits);

  return (
    <Card className="p-4 space-y-4">
      {authIssue ? (
        <div className="text-sm text-red-600">{authIssue}</div>
      ) : null}
      <div className="text-sm text-muted-foreground">
        Parent: <span className="font-semibold">{props.parentBatch.batch_number}</span> · Available units:{" "}
        <span className="font-semibold">{props.parentBatch.quantity}</span>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...form.register("parentBatchId")} value={props.parentBatch.id} />

          <FormField
            control={form.control}
            name="newBatchNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Batch Number (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Auto if blank" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="newSizeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Size</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Sizes</SelectLabel>
                        {sizes.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name} — {s.cell_multiple} per container</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newLocationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Location</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Locations</SelectLabel>
                        {locations.map(l => (
                          <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="containers"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Containers (full trays/pots only)</FormLabel>
                <FormControl>
                  <Input type="number" min={1} step={1} {...field} onChange={e => field.onChange(Number(e.target.value))} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="text-sm">
            Size multiple: <strong>{sizeMultiple}</strong> · Total units to create: <strong>{totalUnits}</strong>
          </div>

          <FormField
            control={form.control}
            name="dumpAndArchiveRemainder"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={v => field.onChange(Boolean(v))} />
                </FormControl>
                <Label className="cursor-pointer">Dump remainder ({parentRemaining} units) and archive parent</Label>
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="passportOverrideA" render={({ field }) => (
              <FormItem><FormLabel>Passport A (optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="passportOverrideB" render={({ field }) => (
              <FormItem><FormLabel>Passport B (optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="passportOverrideC" render={({ field }) => (
              <FormItem><FormLabel>Passport C (optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="passportOverrideD" render={({ field }) => (
              <FormItem><FormLabel>Passport D (optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
          </div>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={props.onCancel} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading || totalUnits <= 0}>Transplant</Button>
          </div>
        </form>
      </Form>
    </Card>
  );
}
