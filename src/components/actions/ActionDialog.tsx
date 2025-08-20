"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { ActionInputSchema } from "@/lib/actions/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import PhotoPicker from "@/components/actions/PhotoPicker";
import { toMessage } from "@/lib/errors";
import { uploadActionPhotos } from "@/lib/firebase";
import { postJson } from "@/lib/net";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import { SubmitButton } from "../ui/SubmitButton";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultBatchIds: string[];
  locations: { id: string; name: string }[];
};

type AnyAction = z.infer<typeof ActionInputSchema>;

const FORM_ID = "action-form";

export function ActionDialog({ open, onOpenChange, defaultBatchIds, locations: propLocations = [] }: Props) {
  const { toast } = useToast();
  const [tab, setTab] = React.useState<"CULTURE" | "MOVE" | "DUMPED" | "NOTE">("CULTURE");
  const [files, setFiles] = React.useState<File[]>([]);
  const descId = "batch-actions-desc";

  const baseDefaults = React.useMemo(() => ({
    batchIds: Array.isArray(defaultBatchIds) ? defaultBatchIds : [],
    actionId: uuid(),
  }), [defaultBatchIds]);

  const [localLocations, setLocalLocations] = React.useState(propLocations);
  const [locLoading, setLocLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (localLocations.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        setLocLoading(true);
        const res = await fetch("/api/locations", { headers: { Accept: "application/json" } });
        const json = await res.json();
        const items = Array.isArray(json?.items) ? json.items : (Array.isArray(json) ? json : []);
        if (!cancelled) setLocalLocations(items);
      } catch (e) {
        console.error("[ActionDialog] load locations failed", e);
      } finally {
        if (!cancelled) setLocLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, localLocations.length]);

  const form = useForm<AnyAction>({
    resolver: zodResolver(ActionInputSchema),
    defaultValues: { type: "CULTURE", ...baseDefaults } as any,
    mode: "onChange",
    shouldUnregister: true,
  });

  const onSubmit = async (values: Record<string, any>) => {
    console.info('[ActionDialog] submit', values);
    const batchIds = Array.isArray(values.batchIds) && values.batchIds.length ? values.batchIds : defaultBatchIds;
    
    let quantity: number | undefined = undefined;
    if (values.quantity !== undefined && `${values.quantity}`.trim() !== "") {
      const n = Number(values.quantity); if (Number.isFinite(n)) quantity = n;
    }

    if (tab === "DUMPED" && (quantity === undefined || quantity <= 0)) {
      toast({ variant: "destructive", title: "Missing quantity", description: "Enter how many plants to dump." });
      return;
    }

    const needsLocation = tab === "MOVE";
    if (needsLocation && !values.toLocationId) {
      toast({ variant: "destructive", title: "Missing location", description: "Select a destination location." });
      return;
    }

    let photos: Array<{ url: string; path: string; mime: string; size: number }> = [];
    if (files.length) {
      try { 
        const firstBatch = batchIds[0] ?? 'misc';
        photos = await uploadActionPhotos(firstBatch, files);
      }
      catch (e) { toast({ variant: "destructive", title: "Photo upload failed", description: `${e}` }); return; }
    }

    const payload = {
      type: tab,
      batchIds,
      toLocationId: values.toLocationId || undefined,
      reason: values.reason || undefined,
      quantity,
      photos,
      actionId: baseDefaults.actionId,
      ...values,
    };

   const res = await fetch("/api/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(payload),
   });
   const data = await res.json().catch(() => null);
   if (!res.ok || !data?.ok) {
     toast({ variant: "destructive", title: "Action failed", description: data?.error ?? `Action failed (HTTP ${res.status})` });
     console.error("[ActionDialog] failed", { status: res.status, data });
     return;
   }

    toast({ title: "Action applied", description: "Your changes were saved." });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl" aria-describedby={descId}>
        <DialogHeader>
          <DialogTitle>Batch Actions</DialogTitle>
          <DialogDescription id={descId}>Apply an action to the selected batch.</DialogDescription>
        </DialogHeader>

        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Tabs value={tab} onValueChange={(v) => {
            setTab(v as any);
            form.reset({ type: v as any, ...baseDefaults, batchIds: defaultBatchIds });
            }}>
            <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="CULTURE">Culture</TabsTrigger>
                <TabsTrigger value="MOVE">Move</TabsTrigger>
                <TabsTrigger value="DUMPED">Dumped</TabsTrigger>
                <TabsTrigger value="NOTE">Note</TabsTrigger>
            </TabsList>
                
            {"_form" in form.formState.errors ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {(form.formState.errors._form as any)?.message as string}
                </div>
            ) : null}

            <TabsContent value="CULTURE" className="space-y-3 pt-3">
                <div className="flex flex-col space-y-2">
                    <div className="flex items-center space-x-2">
                        <Checkbox id="trimmed" {...form.register("trimmed" as any)} />
                        <Label htmlFor="trimmed">Batch was trimmed</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="spaced" {...form.register("spaced" as any)} />
                        <Label htmlFor="spaced">Batch was spaced</Label>
                    </div>
                </div>
                <Textarea placeholder="Note (optional)" {...form.register("note" as any)} />
            </TabsContent>

            <TabsContent value="MOVE" className="space-y-3 pt-3">
                <div>
                <label className="text-sm">To Location</label>
                <select
                    className="w-full border rounded-md p-2"
                    defaultValue=""
                    {...form.register("toLocationId" as any)}
                    onBlur={() => form.trigger("toLocationId")}
                >
                    <option value="" disabled>Select location…</option>
                    {localLocations.map(l => <option key={l.id} value={l.id}>{l.name ?? l.id}</option>)}
                </select>
                {form.formState.errors.toLocationId && (
                    <p className="text-sm font-medium text-destructive mt-1">
                    {(form.formState.errors.toLocationId as any).message}
                    </p>
                )}
                </div>
                <div>
                <label className="text-sm">Quantity (optional)</label>
                <Input
                    type="number"
                    min={1}
                    placeholder="Move full if empty"
                    {...form.register("quantity" as any, { setValueAs: (v) => v ? Number(v) : undefined })}
                />
                </div>
                <Textarea placeholder="Note (optional)" {...form.register("note" as any)} />
            </TabsContent>

            <TabsContent value="DUMPED" className="space-y-3 pt-3">
                <div>
                <label className="text-sm">Reason</label>
                <Textarea
                    placeholder="Why was this batch dumped?"
                    {...form.register("reason" as any)}
                />
                </div>
                <div>
                <label className="text-sm">Quantity to dump</label>
                <Input
                    type="number"
                    min={1}
                    step="1"
                    required
                    {...form.register("quantity" as any, { valueAsNumber: true })}
                />
                </div>
            </TabsContent>

            <TabsContent value="NOTE" className="space-y-3 pt-3">
                <Input placeholder="Title" {...form.register("title" as any)} />
                <Textarea placeholder="Details (optional)" {...form.register("body" as any)} />
            </TabsContent>

            <div className="mt-4 space-y-2">
                <label className="text-sm font-medium">Photos (optional)</label>
                <PhotoPicker onChange={setFiles} max={10} />
            </div>
            </Tabs>
        </form>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting}>Cancel</Button>
          <SubmitButton
            type="submit"
            form={FORM_ID}
            pending={form.formState.isSubmitting}
            disabled={((tab === "MOVE") && (locLoading || localLocations.length === 0)) || form.formState.isSubmitting}
            data-testid="action-submit"
          >
            {locLoading ? "Loading..." : "Apply"}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
