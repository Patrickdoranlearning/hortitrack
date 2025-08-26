
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useToast } from "@/hooks/use-toast";
import type { Batch, NurseryLocation } from "@/lib/types";
import { PhotoPicker } from "@/components/photos/PhotoPicker";
import { fetchJson } from "@/lib/http";

function compactPayload<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === "" || v === undefined || v === null) continue; // drop empties
    out[k] = v;
  }
  return out as Partial<T>;
}

const moveSchema = (max: number) => z.object({
  type: z.literal("MOVE"),
  at: z.date(),
  toLocationId: z.string().optional(),
  toLocation: z.string().optional(),
  quantity: z.coerce.number().int().positive().max(max).optional(),
  notes: z.string().optional(),
  photos: z.array(z.object({ url: z.string().url(), path: z.string().optional() })).default([]),
}).refine(v => !!v.toLocationId || !!v.toLocation, { message: "Destination required", path: ["toLocationId"] });

const dumpSchema = (max: number) => z.object({
  type: z.literal("DUMP"),
  at: z.date(),
  reason: z.string().min(2, "Reason required"),
  quantity: z.coerce.number().int().positive().max(max).optional(), // default to full batch on server
  notes: z.string().optional(),
  photos: z.array(z.object({ url: z.string().url(), path: z.string().optional() })).default([]),
});

const checkinSchema = z.object({
  type: z.enum(["CHECKIN", "NOTE"]),
  at: z.date(),
  notes: z.string().min(1, "Add a note"),
  photos: z.array(z.object({ url: z.string().url(), path: z.string().optional() })).default([]),
});

type MoveForm = z.infer<ReturnType<typeof moveSchema>>;
type DumpForm = z.infer<ReturnType<typeof dumpSchema>>;
type CheckForm = z.infer<ReturnType<typeof checkinSchema>>;

export function ActionForm({
  batch, locations, onSuccess, onCancel,
}: {
  batch: Batch;
  locations: NurseryLocation[];
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"MOVE"|"DUMP"|"CHECKIN">("MOVE");
  const [uploaded, setUploaded] = useState<{url:string;path?:string}[]>([]);
  const abortRef = useRef<AbortController|null>(null);
  const max = Number(batch.quantity ?? 0);

  // ---- MOVE
  const moveForm = useForm<MoveForm>({
    resolver: zodResolver(moveSchema(max)),
    defaultValues: {
      type: "MOVE",
      at: new Date(),
      toLocationId: "",     // keep Select controlled
      toLocation: "",       // if you ever bind a free-text location
      quantity: undefined,  // optional; rendered as "" so still controlled
      notes: "",            // critical: avoid undefined → string flip
      photos: [],
    },
  });

  // ---- DUMP
  const dumpForm = useForm<DumpForm>({
    resolver: zodResolver(dumpSchema(max)),
    defaultValues: {
      type: "DUMP",
      at: new Date(),
      reason: "",           // critical: avoid undefined → string flip
      quantity: undefined,  // optional; rendered as ""
      notes: "",
      photos: [],
    },
  });

  // ---- CHECKIN
  const checkForm = useForm<CheckForm>({
    resolver: zodResolver(checkinSchema),
    defaultValues: {
      type: "CHECKIN",
      at: new Date(),
      notes: "",
      photos: [],
    },
  });

  useEffect(() => {
    // push uploaded photos to whichever tab is active
    if (uploaded.length === 0) return;
    if (tab === "MOVE") moveForm.setValue("photos", [...(moveForm.getValues("photos")||[]), ...uploaded], { shouldDirty: true });
    if (tab === "DUMP") dumpForm.setValue("photos", [...(dumpForm.getValues("photos")||[]), ...uploaded], { shouldDirty: true });
    if (tab === "CHECKIN") checkForm.setValue("photos", [...(checkForm.getValues("photos")||[]), ...uploaded], { shouldDirty: true });
    setUploaded([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploaded, tab]);

  function idemKey(payload: Record<string, any>) {
    const base = JSON.stringify({
      batch: batch.id ?? batch.batchNumber,
      ...payload,
      at: new Date(payload.at).getTime(),
    });
    return typeof window === "undefined" ? base : btoa(unescape(encodeURIComponent(base))).slice(0,128);
  }

  async function submit(payload: Record<string, any>) {
    // cancel in-flight
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const url = `/api/batches/${encodeURIComponent(String(batch.id ?? batch.batchNumber))}/actions`;
    const { data } = await fetchJson<any>(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idemKey(payload),
      },
      body: JSON.stringify(compactPayload(payload)),
      signal: abortRef.current.signal,
    }).catch((e: any) => {
      const j = e?.data ?? {};
      // Map Zod issues to fields on the active tab (if server sent them)
      if (j?.issues && Array.isArray(j.issues)) {
        for (const iss of j.issues) {
          const p = String(iss.path || "");
          if (p.includes("toLocation")) {
            moveForm.setError("toLocationId", { message: iss.message });
          }
          if (p === "quantity") {
            (tab === "DUMP" ? dumpForm : moveForm).setError("quantity", { message: iss.message });
          }
          if (p === "reason") dumpForm.setError("reason", { message: iss.message });
          if (p === "notes") {
            (tab === "CHECKIN" ? checkForm : moveForm).setError("notes", { message: iss.message });
          }
        }
      }
      throw new Error(j?.error || e?.message || "Invalid input");
    });
    return data;
  }

  async function onSubmitMove(values: MoveForm) {
    try {
      const payload = {
        ...values,
        at: values.at.toISOString(),
        quantity: values.quantity ?? max, // default to full batch when blank
      };
      await submit(payload);
      toast({ title: "Move logged", description: `Destination set.` });
      onSuccess?.();
    } catch (e:any) {
      const msg = String(e.message || e);
      if (/destination/i.test(msg)) moveForm.setError("toLocationId", { message: msg });
      toast({ variant: "destructive", title: "Move failed", description: msg });
    }
  }
  async function onSubmitDump(values: DumpForm) {
    try {
      const payload = {
        ...values,
        at: values.at.toISOString(),
        quantity: values.quantity ?? max, // default full dump if blank
      };
      await submit(payload);
      toast({ title: "Dump logged", description: `Quantity adjusted.` });
      onSuccess?.();
    } catch (e:any) {
      const msg = String(e.message || e);
      if (/exceeds/i.test(msg)) dumpForm.setError("quantity", { message: msg });
      if (/reason/i.test(msg)) dumpForm.setError("reason", { message: msg });
      toast({ variant: "destructive", title: "Dump failed", description: msg });
    }
  }
  async function onSubmitCheck(values: CheckForm) {
    try {
      const payload = { ...values, at: values.at.toISOString() };
      await submit(payload);
      toast({ title: "Check-in saved" });
      onSuccess?.();
    } catch (e:any) {
      toast({ variant: "destructive", title: "Check-in failed", description: String(e.message||e) });
    }
  }

  const locs = useMemo(() => locations ?? [], [locations]);

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-4">
      <TabsList className="grid grid-cols-3">
        <TabsTrigger value="MOVE">Move</TabsTrigger>
        <TabsTrigger value="DUMP">Dumped</TabsTrigger>
        <TabsTrigger value="CHECKIN">Check-in</TabsTrigger>
      </TabsList>

      <PhotoPicker batchId={String(batch.id ?? batch.batchNumber)} onUploaded={setUploaded} />

      <TabsContent value="MOVE">
        <Form {...moveForm}>
          <form onSubmit={moveForm.handleSubmit(onSubmitMove)} noValidate className="space-y-4">
            <FormField control={moveForm.control} name="toLocationId" render={({ field }) => (
              <FormItem>
                <FormLabel>Destination</FormLabel>
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {locs.map(l => (
                      <SelectItem key={l.id ?? l.name} value={l.id ?? l.name!}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}/>
            <FormField control={moveForm.control} name="quantity" render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity (blank = whole batch)</FormLabel>
                <FormControl>
                  <Input type="number" min={1} max={max} value={field.value ?? ""} onChange={(e) =>
                    field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                  } />
                </FormControl>
                <div className="text-xs text-muted-foreground">Available: {max}</div>
                <FormMessage />
              </FormItem>
            )}/>
            <FormField control={moveForm.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                </FormControl>
              </FormItem>
            )}/>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
              <SubmitButton pending={moveForm.formState.isSubmitting}>Apply Move</SubmitButton>
            </div>
          </form>
        </Form>
      </TabsContent>

      <TabsContent value="DUMP">
        <Form {...dumpForm}>
          <form onSubmit={dumpForm.handleSubmit(onSubmitDump)} noValidate className="space-y-4">
            <FormField control={dumpForm.control} name="reason" render={({ field }) => (
              <FormItem>
                <FormLabel>Reason</FormLabel>
                <FormControl>
                  <Input value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}/>
            <FormField control={dumpForm.control} name="quantity" render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity (blank = whole batch)</FormLabel>
                <FormControl>
                  <Input type="number" min={1} max={max} value={field.value ?? ""} onChange={(e) =>
                    field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                  } />
                </FormControl>
                <div className="text-xs text-muted-foreground">Available: {max}</div>
                <FormMessage />
              </FormItem>
            )}/>
            <FormField control={dumpForm.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                </FormControl>
              </FormItem>
            )}/>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
              <SubmitButton pending={dumpForm.formState.isSubmitting}>Log Dump</SubmitButton>
            </div>
          </form>
        </Form>
      </TabsContent>

      <TabsContent value="CHECKIN">
        <Form {...checkForm}>
          <form onSubmit={checkForm.handleSubmit(onSubmitCheck)} noValidate className="space-y-4">
            <FormField control={checkForm.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}/>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
              <SubmitButton pending={checkForm.formState.isSubmitting}>Save Check-in</SubmitButton>
            </div>
          </form>
        </Form>
      </TabsContent>
    </Tabs>
  );
}
