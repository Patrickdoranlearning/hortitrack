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
import { uploadActionPhotos } from "@/lib/firebase";
import PhotoPicker from "@/components/actions/PhotoPicker";
import { cn } from "@/lib/utils";
import { toMessage } from "@/lib/errors";

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

  // Use React.useMemo to ensure baseDefaults is stable across renders
  const baseDefaults = React.useMemo(() => ({
    // Ensure batchIds is always an array of strings
    batchIds: Array.isArray(defaultBatchIds) ? defaultBatchIds : [],
    actionId: uuid(), // Generate a new UUID each time for actionId
  }), [defaultBatchIds]);

  console.log("ActionDialog rendered. defaultBatchIds:", defaultBatchIds, "locations:", propLocations);
  console.log("Initial baseDefaults:", baseDefaults);

  const [localLocations, setLocalLocations] = React.useState(propLocations);
  const [locLoading, setLocLoading] = React.useState(false);

  // one-shot fallback fetch if the prop is empty
  React.useEffect(() => {
    if (propLocations?.length) { setLocalLocations(propLocations); return; }
    let canceled = false;
    (async () => {
      try {
        setLocLoading(true);
        const res = await fetch("/api/locations", { headers: { Accept: "application/json" } });
        const json = await res.json();
        const items = Array.isArray(json?.items) ? json.items
                    : Array.isArray(json)        ? json
                    : [];
        if (!canceled) setLocalLocations(items);
      } catch (e) {
        console.error("[ActionDialog] load locations failed:", e);
      } finally {
        if (!canceled) setLocLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, [propLocations]);

  const form = useForm<AnyAction>({
    resolver: zodResolver(ActionInputSchema),
    // Use the memoized baseDefaults here
    defaultValues: { type: "MOVE", ...baseDefaults } as any,
    mode: "onChange",
    shouldUnregister: true,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    console.log("*** onSubmit triggered (from handleSubmit wrapper)");
    console.log("*** Validated form values received by onSubmit:", values);
    console.log("*** Current form errors after validation:", form.formState.errors);
    console.log("*** Is form valid? ", form.formState.isValid);

    // If form is not valid after handleSubmit, something is wrong with validation or schema
    if (!form.formState.isValid) {
      console.error("Form is not valid, preventing submission. Errors:", form.formState.errors);
      toast({ variant: "destructive", title: "Validation Error", description: "Please correct the form errors." });
      return; // Stop here if validation failed
    }

    let photos: any[] | undefined = undefined;
    if (files.length) {
      console.log("Entering photo upload block. Files to upload:", files.length);
      try {
        // Validate values before proceeding with photo upload
        const validated = ActionInputSchema.parse({ ...values, photos: undefined });
        const scopeBatchId = validated.batchIds?.[0] ?? "misc";
        photos = await uploadActionPhotos(scopeBatchId, files);
      } catch (e: any) {
        console.error("Photo upload error:", e);
        toast({variant: 'destructive', title: "Photo upload failed", description: toMessage(e)});
        return;
      }
    } else {
      console.log("No photos to upload. Skipping photo upload block.");
    }
    try {
      const payloadToSend = { ...values, photos };
      console.log("Sending payload to /api/actions:", payloadToSend);
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadToSend),
      });
      console.log("Fetch response received, status:", res.status, "ok:", res.ok);
      
      const raw = await res.text();
      let body: any = null;
      try { body = JSON.parse(raw); } catch { console.warn("Failed to parse JSON response:", raw); /* keep raw for diagnostics */ }
      console.log("Parsed response body:", body);

      const ok = res.ok && body && body.ok !== false;

      if (!ok) {
        const statusMsg = `HTTP ${res.status}`;
        const serverMsg = (body && (body.error || body.message)) || raw?.slice(0, 200) || "Unknown failure";
        const msg = `${statusMsg}: ${serverMsg}`;
        console.error(`Action failed (server response not ok):\n${msg}`);

        // Map zod issues to fields if provided
        if (body?.issues && Array.isArray(body.issues)) {
          for (const issue of body.issues) {
            const path = (issue?.path?.[0] as string) || "_form";
            const message = (issue?.message as string) || "Invalid value";
            // @ts-expect-error dynamic field
            form.setError(path, { type: "server", message });
          }
        }

        toast({ variant: "destructive", title: "Action failed", description: msg });
        return;
      }

      toast({ title: "Action applied" });
      setFiles([]);
      onOpenChange(false);
    } catch (e) {
      console.error("Network or unexpected error during fetch:", e);
      toast({ variant: "destructive", title: "Network error", description: toMessage(e) });
    }
  });


  // Use localLocations for rendering dropdown options
  const locOptions = localLocations;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>Batch Actions</DialogTitle>
          <DialogDescription id="batch-actions-desc">Apply an action to the selected batch.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => {
          setTab(v as any);
          // Explicitly reset on tab change with correct defaults
          form.reset({ type: v as any, ...baseDefaults, batchIds: defaultBatchIds });
        }}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="DUMPED">Dumped</TabsTrigger>
            <TabsTrigger value="MOVE">Move</TabsTrigger>
            <TabsTrigger value="SPLIT">Split</TabsTrigger>
            <TabsTrigger value="FLAGS">Flags</TabsTrigger>
            <TabsTrigger value="NOTE">Note</TabsTrigger>
          </TabsList>
            
          {/* IMPORTANT: wrap content in a real <form> */}
          <form
            className="space-y-3 pt-3"
            // Use form.handleSubmit directly on the form element
            // This is the standard react-hook-form way and handles validation internally.
            // Removing the manual preventDefault and onSubmit() call, as handleSubmit handles this.
            onSubmit={form.handleSubmit(onSubmit)}
            aria-describedby="batch-actions-desc" // Link form to description for a11y
          >
          
          {"_form" in form.formState.errors ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {(form.formState.errors._form as any)?.message as string}
            </div>
          ) : null}

          {/* DUMPED */}
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
                {...form.register("quantity" as any, { setValueAs: (v) => Number(v) })}
              />
            </div>
          </TabsContent>

          {/* MOVE */}
          <TabsContent value="MOVE" className="space-y-3">
            <div>
              <label className="text-sm">To Location</label>
              <select
                className="w-full border rounded-md p-2"
                defaultValue=""
                {...form.register("toLocationId" as any)}
                // Added onBlur to potentially trigger validation more explicitly
                onBlur={() => form.trigger("toLocationId")}
              >
                <option value="" disabled>Select location…</option>
                {locOptions.map(l => <option key={l.id} value={l.id}>{l.name ?? l.id}</option>)}
              </select>
              {form.formState.errors.toLocationId && (
                <p className="text-sm font-medium text-destructive mt-1">
                  {form.formState.errors.toLocationId.message}
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
            <Textarea placeholder="Note (optional)" 
              {...form.register("note" as any)} />
          </TabsContent>

          {/* SPLIT */}
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
                {locOptions.map(l => <option key={l.id} value={l.id}>{l.name ?? l.id}</option>)}
              </select>
              {form.formState.errors.toLocationId && (
                <p className="text-sm font-medium text-destructive mt-1">
                  {form.formState.errors.toLocationId.message}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm">Split Quantity</label>
              <Input
                type="number"
                min={1}
                {...form.register("quantity" as any, { setValueAs: (v) => Number(v) })}
              />
            </div>
            <Textarea placeholder="Note (optional)" {...form.register("note" as any)} />
          </TabsContent>

          {/* FLAGS */}
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

          {/* NOTE */}
          <TabsContent value="NOTE" className="space-y-3">
            <Input placeholder="Title" {...form.register("title" as any)} />
            <Textarea placeholder="Details (optional)" {...form.register("body" as any)} />
          </TabsContent>

          {/* PHOTOS */}
          <div className="mt-4 space-y-2">
            <label className="text-sm font-medium">Photos (optional)</label>
            <PhotoPicker onChange={setFiles} max={10} />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting}>Cancel</Button>
            <Button
              type="submit"
              disabled={locLoading || (localLocations.length === 0) || form.formState.isSubmitting}
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
