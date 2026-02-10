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
import { toast } from "@/lib/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ArrowDown, Clock, ChevronDown, Thermometer, Droplets, Sun, Leaf, AlertCircle, CloudSun } from "lucide-react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { FieldErrors } from "react-hook-form";

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

type SizeFlowStep = {
  id: string;
  sizeId: string;
  sizeName: string;
  stageName: string;
  fromYear: number;
  fromWeek: number;
  toYear: number;
  toWeek: number;
  conditions?: GrowingConditions;
};

const OPTIONAL_SELECT_VALUE = "__optional__";

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

// Generate relative year options (Year 1 to Year 5)
function getYearOptions(): number[] {
  return Array.from({ length: 5 }, (_, i) => i + 1);
}

// Format year/week as readable string (relative years)
function formatYearWeek(year: number, week: number): string {
  return `Year ${year} W${week.toString().padStart(2, '0')}`;
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

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().max(500).optional(),
  targetFamily: z.string().min(1, "Family is required"),
  seasonalOnly: z.boolean().default(false),
  seasons: z.array(z.string()).default([]),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function ProtocolDrawer({ open, onOpenChange, onSuccess }: Props) {
  const { data: refData } = React.useContext(ReferenceDataContext);
  const [saving, setSaving] = React.useState(false);
  const [expandedConditions, setExpandedConditions] = React.useState<Set<string>>(new Set());

  // Size flow state - TOP DOWN: Ready first, Propagation last
  // Uses relative years (Year 1, Year 2, etc.) since recipes are templates
  const [sizeFlow, setSizeFlow] = React.useState<SizeFlowStep[]>([
    {
      id: crypto.randomUUID(),
      sizeId: "",
      sizeName: "",
      stageName: "Ready",
      fromYear: 3,
      fromWeek: 38,
      toYear: 3,
      toWeek: 44,
    },
    {
      id: crypto.randomUUID(),
      sizeId: "",
      sizeName: "",
      stageName: "Propagation",
      fromYear: 1,
      fromWeek: 1,
      toYear: 1,
      toWeek: 6,
    },
  ]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      targetFamily: "",
    },
  });

  const varieties = refData?.varieties ?? [];
  const sizes = refData?.sizes ?? [];

  // Extract unique families from varieties
  const familyOptions = React.useMemo<ComboboxOption[]>(() => {
    const families = new Set<string>();
    varieties.forEach((v) => {
      if (v.family) families.add(v.family);
    });
    return Array.from(families)
      .sort()
      .map((f) => ({ value: f, label: f }));
  }, [varieties]);

  // Calculate total duration
  const totalDuration = React.useMemo(() => {
    if (sizeFlow.length < 2) return { weeks: 0, months: 0, years: 0 };
    const first = sizeFlow[0]; // Ready (end point)
    const last = sizeFlow[sizeFlow.length - 1]; // Propagation (start point)
    const weeks = weeksBetween(last.fromYear, last.fromWeek, first.toYear, first.toWeek);
    return calculateDuration(weeks);
  }, [sizeFlow]);

  function toggleConditions(id: string) {
    setExpandedConditions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function addStage(afterIndex: number) {
    const prevStep = sizeFlow[afterIndex];
    const nextStep = sizeFlow[afterIndex + 1];
    
    // Calculate midpoint
    const prevTotal = prevStep.toYear * 52 + prevStep.toWeek;
    const nextTotal = nextStep.fromYear * 52 + nextStep.fromWeek;
    const midTotal = Math.floor((prevTotal + nextTotal) / 2);
    const midYear = Math.floor(midTotal / 52);
    const midWeek = (midTotal % 52) || 52;
    
    // Default stage
    const stagesAbove = sizeFlow.slice(0, afterIndex + 1).map(s => s.stageName);
    let defaultStage = "Potted";
    if (!stagesAbove.includes("Potted")) defaultStage = "Potted";
    else if (!stagesAbove.includes("Plug")) defaultStage = "Plug";
    else if (!stagesAbove.includes("Growing On")) defaultStage = "Growing On";
    
    const newStep: SizeFlowStep = {
      id: crypto.randomUUID(),
      sizeId: "",
      sizeName: "",
      stageName: defaultStage,
      fromYear: midYear,
      fromWeek: Math.max(1, midWeek - 3),
      toYear: midYear,
      toWeek: Math.min(52, midWeek + 3),
    };
    
    setSizeFlow((prev) => {
      const next = [...prev];
      next.splice(afterIndex + 1, 0, newStep);
      return next;
    });
  }

  function updateSizeStep(index: number, patch: Partial<SizeFlowStep>) {
    setSizeFlow((prev) => {
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
    setSizeFlow((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        conditions: { ...next[index].conditions, ...patch },
      };
      return next;
    });
  }

  function removeSizeStep(index: number) {
    if (index === 0 || index === sizeFlow.length - 1) return;
    if (sizeFlow.length <= 2) return;
    setSizeFlow((prev) => prev.filter((_, i) => i !== index));
  }

  // Handle validation errors
  function onInvalid(errors: FieldErrors<FormValues>) {
    // Show toast for validation errors
    const errorMessages: string[] = [];
    
    // Check each field for errors
    Object.entries(errors).forEach(([field, error]) => {
      if (error?.message) {
        errorMessages.push(String(error.message));
      } else if (error?.root?.message) {
        // Handle nested root errors from refinements
        errorMessages.push(String(error.root.message));
      }
    });
    
    // If no specific errors but validation failed, do a manual check
    if (errorMessages.length === 0) {
      const values = form.getValues();
      if (!values.name || values.name.length < 2) {
        errorMessages.push("Name is required");
      }
      if (!values.targetFamily) {
        errorMessages.push("Family is required");
      }
    }
    
    if (errorMessages.length > 0) {
      toast.error(errorMessages.join(". "));
    } else {
      // Fallback message if we still can't determine the error
      toast.error("Please check all required fields are filled in correctly.");
    }
  }

  async function onSubmit(values: FormValues) {
    if (sizeFlow.length < 2) {
      toast.error("Need at least start and end stages");
      return;
    }

    setSaving(true);
    try {
      const nodesReversed = [...sizeFlow].reverse();
      
      const nodes = nodesReversed.map((step, idx) => {
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

      const edges = nodes.slice(1).map((node, idx) => ({
        id: `e-${idx}`,
        from: nodes[idx].id,
        to: node.id,
      }));

      const readyStep = sizeFlow[0];
      const propagationStep = sizeFlow[sizeFlow.length - 1];
      const finalSizeId = readyStep.sizeId || undefined;

      let durationStr = `${totalDuration.weeks} weeks`;
      if (totalDuration.years > 0) {
        durationStr = `${totalDuration.years}y ${totalDuration.months % 12}m`;
      } else if (totalDuration.months > 0) {
        durationStr = `${totalDuration.months} months`;
      }

      await fetchJson("/api/production/protocols", {
        method: "POST",
        body: JSON.stringify({
          name: values.name,
          description: values.description,
          targetVarietyId: null,
          targetSizeId: finalSizeId,
          summary: `${values.targetFamily} | ${formatYearWeek(propagationStep.fromYear, propagationStep.fromWeek)} → ${formatYearWeek(readyStep.toYear, readyStep.toWeek)} (${durationStr})`,
          route: { nodes, edges },
          steps: [],
          targets: {
            targetFamily: values.targetFamily,
            totalWeeks: totalDuration.weeks,
            seasonalOnly: values.seasonalOnly,
            seasons: values.seasons,
          },
        }),
      });

      toast.success("Recipe created");
      onSuccess?.();
      onOpenChange(false);
      
      form.reset();
      setSizeFlow([
        { id: crypto.randomUUID(), sizeId: "", sizeName: "", stageName: "Ready", fromYear: 3, fromWeek: 38, toYear: 3, toWeek: 44 },
        { id: crypto.randomUUID(), sizeId: "", sizeName: "", stageName: "Propagation", fromYear: 1, fromWeek: 1, toYear: 1, toWeek: 6 },
      ]);
      setExpandedConditions(new Set());
    } catch (error: any) {
      toast.error(error?.message ?? "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  const selectedFamily = form.watch("targetFamily");

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

  return (
    <Dialog open={open} onOpenChange={(value) => !saving && onOpenChange(value)}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">Create Production Recipe</DialogTitle>
          <DialogDescription>
            Define the growing timeline and conditions from propagation to sale.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="flex-1 flex flex-col overflow-hidden" onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
            <div className="flex-1 overflow-y-auto pr-2 space-y-6">
              
              {/* Form-level validation errors */}
              {Object.keys(form.formState.errors).length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {Object.entries(form.formState.errors).map(([field, error]) => (
                      <div key={field}>{error?.message ? String(error.message) : `Invalid ${field}`}</div>
                    ))}
                  </AlertDescription>
                </Alert>
              )}

              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="targetFamily"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plant Family</FormLabel>
                      <FormControl>
                        <Combobox
                          options={familyOptions}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Search families..."
                          emptyMessage="No families found"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipe Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={selectedFamily ? `${selectedFamily} - 2 Year Route` : "e.g. Heather 18-month"}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Seasonality */}
              <div className="space-y-4 p-4 rounded-lg border bg-muted/20">
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

              {/* Duration Summary */}
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">Total Duration: {durationDisplay}</div>
                  <div className="text-sm text-muted-foreground">
                    {sizeFlow.length} stages from propagation to sale
                  </div>
                </div>
              </div>

              {/* Production Timeline */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Production Timeline & Growing Guide</h3>
                  <span className="text-xs text-muted-foreground">Top = Sale ready, Bottom = Start</span>
                </div>

                {sizeFlow.map((step, index) => {
                  const stageConfig = STAGE_OPTIONS.find((s) => s.value === step.stageName);
                  const isFirst = index === 0;
                  const isLast = index === sizeFlow.length - 1;
                  const canRemove = !isFirst && !isLast && sizeFlow.length > 2;
                  const isConditionsOpen = expandedConditions.has(step.id);
                  
                  return (
                    <React.Fragment key={step.id}>
                      <div className="rounded-lg border bg-card overflow-hidden">
                        {/* Main Stage Row */}
                        <div className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Badge 
                                variant="outline" 
                                className={`${stageConfig?.color ?? 'bg-gray-500'} text-white border-0 px-3 py-1`}
                              >
                                {stageConfig?.label ?? step.stageName}
                              </Badge>
                              {!isFirst && !isLast && (
                                <Select
                                  value={step.stageName}
                                  onValueChange={(v) => updateSizeStep(index, { stageName: v })}
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
                            {canRemove && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeSizeStep(index)}
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
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
                                  value={step.fromYear.toString()}
                                  onValueChange={(v) => updateSizeStep(index, { fromYear: Number(v) })}
                                >
                                  <SelectTrigger className="w-[90px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getYearOptions().map((year) => (
                                      <SelectItem key={year} value={year.toString()}>Year {year}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select
                                  value={step.fromWeek.toString()}
                                  onValueChange={(v) => updateSizeStep(index, { fromWeek: Number(v) })}
                                >
                                  <SelectTrigger className="w-[80px]">
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
                                  value={step.toYear.toString()}
                                  onValueChange={(v) => updateSizeStep(index, { toYear: Number(v) })}
                                >
                                  <SelectTrigger className="w-[90px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getYearOptions().map((year) => (
                                      <SelectItem key={year} value={year.toString()}>Year {year}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select
                                  value={step.toWeek.toString()}
                                  onValueChange={(v) => updateSizeStep(index, { toWeek: Number(v) })}
                                >
                                  <SelectTrigger className="w-[80px]">
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
                                value={step.sizeId || OPTIONAL_SELECT_VALUE}
                                onValueChange={(v) => updateSizeStep(index, { sizeId: v === OPTIONAL_SELECT_VALUE ? "" : v })}
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
                        <Collapsible open={isConditionsOpen} onOpenChange={() => toggleConditions(step.id)}>
                          <CollapsibleTrigger asChild>
                            <button
                              type="button"
                              className="w-full flex items-center justify-between px-4 py-2 border-t bg-muted/30 hover:bg-muted/50 transition-colors text-sm"
                            >
                              <span className="flex items-center gap-2 text-muted-foreground">
                                <Leaf className="h-4 w-4" />
                                Growing Conditions
                                {step.conditions?.media && (
                                  <Badge variant="secondary" className="text-xs">{step.conditions.media}</Badge>
                                )}
                              </span>
                              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isConditionsOpen ? 'rotate-180' : ''}`} />
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="p-4 border-t bg-muted/20 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                              {/* Media/Soil */}
                              <div>
                                <label className="text-xs font-medium mb-1.5 block">Growing Media</label>
                                <Select
                                  value={step.conditions?.media || OPTIONAL_SELECT_VALUE}
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
                                  value={step.conditions?.tempDayC ?? ""}
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
                                  value={step.conditions?.tempNightC ?? ""}
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
                                  value={step.conditions?.humidityPct ?? ""}
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
                                  value={step.conditions?.lightHours ?? ""}
                                  onChange={(e) => updateConditions(index, { lightHours: e.target.value ? Number(e.target.value) : null })}
                                />
                              </div>

                              {/* Feeding */}
                              <div>
                                <label className="text-xs font-medium mb-1.5 block">Feeding Schedule</label>
                                <Input
                                  placeholder="e.g. Weekly N-P-K"
                                  value={step.conditions?.feedingWeeks ?? ""}
                                  onChange={(e) => updateConditions(index, { feedingWeeks: e.target.value })}
                                />
                              </div>

                              {/* Watering */}
                              <div>
                                <label className="text-xs font-medium mb-1.5 block">Watering</label>
                                <Input
                                  placeholder="e.g. Keep moist"
                                  value={step.conditions?.watering ?? ""}
                                  onChange={(e) => updateConditions(index, { watering: e.target.value })}
                                />
                              </div>

                              {/* Spacing */}
                              <div>
                                <label className="text-xs font-medium mb-1.5 block">Spacing</label>
                                <Input
                                  placeholder="e.g. 15cm centres"
                                  value={step.conditions?.spacing ?? ""}
                                  onChange={(e) => updateConditions(index, { spacing: e.target.value })}
                                />
                              </div>

                              {/* Stage Notes */}
                              <div className="md:col-span-2 lg:col-span-4">
                                <label className="text-xs font-medium mb-1.5 block">Stage Notes</label>
                                <Textarea
                                  rows={2}
                                  placeholder="Special instructions for this stage..."
                                  value={step.conditions?.notes ?? ""}
                                  onChange={(e) => updateConditions(index, { notes: e.target.value })}
                                />
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>

                      {/* Add Stage Button */}
                      {index < sizeFlow.length - 1 && (
                        <div className="flex justify-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => addStage(index)}
                            className="text-muted-foreground hover:text-foreground"
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

              {/* Recipe Notes */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipe Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        rows={2} 
                        placeholder="General notes about this production recipe..."
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="border-t pt-4 mt-4">
              <Button type="button" variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating..." : "Create Recipe"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
