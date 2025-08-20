
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { uploadActionPhotos } from "@/lib/firebase";
import PhotoPicker from "@/components/actions/PhotoPicker";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultBatchIds: string[];
  locations: { id: string; name: string }[];
};

type AnyAction = z.infer<typeof ActionInputSchema>;

export function ActionDialog({ open, onOpenChange, defaultBatchIds, locations }: Props) {
  const { toast } = useToast();
  const [tab, setTab] = React.useState<"DUMPED"|"MOVE"|"SPLIT"|"FLAGS"|"NOTE">("MOVE");
  const [files, setFiles] = React.useState<File[]>([]);

  const baseDefaults: Partial<AnyAction> = {
    batchIds: defaultBatchIds,
    actionId: uuid(),
  };

  const form = useForm<AnyAction>({
    resolver: zodResolver(ActionInputSchema),
    defaultValues: { type: "MOVE", ...baseDefaults } as any,
    mode: "onChange",
    shouldUnregister: true, // critical for discriminated union
  });

  React.useEffect(() => {
    form.reset({ ...form.getValues(), batchIds: defaultBatchIds });
  }, [defaultBatchIds, form]); // Keep selection synced

  const onSubmit = form.handleSubmit(async (validated) => {
    // Set discriminant explicitly just in case
    (validated as any).type = tab;
    let photos: any = undefined;
    if (files.length) {
      try {
        const scopeBatchId = validated.batchIds?.[0] ?? "misc";
        photos = await uploadActionPhotos(scopeBatchId, files);
      } catch (e: any) {
        toast({variant: 'destructive', title: "Photo upload failed: " + (e?.message ?? "error")});
        return;
      }
    }
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validated, photos }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({variant: 'destructive', title: `Action failed (${res.status})`, description: data?.error });
        return;
      }
      toast({title: "Action applied"});
      setFiles([]);
      onOpenChange(false);
    } catch (e: any) {
      toast({variant: 'destructive', title: "Network Error", description: e?.message });
    }
  });


  const locOptions = locations;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>Batch Actions</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => {
          setTab(v as any);
          form.reset({ type: v as any, ...baseDefaults, batchIds: defaultBatchIds } as any);
        }}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="DUMPED">Dumped</TabsTrigger>
            <TabsTrigger value="MOVE">Move</TabsTrigger>
            <TabsTrigger value="SPLIT">Split</TabsTrigger>
            <TabsTrigger value="FLAGS">Trim/Space</TabsTrigger>
            <TabsTrigger value="NOTE">Note</TabsTrigger>
          </TabsList>
            
          {/* IMPORTANT: wrap content in a real <form> */}
          <form
            className="space-y-3 pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              form.setValue("type" as any, tab as any, { shouldValidate: true });
              onSubmit();
            }}
          >

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
              >
                <option value="" disabled>Select location…</option>
                {locOptions.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
              </select>
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
              >
                <option value="" disabled>Select location…</option>
                {locOptions.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
              </select>
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
            <PhotoPicker onChange={(uploadedFiles) => form.setValue('photos', uploadedFiles)} max={10} />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>Apply</Button>
          </DialogFooter>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
