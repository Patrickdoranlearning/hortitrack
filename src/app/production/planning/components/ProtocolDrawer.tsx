"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ReferenceDataContext } from "@/contexts/ReferenceDataContext";
import { fetchJson } from "@/lib/http/fetchJson";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RouteNode = {
  id: string;
  label: string;
  durationDays: number;
  stageName?: string;
  locationName?: string;
};

const OPTIONAL_SELECT_VALUE = "__optional__";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().max(500).optional(),
  targetVarietyId: z.string().min(1, "Variety is required"),
  targetSizeId: z.string().optional(),
  summary: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function ProtocolDrawer({ open, onOpenChange, onSuccess }: Props) {
  const { data: refData } = React.useContext(ReferenceDataContext);
  const { toast } = useToast();
  const [nodes, setNodes] = React.useState<RouteNode[]>([
    { id: crypto.randomUUID(), label: "Propagate", durationDays: 30, stageName: "Propagation" },
    { id: crypto.randomUUID(), label: "Grow on", durationDays: 60, stageName: "Plug" },
    { id: crypto.randomUUID(), label: "Pot", durationDays: 90, stageName: "Potted" },
  ]);
  const [saving, setSaving] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      targetVarietyId: "",
      targetSizeId: "",
      summary: "",
    },
  });

  function updateNode(index: number, patch: Partial<RouteNode>) {
    setNodes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function addNode() {
    setNodes((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: "Stage",
        durationDays: 30,
      },
    ]);
  }

  function removeNode(index: number) {
    setNodes((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(values: FormValues) {
    if (!nodes.length) {
      toast({ title: "Add at least one stage", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const edges = nodes.slice(1).map((node, idx) => ({
        id: `e-${idx}`,
        from: nodes[idx].id,
        to: node.id,
      }));

      await fetchJson("/api/production/protocols", {
        method: "POST",
        body: JSON.stringify({
          name: values.name,
          description: values.description,
          targetVarietyId: values.targetVarietyId,
          targetSizeId: values.targetSizeId || undefined,
          summary: values.summary || undefined,
          route: {
            nodes,
            edges,
          },
        }),
      });

      toast({ title: "Protocol saved" });
      onSuccess?.();
      onOpenChange(false);
      form.reset({
        name: "",
        description: "",
        targetVarietyId: "",
      targetSizeId: "",
        summary: "",
      });
    } catch (error: any) {
      toast({
        title: "Failed to save protocol",
        description: error?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  const varieties = refData?.varieties ?? [];
  const sizes = refData?.sizes ?? [];

  return (
    <Dialog open={open} onOpenChange={(value) => !saving && onOpenChange(value)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">Create production recipe</DialogTitle>
          <DialogDescription>
            Define stages and timing for growing a variety from start to finish.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="flex-1 flex flex-col overflow-hidden" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="flex-1 overflow-y-auto pr-2">
              <div className="grid gap-4 p-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="1.5L Kramer's red 18m route" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="targetVarietyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target variety</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select variety" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {varieties.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="targetSizeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target size</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value === OPTIONAL_SELECT_VALUE ? "" : value)}
                          value={field.value ?? OPTIONAL_SELECT_VALUE}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Optional size" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={OPTIONAL_SELECT_VALUE}>Any size</SelectItem>
                            {sizes.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="summary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Summary</FormLabel>
                        <FormControl>
                          <Input placeholder="Key outcomes" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea rows={3} placeholder="Optional notes" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Route stages</h3>
                    <Button type="button" size="sm" variant="outline" onClick={addNode}>
                      Add stage
                    </Button>
                  </div>
                  {nodes.map((node, index) => (
                    <div key={node.id} className="rounded-lg border p-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="md:col-span-2">
                        <label className="text-xs font-medium">Label</label>
                        <Input value={node.label} onChange={(e) => updateNode(index, { label: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-medium">Duration (days)</label>
                        <Input
                          type="number"
                          min={0}
                          value={node.durationDays}
                          onChange={(e) => updateNode(index, { durationDays: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium">Stage / Location</label>
                        <Input
                          value={node.stageName ?? ""}
                          onChange={(e) => updateNode(index, { stageName: e.target.value })}
                          placeholder="Propagation, plug…"
                        />
                      </div>
                      <div className="md:col-span-4 flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removeNode(index)}
                          disabled={nodes.length <= 1}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="border-t pt-4 mt-4">
              <Button type="button" variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save protocol"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

