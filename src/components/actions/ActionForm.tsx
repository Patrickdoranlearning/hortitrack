"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
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
import BatchPhotoUploader from "@/components/batches/BatchPhotoUploader";
import { fetchJson } from "@/lib/http";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ActionMode } from "./types";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "../ui/command";

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
});

const CLEAR_STATUS_VALUE = "__none";

const DUMP_REASONS = ["Disease", "Old Unsold Stock", "Drought", "Dead", "Poor Quality"];

const growerStatusOptions = [
  { label: "Propagation", value: "Propagation" },
  { label: "Growing", value: "Growing" },
  { label: "Looking Good", value: "Looking Good" },
  { label: "Ready for Sale", value: "Ready for Sale" },
  { label: "Potted", value: "Potted" },
  { label: "Archived", value: "Archived" },
];

const checkinSchema = z.object({
  type: z.literal("CHECKIN"),
  at: z.date(),
  status: z
    .enum(
      growerStatusOptions
        .filter((opt) => opt.value)
        .map((opt) => opt.value as string) as [
        "Propagation",
        "Growing",
        "Looking Good",
        "Ready for Sale",
        "Potted",
        "Archived"
      ]
    )
    .optional(),
  flags: z.array(z.string()).default([]),
  notes: z.string().min(1, "Add a note"),
  photos: z.array(z.object({ url: z.string().url(), path: z.string().optional() })).default([]),
});

type MoveForm = z.infer<ReturnType<typeof moveSchema>>;
type DumpForm = z.infer<ReturnType<typeof dumpSchema>>;
type CheckForm = z.infer<ReturnType<typeof checkinSchema>>;

export function ActionForm({
  batch,
  locations,
  mode,
  onSuccess,
  onCancel,
}: {
  batch: Batch;
  locations: NurseryLocation[];
  mode: ActionMode;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const { toast } = useToast();
  const [uploaded, setUploaded] = useState<{ url: string; path?: string }[]>([]);
  const [spaced, setSpaced] = useState(false);
  const [partialMove, setPartialMove] = useState(false);
  const [conditionNotes, setConditionNotes] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const max = Number(batch.quantity ?? 0);
  const locs = useMemo(() => locations ?? [], [locations]);

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
    },
  });

  // ---- CHECKIN
  const checkForm = useForm<CheckForm>({
    resolver: zodResolver(checkinSchema),
    defaultValues: {
      type: "CHECKIN",
      at: new Date(),
    status: undefined,
    flags: [],
      notes: "",
      photos: [],
    },
  });

  useEffect(() => {
    if (uploaded.length === 0) return;
    if (mode === "MOVE") {
      moveForm.setValue("photos", [...(moveForm.getValues("photos") || []), ...uploaded], { shouldDirty: true });
    } else if (mode === "CHECKIN") {
      checkForm.setValue("photos", [...(checkForm.getValues("photos") || []), ...uploaded], { shouldDirty: true });
    }
    setUploaded([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploaded, mode]);

  useEffect(() => {
    if (!partialMove) {
      moveForm.setValue("quantity", undefined);
    }
  }, [partialMove, moveForm]);

  useEffect(() => {
    if (locs.length === 0) return;
    const current = moveForm.getValues("toLocationId");
    if (!current) {
      const first = locs[0];
      moveForm.setValue("toLocationId", first.id ?? first.name ?? "", { shouldDirty: false });
    }
  }, [locs, moveForm]);

  function idemKey(payload: Record<string, any>) {
    const base = JSON.stringify({
      batch: batch.id ?? batch.batchNumber,
      ...payload,
      at: new Date(payload.at).getTime(),
    });
    return typeof window === "undefined" ? base : btoa(unescape(encodeURIComponent(base))).slice(0, 128);
  }

  async function submit(payload: Record<string, any>, action: ActionMode) {
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
            (action === "DUMP" ? dumpForm : moveForm).setError("quantity", { message: iss.message });
          }
          if (p === "reason") dumpForm.setError("reason", { message: iss.message });
          if (p === "notes") {
            (action === "CHECKIN" ? checkForm : moveForm).setError("notes", { message: iss.message });
          }
        }
      }
      throw new Error(j?.error || e?.message || "Invalid input");
    });
    return data;
  }

  async function onSubmitMove(values: MoveForm) {
    try {
      if (partialMove && (!values.quantity || values.quantity <= 0)) {
        moveForm.setError("quantity", { message: "Enter how many units to move" });
        toast({
          variant: "destructive",
          title: "Missing quantity",
          description: "Specify the portion you're moving when partial move is enabled.",
        });
        return;
      }

      const insights: string[] = [];
      if (spaced) insights.push("Plants were spaced after arriving in the new location.");
      if (partialMove) insights.push("Only part of this batch was moved to the new conditions.");
      if (conditionNotes.trim()) insights.push(`New conditions: ${conditionNotes.trim()}`);
      const combinedNotes = [values.notes?.trim(), insights.join(" ")].filter(Boolean).join("\n\n");

      const payload = {
        ...values,
        at: values.at.toISOString(),
        quantity: values.quantity ?? max, // default to full batch when blank
        notes: combinedNotes || undefined,
      };
      const result = await submit(payload, "MOVE");
      const createdBatch = result?.splitBatchNumber;
      toast({
        title: partialMove ? "Partial move logged" : "Move logged",
        description: createdBatch
          ? `Created new batch ${createdBatch} for the moved portion.`
          : "Destination set.",
      });
      setPartialMove(false);
      setConditionNotes("");
      onSuccess?.();
    } catch (e: any) {
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
      await submit(payload, "DUMP");
      toast({ title: "Dump logged", description: `Quantity adjusted.` });
      onSuccess?.();
    } catch (e: any) {
      const msg = String(e.message || e);
      if (/exceeds/i.test(msg)) dumpForm.setError("quantity", { message: msg });
      if (/reason/i.test(msg)) dumpForm.setError("reason", { message: msg });
      toast({ variant: "destructive", title: "Dump failed", description: msg });
    }
  }
  const photoRequiredStatuses = ["Ready for Sale", "Looking Good"];

  async function onSubmitCheck(values: CheckForm) {
    try {
      if (
        values.status &&
        photoRequiredStatuses.includes(values.status) &&
        (!values.photos || values.photos.length === 0)
      ) {
        checkForm.setError("status", {
          message: "Add at least one photo when marking as saleable or looking good.",
        });
        toast({
          variant: "destructive",
          title: "Photo required",
          description:
            "Please take a sales photo when setting status to Looking Good or Ready for Sale.",
        });
        return;
      }

      const payload = {
        ...values,
        at: values.at.toISOString(),
        status: values.status,
        flags: values.flags ?? [],
      };
      await submit(payload, "CHECKIN");
      toast({ title: "Check-in saved" });
      onSuccess?.();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Check-in failed", description: String(e.message || e) });
    }
  }

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <Card className="rounded-lg border bg-muted/10 p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">
          {batch.plantVariety?.name ?? (typeof batch.plantVariety === "string" ? batch.plantVariety : "Variety unknown")}
        </p>
        <p>
          Batch #{batch.batchNumber ?? batch.id} • {(batch.quantity ?? 0).toLocaleString()} units available.
        </p>
      </Card>
      {mode === "CHECKIN" && (
        <BatchPhotoUploader batchId={String(batch.id ?? batch.batchNumber)} onUploaded={setUploaded} />
      )}

      {mode === "MOVE" && (
        <SectionCard title="Move batch" description="Log where plants are going and how they're set up.">
          <Form {...moveForm}>
            <form onSubmit={moveForm.handleSubmit(onSubmitMove)} noValidate className="space-y-4">
              <FormField
                control={moveForm.control}
                name="toLocationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destination</FormLabel>
                    {locs.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No nursery locations available. Add one in Settings &gt; Locations.
                      </p>
                    )}
                    <Select value={field.value || ""} onValueChange={field.onChange} disabled={locs.length === 0}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={locs.length === 0 ? "No locations found" : "Select location"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locs.map((l) => (
                          <SelectItem key={l.id ?? l.name} value={l.id ?? l.name!}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-sm">Plants were spaced after move</p>
                    <p className="text-xs text-muted-foreground">
                      Use this when trays were split or spacing was improved in the new spot.
                    </p>
                  </div>
                  <Switch checked={spaced} onCheckedChange={setSpaced} />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-sm">Move only part of the batch</p>
                    <p className="text-xs text-muted-foreground">
                      Track when a portion gets different conditions than the remainder.
                    </p>
                  </div>
                  <Switch checked={partialMove} onCheckedChange={setPartialMove} />
                </div>
                {partialMove && (
                  <>
                    <FormField
                      control={moveForm.control}
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Units moved</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={max}
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                              }
                            />
                          </FormControl>
                          <div className="text-xs text-muted-foreground">{max.toLocaleString()} available in batch</div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="space-y-1">
                      <Label>Describe new conditions</Label>
                      <Textarea
                        value={conditionNotes}
                        onChange={(event) => setConditionNotes(event.target.value)}
                        placeholder="Example: moved portion under shade cloth with misting 3x daily."
                      />
                    </div>
                  </>
                )}
              </div>

              <FormField
                control={moveForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={onCancel}>
                  Cancel
                </Button>
                <SubmitButton pending={moveForm.formState.isSubmitting}>Apply Move</SubmitButton>
              </div>
            </form>
          </Form>
        </SectionCard>
      )}

      {mode === "DUMP" && (
        <SectionCard title="Log dumped stock" description="Record losses or write-offs with a reason and amount.">
          <Form {...dumpForm}>
            <form onSubmit={dumpForm.handleSubmit(onSubmitDump)} noValidate className="space-y-4">
            <FormField control={dumpForm.control} name="reason" render={({ field }) => (
              <FormItem>
                <FormLabel>Reason</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {DUMP_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
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
            )} />
            <FormField control={dumpForm.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                </FormControl>
              </FormItem>
            )} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={onCancel}>
                  Cancel
                </Button>
                <SubmitButton pending={dumpForm.formState.isSubmitting}>Log Dump</SubmitButton>
              </div>
            </form>
          </Form>
        </SectionCard>
      )}

      {mode === "CHECKIN" && (
        <SectionCard
          title="Grower notes"
          description="Capture observations, flag follow-ups, and keep the batch record fresh."
        >
          <Form {...checkForm}>
            <form onSubmit={checkForm.handleSubmit(onSubmitCheck)} noValidate className="space-y-4">
                  <FormField
                    control={checkForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status update</FormLabel>
                    <Select
                      value={field.value ?? CLEAR_STATUS_VALUE}
                      onValueChange={(val) =>
                        field.onChange(
                          val === CLEAR_STATUS_VALUE ? undefined : val
                        )
                      }
                    >
                          <SelectTrigger>
                            <SelectValue placeholder="Leave unchanged" />
                          </SelectTrigger>
                          <SelectContent>
                        <SelectItem value={CLEAR_STATUS_VALUE}>No change</SelectItem>
                            {growerStatusOptions.map((opt) => (
                              <SelectItem key={opt.label} value={opt.value}>
                                {opt.label || "No change"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          A photo is required when marking as “Ready for Sale” or “Looking Good.”
                        </p>
                      <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={checkForm.control}
                    name="flags"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Flags</FormLabel>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { label: "Needs spacing", value: "spacing" },
                            { label: "Needs feeding", value: "feeding" },
                            { label: "Scout issue", value: "issue" },
                            { label: "Sales photo", value: "sales_photo" },
                          ].map((flag) => {
                            const active = field.value?.includes(flag.value);
                            return (
                              <Button
                                key={flag.value}
                                type="button"
                                variant={active ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                  const current = field.value ?? [];
                                  const next = active
                                    ? current.filter((v) => v !== flag.value)
                                    : [...current, flag.value];
                                  field.onChange(next);
                                }}
                              >
                                {flag.label}
                              </Button>
                            );
                          })}
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={checkForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            placeholder="Example: Needs spacing next week..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <p className="text-xs text-muted-foreground">
                    Logged at {checkForm.watch("at")?.toLocaleString()}
                  </p>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={onCancel}>
                  Cancel
                </Button>
                <SubmitButton pending={checkForm.formState.isSubmitting}>Save notes</SubmitButton>
              </div>
            </form>
          </Form>
        </SectionCard>
      )}
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="space-y-4 p-4">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </Card>
  );
}
