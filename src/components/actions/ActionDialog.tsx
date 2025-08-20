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

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultBatchIds: string[];
  locations: { id: string; name: string }[];
};

type AnyAction = z.infer<typeof ActionInputSchema>;

export function ActionDialog({ open, onOpenChange, defaultBatchIds, locations }: Props) {
  const { toast } = useToast();
  const [tab, setTab] = React.useState<"MOVE"|"SPLIT"|"FLAGS"|"NOTE">("MOVE");
  const [files, setFiles] = React.useState<File[]>([]);

  const baseDefaults: Partial<AnyAction> = {
    batchIds: defaultBatchIds,
    actionId: uuid(),
  };

  const form = useForm<AnyAction>({
    resolver: zodResolver(ActionInputSchema),
    defaultValues: { type: "MOVE", ...baseDefaults } as any,
    mode: "onChange",
  });

  React.useEffect(() => {
    form.reset({ ...form.getValues(), batchIds: defaultBatchIds });
  }, [defaultBatchIds, form]); // Keep selection synced

  async function submit() {
    // Ensure 'type' is set (prevents silent zod failure)
    form.setValue("type" as any, tab as any, { shouldValidate: true, shouldDirty: true });
    const isValid = await form.trigger();
    if (!isValid) {
      toast({variant: 'destructive', title: "Please complete required fields"});
      return;
    }
    let photos: AnyAction extends { photos: infer P } ? any : any;
    if (files.length) {
      try {
        const { uploadActionPhotos } = await import("@/lib/firebase");
        // Use first selected batch for path scoping
        const scopeBatch = (form.getValues() as any).batchIds?.[0] ?? "misc";
        photos = await uploadActionPhotos(scopeBatch, files);
      } catch (e: any) {
        toast({variant: 'destructive', title: "Photo upload failed: " + (e?.message ?? "error")});
        return;
      }
    }
    const values = { ...form.getValues(), photos };
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({variant: 'destructive', title: data?.error ?? "Action failed"});
        return;
      }
      toast({title: "Action applied"});
      setFiles([]);
      onOpenChange(false);
    } catch (e: any) {
      toast({variant: 'destructive', title: e?.message ?? "Network error"});
    }
  }

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
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="MOVE">Move</TabsTrigger>
            <TabsTrigger value="SPLIT">Split</TabsTrigger>
            <TabsTrigger value="FLAGS">Trim/Space</TabsTrigger>
            <TabsTrigger value="NOTE">Note</TabsTrigger>
          </TabsList>

          {/* MOVE */}
          <TabsContent value="MOVE" className="space-y-3 pt-3">
            <div>
              <label className="text-sm">To Location</label>
              <select
                className="w-full border rounded-md p-2"
                onChange={(e) => form.setValue("toLocationId" as any, e.target.value, { shouldValidate: true })}
                defaultValue=""
              >
                <option value="" disabled>Select location…</option>
                {locOptions.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm">Quantity (optional)</label>
              <Input
                type="number"
                min={1}
                placeholder="Move full if empty"
                onChange={(e) => form.setValue("quantity" as any, e.target.value ? Number(e.target.value) : undefined, { shouldValidate: true })}
              />
            </div>
            <Textarea placeholder="Note (optional)" onChange={(e) => form.setValue("note" as any, e.target.value)} />
          </TabsContent>

          {/* SPLIT */}
          <TabsContent value="SPLIT" className="space-y-3 pt-3">
            <p className="text-xs text-muted-foreground">Split acts on a single batch.</p>
            <div>
              <label className="text-sm">To Location</label>
              <select
                className="w-full border rounded-md p-2"
                onChange={(e) => form.setValue("toLocationId" as any, e.target.value, { shouldValidate: true })}
                defaultValue=""
              >
                <option value="" disabled>Select location…</option>
                {locOptions.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm">Split Quantity</label>
              <Input
                type="number"
                min={1}
                onChange={(e) => form.setValue("splitQuantity" as any, Number(e.target.value), { shouldValidate: true })}
              />
            </div>
            <Textarea placeholder="Note (optional)" onChange={(e) => form.setValue("note" as any, e.target.value)} />
          </TabsContent>

          {/* FLAGS */}
          <TabsContent value="FLAGS" className="space-y-3 pt-3">
            <div className="flex gap-6">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" onChange={(e) => form.setValue("trimmed" as any, e.target.checked)} />
                <span>Trimmed</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" onChange={(e) => form.setValue("spaced" as any, e.target.checked)} />
                <span>Spaced</span>
              </label>
            </div>
            <Textarea placeholder="Note (optional)" onChange={(e) => form.setValue("note" as any, e.target.value)} />
          </TabsContent>

          {/* NOTE */}
          <TabsContent value="NOTE" className="space-y-3 pt-3">
            <Input placeholder="Title" onChange={(e) => form.setValue("title" as any, e.target.value, { shouldValidate: true })} />
            <Textarea placeholder="Details (optional)" onChange={(e) => form.setValue("body" as any, e.target.value)} />
          </TabsContent>

          {/* PHOTOS (common) */}
          <div className="mt-4 space-y-2">
            <label className="text-sm font-medium">Photos (optional)</label>
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.length > 0 && (
              <p className="text-xs text-muted-foreground">{files.length} file(s) selected</p>
            )}
          </div>
        </Tabs>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
