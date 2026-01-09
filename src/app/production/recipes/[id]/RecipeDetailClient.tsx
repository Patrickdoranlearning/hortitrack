"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Trash2,
  Clock,
  Thermometer,
  Droplets,
  Sun,
  ChevronDown,
  ArrowLeft,
  Save,
  Leaf,
  ArrowDown,
  CloudSun,
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
import RecipePerformanceChart from "@/components/production/RecipePerformanceChart";

type GrowingConditions = {
  media?: string;
  tempDayC?: number | null;
  tempNightC?: number | null;
  humidityPct?: number | null;
  lightHours?: number | null;
  feedingWeeks?: string;
  watering?: string;
  spacing?: string;
  notes?: string;
};

type RouteNode = {
  id: string;
  label: string;
  durationDays: number;
  stageName: string;
  locationName?: string;
  sizeId?: string;
  sizeName?: string;
  fromYear: number;
  fromWeek: number;
  toYear: number;
  toWeek: number;
  conditions?: GrowingConditions;
};

const STAGE_OPTIONS = [
  { value: "Ready", label: "Ready for Sale", color: "bg-emerald-500" },
  { value: "Hardening", label: "Hardening Off", color: "bg-orange-500" },
  { value: "Growing On", label: "Growing On", color: "bg-purple-500" },
  { value: "Potted", label: "Potted", color: "bg-amber-500" },
  { value: "Plug", label: "Plug/Liner", color: "bg-blue-500" },
  { value: "Propagation", label: "Propagation", color: "bg-green-500" },
];

const MEDIA_OPTIONS = [
  "Peat-free compost",
  "Peat-based compost", 
  "Coir",
  "Perlite mix",
  "Bark-based",
  "Rockwool",
  "Other",
];

// Generate week options (1-52)
function getWeekOptions(): number[] {
  return Array.from({ length: 52 }, (_, i) => i + 1);
}

// Generate year options (current year - 1 to current year + 6)
function getYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 8 }, (_, i) => currentYear - 1 + i);
}

// Format year/week as readable string
function formatYearWeek(year: number, week: number): string {
  return `${year} W${week.toString().padStart(2, '0')}`;
}

// Calculate weeks between two year/week points
function weeksBetween(fromYear: number, fromWeek: number, toYear: number, toWeek: number): number {
  const fromTotal = fromYear * 52 + fromWeek;
  const toTotal = toYear * 52 + toWeek;
  return Math.max(0, toTotal - fromTotal);
}

// Calculate total duration
function calculateDuration(weeks: number): { weeks: number; months: number; years: number } {
  const months = Math.round(weeks / 4.33);
  const years = Math.floor(months / 12);
  return { weeks, months, years };
}

const OPTIONAL_SELECT_VALUE = "__optional__";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().max(1000).optional(),
  targetVarietyId: z.string().min(1, "Variety is required"),
  targetSizeId: z.string().optional(),
  isActive: z.boolean(),
  seasonalOnly: z.boolean().default(false),
  seasons: z.array(z.string()).default([]),
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

  const currentYear = new Date().getFullYear();

  // Initialize nodes from protocol route - reversed for TOP-DOWN display (Ready first)
  const [nodes, setNodes] = React.useState<RouteNode[]>(() => {
    if (protocol.route?.nodes?.length) {
      // Check if existing nodes are already in the new format (fromYear/fromWeek exist)
      const hasPhase2Data = protocol.route.nodes.some(n => 'fromYear' in n);
      
      if (hasPhase2Data) {
        // Already Phase 2, keep as is but ensure order is correct (Ready first)
        const sorted = [...protocol.route.nodes].sort((a, b) => {
          const aTotal = (a.toYear ?? 0) * 52 + (a.toWeek ?? 0);
          const bTotal = (b.toYear ?? 0) * 52 + (b.toWeek ?? 0);
          return bTotal - aTotal;
        });
        return sorted as RouteNode[];
      }

      // Upgrade Phase 1 nodes to Phase 2
      // We'll estimate years/weeks backwards from a default "Ready" point
      let currentEndTotal = (currentYear + 2) * 52 + 44; // Default Ready Week 44
      
      const upgraded = [...protocol.route.nodes].reverse().map((n) => {
        const durationWeeks = Math.ceil((n.durationDays ?? 30) / 7);
        const startTotal = currentEndTotal - durationWeeks;
        
        const node: RouteNode = {
          id: n.id,
          label: n.label || n.stageName || "Stage",
          stageName: n.stageName || "Growing On",
          durationDays: n.durationDays ?? 30,
          locationName: n.locationName,
          sizeId: (n as any).sizeId,
          sizeName: (n as any).sizeName,
          fromYear: Math.floor(startTotal / 52),
          fromWeek: (startTotal % 52) || 52,
          toYear: Math.floor(currentEndTotal / 52),
          toWeek: (currentEndTotal % 52) || 52,
          conditions: {
            tempDayC: (n as any).targets?.tempDayC,
            tempNightC: (n as any).targets?.tempNightC,
            humidityPct: (n as any).targets?.humidityPct,
            lightHours: (n as any).targets?.lightHours,
            notes: n.notes,
          }
        };
        
        currentEndTotal = startTotal; // Next stage ends when this one starts
        return node;
      });
      return upgraded;
    }
    
    // Default nodes if none exist
    return [
      { 
        id: crypto.randomUUID(), 
        label: "Ready", 
        stageName: "Ready", 
        durationDays: 0,
        fromYear: currentYear + 2, 
        fromWeek: 38,
        toYear: currentYear + 2,
        toWeek: 44,
      },
      { 
        id: crypto.randomUUID(), 
        label: "Propagation", 
        stageName: "Propagation", 
        durationDays: 30,
        fromYear: currentYear, 
        fromWeek: 1,
        toYear: currentYear,
        toWeek: 6,
      },
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
      seasonalOnly: (protocol.definition?.targets as any)?.seasonalOnly ?? false,
      seasons: (protocol.definition?.targets as any)?.seasons ?? [],
    },
  });

  const varieties = refData?.varieties ?? [];
  const sizes = refData?.sizes ?? [];
  const locations = refData?.locations ?? [];

  const totalDuration = React.useMemo(() => {
    if (nodes.length < 2) return { weeks: 0, months: 0, years: 0 };
    const first = nodes[0]; // Ready (end point)
    const last = nodes[nodes.length - 1]; // Propagation (start point)
    const weeks = weeksBetween(last.fromYear, last.fromWeek, first.toYear, first.toWeek);
    return calculateDuration(weeks);
  }, [nodes]);

  const durationDisplay = React.useMemo(() => {
    if (totalDuration.years > 0) {
      const rem = totalDuration.months % 12;
      return rem > 0 
        ? `${totalDuration.years} year${totalDuration.years > 1 ? 's' : ''} ${rem} month${rem > 1 ? 's' : ''}`
        : `${totalDuration.years} year${totalDuration.years > 1 ? 's' : ''}`;
    }
    if (totalDuration.months > 0) {
      return `${totalDuration.months} month${totalDuration.months > 1 ? 's' : ''}`;
    }
    return `${totalDuration.weeks} week${totalDuration.weeks !== 1 ? 's' : ''}`;
  }, [totalDuration]);

  function updateNode(index: number, patch: Partial<RouteNode>) {
    setNodes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      
      if (patch.sizeId) {
        const size = sizes.find((s) => s.id === patch.sizeId);
        next[index].sizeName = size?.name ?? "";
      }
      
      return next;
    });
  }

  function updateConditions(index: number, patch: Partial<GrowingConditions>) {
    setNodes((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        conditions: { ...next[index].conditions, ...patch },
      };
      return next;
    });
  }

  function addNode(afterIndex: number) {
    const prevStep = nodes[afterIndex];
    const nextStep = nodes[afterIndex + 1];
    
    // Calculate midpoint
    const prevTotal = prevStep.toYear * 52 + prevStep.toWeek;
    const nextTotal = nextStep.fromYear * 52 + nextStep.fromWeek;
    const midTotal = Math.floor((prevTotal + nextTotal) / 2);
    const midYear = Math.floor(midTotal / 52);
    const midWeek = (midTotal % 52) || 52;
    
    // Default stage
    const stagesAbove = nodes.slice(0, afterIndex + 1).map(s => s.stageName);
    let defaultStage = "Potted";
    if (!stagesAbove.includes("Potted")) defaultStage = "Potted";
    else if (!stagesAbove.includes("Plug")) defaultStage = "Plug";
    else if (!stagesAbove.includes("Growing On")) defaultStage = "Growing On";
    
    const newId = crypto.randomUUID();
    const newNode: RouteNode = {
      id: newId,
      label: defaultStage,
      stageName: defaultStage,
      durationDays: 30,
      fromYear: midYear,
      fromWeek: Math.max(1, midWeek - 3),
      toYear: midYear,
      toWeek: Math.min(52, midWeek + 3),
    };
    
    setNodes((prev) => {
      const next = [...prev];
      next.splice(afterIndex + 1, 0, newNode);
      return next;
    });
    setExpandedStages((prev) => new Set([...prev, newId]));
  }

  function removeNode(index: number) {
    if (index === 0 || index === nodes.length - 1) return;
    if (nodes.length <= 2) return;
    setNodes((prev) => prev.filter((_, i) => i !== index));
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
    if (nodes.length < 2) {
      toast({ title: "Need at least start and end stages", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const nodesReversed = [...nodes].reverse();
      
      const saveNodes = nodesReversed.map((step, idx) => {
        let durationDays = 0;
        if (idx < nodesReversed.length - 1) {
          const nextStep = nodesReversed[idx + 1];
          const weeks = weeksBetween(step.toYear, step.toWeek, nextStep.fromYear, nextStep.fromWeek);
          durationDays = weeks * 7;
        }
        
        return {
          id: step.id,
          label: step.stageName,
          stageName: step.stageName,
          durationDays,
          sizeId: step.sizeId || undefined,
          sizeName: step.sizeName || undefined,
          fromYear: step.fromYear,
          fromWeek: step.fromWeek,
          toYear: step.toYear,
          toWeek: step.toWeek,
          conditions: step.conditions,
        };
      });

      const edges = saveNodes.slice(1).map((node, idx) => ({
        id: `e-${idx}`,
        from: saveNodes[idx].id,
        to: node.id,
      }));

      const readyStep = nodes[0];
      const propagationStep = nodes[nodes.length - 1];
      const finalSizeId = values.targetSizeId || readyStep.sizeId || undefined;
      const variety = varieties.find(v => v.id === values.targetVarietyId);

      let durationStr = `${totalDuration.weeks} weeks`;
      if (totalDuration.years > 0) {
        durationStr = `${totalDuration.years}y ${totalDuration.months % 12}m`;
      } else if (totalDuration.months > 0) {
        durationStr = `${totalDuration.months} months`;
      }

      await fetchJson(`/api/production/protocols/${protocol.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: values.name,
          description: values.description || null,
          targetVarietyId: values.targetVarietyId,
          targetSizeId: finalSizeId,
          isActive: values.isActive,
          summary: `${variety?.name || protocol.targetVarietyName || ''} | ${formatYearWeek(propagationStep.fromYear, propagationStep.fromWeek)} → ${formatYearWeek(readyStep.toYear, readyStep.toWeek)} (${durationStr})`,
          targets: {
            seasonalOnly: values.seasonalOnly,
            seasons: values.seasons,
            totalWeeks: totalDuration.weeks,
          },
          route: {
            nodes: saveNodes,
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

        {/* Performance Analytics */}
        <RecipePerformanceChart
          protocolId={protocol.id}
          plannedDurationDays={totalDuration}
        />

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

                <div className="md:col-span-2 space-y-4 p-4 rounded-lg border bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CloudSun className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">Seasonality Restrictions</div>
                        <div className="text-xs text-muted-foreground">
                          Limit when this recipe can be started
                        </div>
                      </div>
                    </div>
                    <FormField
                      control={form.control}
                      name="seasonalOnly"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal">Enable</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  {form.watch("seasonalOnly") && (
                    <FormField
                      control={form.control}
                      name="seasons"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex flex-wrap gap-2">
                            {["Spring", "Summer", "Autumn", "Winter"].map((season) => {
                              const isSelected = field.value?.includes(season);
                              return (
                                <Badge
                                  key={season}
                                  variant={isSelected ? "default" : "outline"}
                                  className="cursor-pointer px-3 py-1"
                                  onClick={() => {
                                    const current = field.value || [];
                                    const next = isSelected
                                      ? current.filter((s) => s !== season)
                                      : [...current, season];
                                    field.onChange(next);
                                  }}
                                >
                                  {season}
                                </Badge>
                              );
                            })}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Timeline Overview */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Production Timeline & Growing Guide</CardTitle>
                  <CardDescription>
                    {durationDisplay} duration · {nodes.length} stages
                    <div className="text-xs text-muted-foreground mt-1">
                      Top = Sale ready, Bottom = Start
                    </div>
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {nodes.map((node, index) => {
                    const stageConfig = STAGE_OPTIONS.find((s) => s.value === node.stageName);
                    const isFirst = index === 0;
                    const isLast = index === nodes.length - 1;
                    const canRemove = !isFirst && !isLast && nodes.length > 2;
                    const isExpanded = expandedStages.has(node.id);
                    
                    return (
                      <React.Fragment key={node.id}>
                        <div className="rounded-lg border bg-card overflow-hidden">
                          {/* Main Stage Row */}
                          <div className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Badge 
                                  variant="outline" 
                                  className={`${stageConfig?.color ?? 'bg-gray-500'} text-white border-0 px-3 py-1`}
                                >
                                  {stageConfig?.label ?? node.stageName}
                                </Badge>
                                {!isFirst && !isLast && (
                                  <Select
                                    value={node.stageName}
                                    onValueChange={(v) => updateNode(index, { stageName: v })}
                                  >
                                    <SelectTrigger className="w-[140px] h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {STAGE_OPTIONS.filter(o => o.value !== "Propagation" && o.value !== "Ready").map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                          {opt.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <CollapsibleTrigger asChild>
                                  <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => toggleExpanded(node.id)}
                                  >
                                    {isExpanded ? "Hide Details" : "Show Details"}
                                    <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                  </Button>
                                </CollapsibleTrigger>
                                {canRemove && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeNode(index)}
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Timeline: From → To */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                              {/* From */}
                              <div className="md:col-span-4">
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                                  From
                                </label>
                                <div className="flex gap-2">
                                  <Select
                                    value={node.fromYear.toString()}
                                    onValueChange={(v) => updateNode(index, { fromYear: Number(v) })}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {getYearOptions().map((year) => (
                                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Select
                                    value={node.fromWeek.toString()}
                                    onValueChange={(v) => updateNode(index, { fromWeek: Number(v) })}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {getWeekOptions().map((week) => (
                                        <SelectItem key={week} value={week.toString()}>W{week.toString().padStart(2, '0')}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              {/* To */}
                              <div className="md:col-span-4">
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                                  To
                                </label>
                                <div className="flex gap-2">
                                  <Select
                                    value={node.toYear.toString()}
                                    onValueChange={(v) => updateNode(index, { toYear: Number(v) })}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {getYearOptions().map((year) => (
                                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Select
                                    value={node.toWeek.toString()}
                                    onValueChange={(v) => updateNode(index, { toWeek: Number(v) })}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {getWeekOptions().map((week) => (
                                        <SelectItem key={week} value={week.toString()}>W{week.toString().padStart(2, '0')}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              {/* Container Size */}
                              <div className="md:col-span-4">
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                                  Container
                                </label>
                                <Select
                                  value={node.sizeId || OPTIONAL_SELECT_VALUE}
                                  onValueChange={(v) => updateNode(index, { sizeId: v === OPTIONAL_SELECT_VALUE ? "" : v })}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={OPTIONAL_SELECT_VALUE}>Not specified</SelectItem>
                                    {sizes.map((s) => (
                                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>

                          {/* Growing Conditions (Collapsible) */}
                          <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(node.id)}>
                            <CollapsibleContent>
                              <div className="p-4 border-t bg-muted/20 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                {/* Media/Soil */}
                                <div>
                                  <label className="text-xs font-medium mb-1.5 block">Growing Media</label>
                                  <Select
                                    value={node.conditions?.media || OPTIONAL_SELECT_VALUE}
                                    onValueChange={(v) => updateConditions(index, { media: v === OPTIONAL_SELECT_VALUE ? undefined : v })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value={OPTIONAL_SELECT_VALUE}>Not specified</SelectItem>
                                      {MEDIA_OPTIONS.map((m) => (
                                        <SelectItem key={m} value={m}>{m}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Temperature Day */}
                                <div>
                                  <label className="text-xs font-medium mb-1.5 flex items-center gap-1">
                                    <Thermometer className="h-3 w-3" /> Day Temp (°C)
                                  </label>
                                  <Input
                                    type="number"
                                    placeholder="e.g. 20"
                                    value={node.conditions?.tempDayC ?? ""}
                                    onChange={(e) => updateConditions(index, { tempDayC: e.target.value ? Number(e.target.value) : null })}
                                  />
                                </div>

                                {/* Temperature Night */}
                                <div>
                                  <label className="text-xs font-medium mb-1.5 flex items-center gap-1">
                                    <Thermometer className="h-3 w-3" /> Night Temp (°C)
                                  </label>
                                  <Input
                                    type="number"
                                    placeholder="e.g. 14"
                                    value={node.conditions?.tempNightC ?? ""}
                                    onChange={(e) => updateConditions(index, { tempNightC: e.target.value ? Number(e.target.value) : null })}
                                  />
                                </div>

                                {/* Humidity */}
                                <div>
                                  <label className="text-xs font-medium mb-1.5 flex items-center gap-1">
                                    <Droplets className="h-3 w-3" /> Humidity (%)
                                  </label>
                                  <Input
                                    type="number"
                                    placeholder="e.g. 70"
                                    value={node.conditions?.humidityPct ?? ""}
                                    onChange={(e) => updateConditions(index, { humidityPct: e.target.value ? Number(e.target.value) : null })}
                                  />
                                </div>

                                {/* Light Hours */}
                                <div>
                                  <label className="text-xs font-medium mb-1.5 flex items-center gap-1">
                                    <Sun className="h-3 w-3" /> Light Hours
                                  </label>
                                  <Input
                                    type="number"
                                    placeholder="e.g. 16"
                                    value={node.conditions?.lightHours ?? ""}
                                    onChange={(e) => updateConditions(index, { lightHours: e.target.value ? Number(e.target.value) : null })}
                                  />
                                </div>

                                {/* Feeding */}
                                <div>
                                  <label className="text-xs font-medium mb-1.5 block">Feeding Schedule</label>
                                  <Input
                                    placeholder="e.g. Weekly N-P-K"
                                    value={node.conditions?.feedingWeeks ?? ""}
                                    onChange={(e) => updateConditions(index, { feedingWeeks: e.target.value })}
                                  />
                                </div>

                                {/* Watering */}
                                <div>
                                  <label className="text-xs font-medium mb-1.5 block">Watering</label>
                                  <Input
                                    placeholder="e.g. Keep moist"
                                    value={node.conditions?.watering ?? ""}
                                    onChange={(e) => updateConditions(index, { watering: e.target.value })}
                                  />
                                </div>

                                {/* Spacing */}
                                <div>
                                  <label className="text-xs font-medium mb-1.5 block">Spacing</label>
                                  <Input
                                    placeholder="e.g. 15cm centres"
                                    value={node.conditions?.spacing ?? ""}
                                    onChange={(e) => updateConditions(index, { spacing: e.target.value })}
                                  />
                                </div>

                                {/* Stage Notes */}
                                <div className="md:col-span-2 lg:col-span-4">
                                  <label className="text-xs font-medium mb-1.5 block">Stage Notes</label>
                                  <Textarea
                                    rows={2}
                                    placeholder="Special instructions for this stage..."
                                    value={node.conditions?.notes ?? ""}
                                    onChange={(e) => updateConditions(index, { notes: e.target.value })}
                                  />
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </div>

                        {/* Add Stage Button */}
                        {index < nodes.length - 1 && (
                          <div className="flex justify-center my-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => addNode(index)}
                              className="text-muted-foreground hover:text-foreground h-8"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add stage
                              <ArrowDown className="h-3 w-3 ml-1" />
                            </Button>
                          </div>
                        )}
                      </React.Fragment>
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




