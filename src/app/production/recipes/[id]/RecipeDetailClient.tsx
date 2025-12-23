"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  GripVertical,
  Clock,
  Thermometer,
  Droplets,
  Sun,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { PageFrame } from '@/ui/templates';
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/http";
import { ReferenceDataContext } from "@/contexts/ReferenceDataContext";
import type { ProtocolSummary } from "@/lib/planning/types";

type RouteNode = {
  id: string;
  label: string;
  durationDays: number;
  stageName?: string;
  locationName?: string;
  targets?: {
    tempDayC?: number | null;
    tempNightC?: number | null;
    humidityPct?: number | null;
    lightHours?: number | null;
  };
  notes?: string;
};

const OPTIONAL_SELECT_VALUE = "__optional__";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().max(1000).optional(),
  targetVarietyId: z.string().min(1, "Variety is required"),
  targetSizeId: z.string().optional(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  protocol: ProtocolSummary;
};

export default function RecipeDetailClient({ protocol }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const { data: refData } = React.useContext(ReferenceDataContext);
  const [saving, setSaving] = React.useState(false);
  const [expandedStages, setExpandedStages] = React.useState<Set<string>>(new Set());

  // Initialize nodes from protocol route
  const [nodes, setNodes] = React.useState<RouteNode[]>(() => {
    if (protocol.route?.nodes?.length) {
      return protocol.route.nodes.map((n) => ({
        id: n.id,
        label: n.label,
        durationDays: n.durationDays ?? 0,
        stageName: n.stageName,
        locationName: n.locationName,
        targets: {},
        notes: "",
      }));
    }
    return [
      { id: crypto.randomUUID(), label: "Propagate", durationDays: 30, stageName: "Propagation" },
    ];
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: protocol.name,
      description: protocol.description ?? "",
      targetVarietyId: protocol.targetVarietyId ?? "",
      targetSizeId: protocol.targetSizeId ?? "",
      isActive: protocol.isActive,
    },
  });

  const varieties = refData?.varieties ?? [];
  const sizes = refData?.sizes ?? [];
  const locations = refData?.locations ?? [];

  const totalDuration = React.useMemo(
    () => nodes.reduce((sum, n) => sum + n.durationDays, 0),
    [nodes]
  );

  function updateNode(index: number, patch: Partial<RouteNode>) {
    setNodes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function addNode() {
    const newId = crypto.randomUUID();
    setNodes((prev) => [
      ...prev,
      {
        id: newId,
        label: "New Stage",
        durationDays: 30,
      },
    ]);
    setExpandedStages((prev) => new Set([...prev, newId]));
  }

  function removeNode(index: number) {
    setNodes((prev) => prev.filter((_, i) => i !== index));
  }

  function moveNode(from: number, to: number) {
    if (to < 0 || to >= nodes.length) return;
    setNodes((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function toggleExpanded(id: string) {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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

      await fetchJson(`/api/production/protocols/${protocol.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: values.name,
          description: values.description || null,
          targetVarietyId: values.targetVarietyId,
          targetSizeId: values.targetSizeId || null,
          isActive: values.isActive,
          route: {
            nodes: nodes.map((n) => ({
              id: n.id,
              label: n.label,
              durationDays: n.durationDays,
              stageName: n.stageName,
              locationName: n.locationName,
            })),
            edges,
          },
        }),
      });

      toast({ title: "Recipe saved" });
      router.refresh();
    } catch (error: any) {
      toast({
        title: "Failed to save",
        description: error?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageFrame moduleKey="production">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/production/recipes">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-headline">{protocol.name}</h1>
            <p className="text-muted-foreground text-sm">
              {protocol.targetVarietyName}
              {protocol.targetSizeName && ` · ${protocol.targetSizeName}`}
            </p>
          </div>
          <Badge variant={protocol.isActive ? "default" : "secondary"}>
            {protocol.isActive ? "Active" : "Archived"}
          </Badge>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>Recipe Details</CardTitle>
                <CardDescription>Basic information about this production recipe</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 1.5L Kramer's Red 18m route" {...field} />
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
                      <FormLabel>Target Variety</FormLabel>
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

                <FormField
                  control={form.control}
                  name="targetSizeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Size</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === OPTIONAL_SELECT_VALUE ? "" : v)}
                        value={field.value || OPTIONAL_SELECT_VALUE}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Any size" />
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
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Active</FormLabel>
                        <FormDescription>
                          Active recipes can be used in planning
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder="Notes about this recipe, growing conditions, etc."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Timeline Overview */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Production Timeline</CardTitle>
                  <CardDescription>
                    {nodes.length} stages · {totalDuration} days total
                    {totalDuration > 0 && (
                      <span className="ml-2">
                        (~{Math.round(totalDuration / 30)} months)
                      </span>
                    )}
                  </CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addNode}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Stage
                </Button>
              </CardHeader>
              <CardContent>
                {/* Visual Timeline */}
                <div className="mb-6 flex items-center gap-1 overflow-x-auto pb-2">
                  {nodes.map((node, idx) => (
                    <React.Fragment key={node.id}>
                      <div
                        className="flex flex-col items-center min-w-[80px]"
                        style={{ flex: Math.max(node.durationDays, 10) }}
                      >
                        <div className="w-full h-3 rounded-full bg-primary/30 relative overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-primary rounded-full"
                            style={{ width: "100%" }}
                          />
                        </div>
                        <span className="text-xs mt-1 font-medium truncate max-w-full">
                          {node.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {node.durationDays}d
                        </span>
                      </div>
                      {idx < nodes.length - 1 && (
                        <div className="w-4 h-0.5 bg-muted-foreground/30 flex-shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                {/* Stage Editor */}
                <div className="space-y-3">
                  {nodes.map((node, index) => {
                    const isExpanded = expandedStages.has(node.id);
                    return (
                      <Collapsible
                        key={node.id}
                        open={isExpanded}
                        onOpenChange={() => toggleExpanded(node.id)}
                      >
                        <div className="rounded-lg border bg-card">
                          <div className="flex items-center gap-2 p-3">
                            <div className="flex flex-col gap-0.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() => moveNode(index, index - 1)}
                                disabled={index === 0}
                              >
                                <ChevronUp className="h-3 w-3" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() => moveNode(index, index + 1)}
                                disabled={index === nodes.length - 1}
                              >
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </div>

                            <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                              <div className="md:col-span-2">
                                <Input
                                  value={node.label}
                                  onChange={(e) => updateNode(index, { label: e.target.value })}
                                  placeholder="Stage name"
                                  className="font-medium"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <Input
                                  type="number"
                                  min={0}
                                  value={node.durationDays}
                                  onChange={(e) =>
                                    updateNode(index, { durationDays: Number(e.target.value) })
                                  }
                                  className="w-20"
                                />
                                <span className="text-sm text-muted-foreground">days</span>
                              </div>
                              <div>
                                <Select
                                  value={node.stageName || OPTIONAL_SELECT_VALUE}
                                  onValueChange={(v) =>
                                    updateNode(index, {
                                      stageName: v === OPTIONAL_SELECT_VALUE ? undefined : v,
                                    })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Phase" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={OPTIONAL_SELECT_VALUE}>No phase</SelectItem>
                                    <SelectItem value="Propagation">Propagation</SelectItem>
                                    <SelectItem value="Plug">Plug/Liner</SelectItem>
                                    <SelectItem value="Potted">Potted</SelectItem>
                                    <SelectItem value="Growing On">Growing On</SelectItem>
                                    <SelectItem value="Hardening">Hardening</SelectItem>
                                    <SelectItem value="Ready">Ready for Sale</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <CollapsibleTrigger asChild>
                              <Button type="button" variant="ghost" size="sm">
                                {isExpanded ? "Less" : "More"}
                              </Button>
                            </CollapsibleTrigger>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeNode(index)}
                              disabled={nodes.length <= 1}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <CollapsibleContent>
                            <div className="border-t p-3 grid gap-4 md:grid-cols-2 lg:grid-cols-4 bg-muted/30">
                              <div>
                                <label className="text-xs font-medium flex items-center gap-1 mb-1.5">
                                  <Thermometer className="h-3 w-3" />
                                  Day temp (°C)
                                </label>
                                <Input
                                  type="number"
                                  placeholder="e.g. 22"
                                  value={node.targets?.tempDayC ?? ""}
                                  onChange={(e) =>
                                    updateNode(index, {
                                      targets: {
                                        ...node.targets,
                                        tempDayC: e.target.value ? Number(e.target.value) : null,
                                      },
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium flex items-center gap-1 mb-1.5">
                                  <Thermometer className="h-3 w-3" />
                                  Night temp (°C)
                                </label>
                                <Input
                                  type="number"
                                  placeholder="e.g. 16"
                                  value={node.targets?.tempNightC ?? ""}
                                  onChange={(e) =>
                                    updateNode(index, {
                                      targets: {
                                        ...node.targets,
                                        tempNightC: e.target.value ? Number(e.target.value) : null,
                                      },
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium flex items-center gap-1 mb-1.5">
                                  <Droplets className="h-3 w-3" />
                                  Humidity (%)
                                </label>
                                <Input
                                  type="number"
                                  placeholder="e.g. 70"
                                  value={node.targets?.humidityPct ?? ""}
                                  onChange={(e) =>
                                    updateNode(index, {
                                      targets: {
                                        ...node.targets,
                                        humidityPct: e.target.value ? Number(e.target.value) : null,
                                      },
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium flex items-center gap-1 mb-1.5">
                                  <Sun className="h-3 w-3" />
                                  Light hours
                                </label>
                                <Input
                                  type="number"
                                  placeholder="e.g. 16"
                                  value={node.targets?.lightHours ?? ""}
                                  onChange={(e) =>
                                    updateNode(index, {
                                      targets: {
                                        ...node.targets,
                                        lightHours: e.target.value ? Number(e.target.value) : null,
                                      },
                                    })
                                  }
                                />
                              </div>
                              <div className="md:col-span-2 lg:col-span-4">
                                <label className="text-xs font-medium mb-1.5 block">
                                  Stage notes
                                </label>
                                <Textarea
                                  rows={2}
                                  placeholder="Specific instructions for this stage..."
                                  value={node.notes ?? ""}
                                  onChange={(e) => updateNode(index, { notes: e.target.value })}
                                />
                              </div>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" asChild>
                <Link href="/production/recipes">Cancel</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Recipe"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </PageFrame>
  );
}




