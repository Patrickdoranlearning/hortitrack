
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

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultBatchIds: string[];
  locations: { id: string; name: string }[];
};

type AnyAction = z.infer<typeof ActionInputSchema>;

export function ActionDialog({ open, onOpenChange, defaultBatchIds, locations: propLocations = [] }: Props) {
  const { toast } = useToast();
  const [tab, setTab] = React.useState<"DUMPED"|"MOVE"|"SPLIT"|"FLAGS"|"NOTE">("MOVE");
  const [files, setFiles] = React.useState<File[]>([]);

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
    defaultValues: { type: "MOVE", ...baseDefaults } as any,
    mode: "onChange",
    shouldUnregister: true,
  });

  const onSubmit = async (values: Record<string, any>) => {
    const batchIds = Array.isArray(values.batchIds) && values.batchIds.length ? values.batchIds : baseDefaults.batchIds;
    const actionId = values.actionId || baseDefaults.actionId;
    
    let quantity: number | undefined = undefined;
    if (values.quantity !== undefined && values.quantity !== null && `${values.quantity}`.trim() !== "") {
      const n = Number(values.quantity);
      if (Number.isFinite(n)) quantity = n;
    }

    const needsLocation = tab === "MOVE" || tab === "SPLIT";
    if (needsLocation && !values.toLocationId) {
      toast({ variant: "destructive", title: "Missing location", description: "Select a destination location." });
      return;
    }

    let uploadedPhotos: Array<{ url: string; path: string; mime: string; size: number }> = [];
    if (files.length > 0) {
      try {
        const firstBatch = batchIds[0];
        // This is a stand-in for a real upload function.
        // In a real app, this would call your Firebase Storage upload utility.
        uploadedPhotos = await Promise.all(files.map(async (file) => {
            const uploadedFile = await uploadActionPhotos(firstBatch, [file]);
            return uploadedFile[0];
        }));
      } catch (e) {
        console.error("[ActionDialog] photo upload failed", e);
        toast({ variant: "destructive", title: "Photo upload failed", description: toMessage(e) });
        return;
      }
    }
    
    const payload = { ...values, type: tab, batchIds, actionId, quantity, photos: uploadedPhotos };

    const res = await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let body: any = null;
    try { body = JSON.parse(text); } catch { /* keep raw */ }
    const ok = res.ok && body && body.ok !== false;
    if (!ok) {
      const msg = (body && (body.error || body.message)) || text || `HTTP ${res.status}`;
      toast({ variant: "destructive", title: "Action failed", description: msg.slice(0, 500) });
      return;
    }
    toast({ title: "Action applied", description: "Your changes were saved." });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl" aria-describedby="batch-actions-desc">
        <DialogHeader>
          <DialogTitle>Batch Actions</DialogTitle>
          <DialogDescription id="batch-actions-desc">Apply an action to the selected batch.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => {
          setTab(v as any);
          form.reset({ type: v as any, ...baseDefaults, batchIds: defaultBatchIds });
        }}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="DUMPED">Dumped</TabsTrigger>
            <TabsTrigger value="MOVE">Move</TabsTrigger>
            <TabsTrigger value="SPLIT">Split</TabsTrigger>
            <TabsTrigger value="FLAGS">Flags</TabsTrigger>
            <TabsTrigger value="NOTE">Note</TabsTrigger>
          </TabsList>
            
          <form
            className="space-y-3 pt-3"
            onSubmit={form.handleSubmit(onSubmit)}
            aria-describedby="batch-actions-desc"
            noValidate
          >
          
          {"_form" in form.formState.errors ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {(form.formState.errors._form as any)?.message as string}
            </div>
          ) : null}

          <TabsContent value="DUMPED" className="space-y-3">
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
                {...form.register("quantity" as any, { valueAsNumber: true })}
              />
            </div>
          </TabsContent>

          <TabsContent value="MOVE" className="space-y-3">
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

          <TabsContent value="SPLIT" className="space-y-3">
            <p className="text-xs text-muted-foreground">Split acts on a single batch.</p>
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
              <label className="text-sm">Split Quantity</label>
              <Input
                type="number"
                min={1}
                {...form.register("quantity" as any, { valueAsNumber: true })}
              />
            </div>
            <Textarea placeholder="Note (optional)" {...form.register("note" as any)} />
          </TabsContent>

          <TabsContent value="FLAGS" className="space-y-3">
            <div className="flex gap-6">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" {...form.register("trimmed" as any)} />
                <span>Trimmed</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" {...form.register("spaced" as any)} />
                <span>Spaced</span>
              </label>
            </div>
            <Textarea placeholder="Note (optional)" {...form.register("note" as any)} />
          </TabsContent>

          <TabsContent value="NOTE" className="space-y-3">
            <Input placeholder="Title" {...form.register("title" as any)} />
            <Textarea placeholder="Details (optional)" {...form.register("body" as any)} />
          </TabsContent>

          <div className="mt-4 space-y-2">
            <label className="text-sm font-medium">Photos (optional)</label>
            <PhotoPicker onChange={setFiles} max={10} />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting}>Cancel</Button>
            <Button
              type="submit"
              disabled={((tab === "MOVE" || tab === "SPLIT") && (locLoading || localLocations.length === 0)) || form.formState.isSubmitting}
            >
              {locLoading ? "Loading…" : "Apply"}
            </Button>
          </DialogFooter>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
