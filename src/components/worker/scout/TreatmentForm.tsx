"use client";

import { useState, useEffect } from "react";
import {
  Syringe,
  Scissors,
  Droplets,
  Calendar,
  AlertCircle,
  CheckCircle2,
  SkipForward,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { vibrateTap } from "@/lib/haptics";
import { listIpmProducts, type IpmProduct } from "@/app/actions/ipm";
import type { ScoutLogData } from "./ScoutLogForm";

export type TreatmentFormData = {
  type: "chemical" | "mechanical" | "feeding";
  // Chemical
  productId?: string;
  productName?: string;
  rate?: number;
  rateUnit?: string;
  method?: string;
  applicationsTotal?: number;
  applicationIntervalDays?: number;
  // Mechanical
  mechanicalAction?: "trimming" | "spacing" | "weeding" | "removing";
  // Feeding
  fertilizerName?: string;
  fertilizerRate?: number;
  fertilizerUnit?: string;
  // Common
  scheduledDate: string;
  notes?: string;
};

interface TreatmentFormProps {
  locationId: string;
  locationName: string;
  logData: ScoutLogData;
  suggestedType: "chemical" | "mechanical" | "feeding" | null;
  onSubmit: (data: TreatmentFormData) => void;
  onSkip: () => void;
  isSubmitting?: boolean;
}

const TREATMENT_TYPES = [
  {
    id: "chemical" as const,
    label: "Chemical",
    description: "IPM products / spraying",
    icon: Syringe,
  },
  {
    id: "mechanical" as const,
    label: "Mechanical",
    description: "Physical intervention",
    icon: Scissors,
  },
  {
    id: "feeding" as const,
    label: "Feeding",
    description: "Nutrient application",
    icon: Droplets,
  },
];

const MECHANICAL_ACTIONS = [
  { id: "trimming", label: "Trimming / Pruning", description: "Remove affected foliage" },
  { id: "spacing", label: "Spacing", description: "Increase airflow between plants" },
  { id: "weeding", label: "Hand Weeding", description: "Remove competing weeds" },
  { id: "removing", label: "Removing Plants", description: "Remove severely infected plants" },
];

const APPLICATION_METHODS = ["Foliar Spray", "Drench", "Bio-Control", "Granular"];

/**
 * Mobile-optimized form for scheduling treatments.
 * Part of the Scout Wizard flow.
 */
export function TreatmentForm({
  locationId,
  locationName,
  logData,
  suggestedType,
  onSubmit,
  onSkip,
  isSubmitting = false,
}: TreatmentFormProps) {
  const [treatmentType, setTreatmentType] = useState<"chemical" | "mechanical" | "feeding">(
    suggestedType || "chemical"
  );
  const [products, setProducts] = useState<IpmProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Form state
  const today = new Date().toISOString().split("T")[0];
  const [scheduledDate, setScheduledDate] = useState(today);
  const [notes, setNotes] = useState("");

  // Chemical state
  const [productId, setProductId] = useState("");
  const [rate, setRate] = useState("");
  const [rateUnit, setRateUnit] = useState("ml/L");
  const [method, setMethod] = useState("Foliar Spray");
  const [applicationsTotal, setApplicationsTotal] = useState(1);
  const [intervalDays, setIntervalDays] = useState("");

  // Mechanical state
  const [mechanicalAction, setMechanicalAction] = useState<string>("trimming");

  // Feeding state
  const [fertilizerName, setFertilizerName] = useState("");
  const [fertilizerRate, setFertilizerRate] = useState("");
  const [fertilizerUnit, setFertilizerUnit] = useState("g/L");

  // Load IPM products
  useEffect(() => {
    if (treatmentType === "chemical") {
      setLoadingProducts(true);
      listIpmProducts().then((result) => {
        if (result.success && result.data) {
          setProducts(result.data.filter((p) => p.isActive));
        }
        setLoadingProducts(false);
      });
    }
  }, [treatmentType]);

  // Get selected product info
  const selectedProduct = products.find((p) => p.id === productId);

  // Update defaults when product is selected
  useEffect(() => {
    if (selectedProduct) {
      if (selectedProduct.suggestedRate) {
        setRate(selectedProduct.suggestedRate.toString());
      }
      if (selectedProduct.suggestedRateUnit) {
        setRateUnit(selectedProduct.suggestedRateUnit);
      }
      if (selectedProduct.applicationMethods?.[0]) {
        setMethod(selectedProduct.applicationMethods[0]);
      }
    }
  }, [selectedProduct]);

  // Reason text for context
  const reasonText =
    logData.logType === "issue"
      ? `Issue: ${logData.issue?.reason} (${logData.issue?.severity})`
      : logData.reading?.ec !== undefined && logData.reading.ec < 0.5
      ? `Low EC reading: ${logData.reading.ec} mS/cm`
      : logData.reading?.ph !== undefined
      ? `pH reading: ${logData.reading.ph}`
      : "Based on reading";

  // Validation
  const canSubmit = () => {
    if (!scheduledDate) return false;

    if (treatmentType === "chemical") {
      return productId !== "";
    } else if (treatmentType === "mechanical") {
      return mechanicalAction !== "";
    } else if (treatmentType === "feeding") {
      return fertilizerName.trim() !== "";
    }
    return false;
  };

  const handleSubmit = () => {
    vibrateTap();

    const data: TreatmentFormData = {
      type: treatmentType,
      scheduledDate,
      notes: notes.trim() || undefined,
    };

    if (treatmentType === "chemical") {
      data.productId = productId;
      data.productName = selectedProduct?.name;
      data.rate = rate !== "" ? parseFloat(rate) : undefined;
      data.rateUnit = rateUnit;
      data.method = method;
      data.applicationsTotal = applicationsTotal;
      data.applicationIntervalDays =
        applicationsTotal > 1 && intervalDays !== ""
          ? parseInt(intervalDays, 10)
          : undefined;
    } else if (treatmentType === "mechanical") {
      data.mechanicalAction = mechanicalAction as TreatmentFormData["mechanicalAction"];
    } else if (treatmentType === "feeding") {
      data.fertilizerName = fertilizerName.trim();
      data.fertilizerRate = fertilizerRate !== "" ? parseFloat(fertilizerRate) : undefined;
      data.fertilizerUnit = fertilizerUnit;
    }

    onSubmit(data);
  };

  return (
    <div className="px-4 pb-4 space-y-4">
      {/* Context banner */}
      <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">{reasonText}</span>
          </div>
        </CardContent>
      </Card>

      {/* Treatment Type Selector */}
      <div className="grid grid-cols-3 gap-2">
        {TREATMENT_TYPES.map((type) => {
          const Icon = type.icon;
          const isSelected = treatmentType === type.id;
          const isSuggested = suggestedType === type.id;

          return (
            <button
              key={type.id}
              type="button"
              disabled={isSubmitting}
              onClick={() => { vibrateTap(); setTreatmentType(type.id); }}
              className={cn(
                "relative p-3 rounded-xl border-2 text-center transition-all",
                "min-h-[80px] active:scale-95 touch-manipulation",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:border-muted-foreground/30",
                isSubmitting && "opacity-50"
              )}
            >
              {isSuggested && (
                <Badge className="absolute -top-2 -right-2 text-[10px]">
                  Suggested
                </Badge>
              )}
              <Icon
                className={cn("h-6 w-6 mx-auto mb-1", isSelected && "text-primary")}
              />
              <p
                className={cn(
                  "text-sm font-medium",
                  isSelected && "text-primary"
                )}
              >
                {type.label}
              </p>
              <p className="text-[10px] text-muted-foreground">{type.description}</p>
            </button>
          );
        })}
      </div>

      {/* Chemical Treatment Form */}
      {treatmentType === "chemical" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Chemical Treatment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pb-4">
            {/* Product Selection */}
            <div className="space-y-2">
              <Label>IPM Product *</Label>
              {loadingProducts ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading products...
                </div>
              ) : products.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No active products. Add products first.
                </div>
              ) : (
                <Select
                  value={productId}
                  onValueChange={setProductId}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          <span>{p.name}</span>
                          {p.activeIngredient && (
                            <span className="text-xs text-muted-foreground">
                              ({p.activeIngredient})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Product Info */}
            {selectedProduct && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-2">
                {selectedProduct.targetPests.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedProduct.targetPests.slice(0, 4).map((pest) => (
                      <Badge key={pest} variant="outline" className="text-xs">
                        {pest}
                      </Badge>
                    ))}
                  </div>
                )}
                {selectedProduct.reiHours > 0 && (
                  <div className="flex items-center gap-1 text-amber-600">
                    <AlertCircle className="h-3 w-3" />
                    <span className="text-xs">
                      REI: {selectedProduct.reiHours} hours restriction
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Applications */}
            <div className="space-y-2">
              <Label>Applications</Label>
              <RadioGroup
                value={applicationsTotal.toString()}
                onValueChange={(v) => setApplicationsTotal(Number(v))}
                className="flex gap-4"
                disabled={isSubmitting}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="1" id="app-1" />
                  <Label htmlFor="app-1">Single</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="2" id="app-2" />
                  <Label htmlFor="app-2">2x</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="3" id="app-3" />
                  <Label htmlFor="app-3">3x</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Interval (for series) */}
            {applicationsTotal > 1 && (
              <div className="space-y-2">
                <Label htmlFor="interval">Days Between Applications</Label>
                <Input
                  id="interval"
                  type="number"
                  min="1"
                  placeholder="e.g. 7"
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(e.target.value)}
                  disabled={isSubmitting}
                  className="h-12"
                />
              </div>
            )}

            {/* Rate and Method */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="rate">Rate</Label>
                <Input
                  id="rate"
                  type="number"
                  step="0.01"
                  placeholder={selectedProduct?.suggestedRate?.toString() || "-"}
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  disabled={isSubmitting}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select
                  value={rateUnit}
                  onValueChange={setRateUnit}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ml/L">ml/L</SelectItem>
                    <SelectItem value="g/L">g/L</SelectItem>
                    <SelectItem value="ml/100L">ml/100L</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Method</Label>
                <Select
                  value={method}
                  onValueChange={setMethod}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPLICATION_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mechanical Treatment Form */}
      {treatmentType === "mechanical" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Mechanical Action</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="grid grid-cols-2 gap-2">
              {MECHANICAL_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => { vibrateTap(); setMechanicalAction(action.id); }}
                  className={cn(
                    "p-3 rounded-lg border text-left transition-all",
                    "min-h-[70px] active:scale-95 touch-manipulation",
                    mechanicalAction === action.id
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/30",
                    isSubmitting && "opacity-50"
                  )}
                >
                  <p className="font-medium text-sm">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feeding Treatment Form */}
      {treatmentType === "feeding" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Feeding Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pb-4">
            <div className="space-y-2">
              <Label htmlFor="fertilizer">Fertilizer / Feed *</Label>
              <Input
                id="fertilizer"
                placeholder="e.g. Osmocote, Liquid Seaweed"
                value={fertilizerName}
                onChange={(e) => setFertilizerName(e.target.value)}
                disabled={isSubmitting}
                className="h-12"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="fert-rate">Rate</Label>
                <Input
                  id="fert-rate"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 5"
                  value={fertilizerRate}
                  onChange={(e) => setFertilizerRate(e.target.value)}
                  disabled={isSubmitting}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select
                  value={fertilizerUnit}
                  onValueChange={setFertilizerUnit}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="g/L">g/L</SelectItem>
                    <SelectItem value="ml/L">ml/L</SelectItem>
                    <SelectItem value="g/m2">g/m2</SelectItem>
                    <SelectItem value="kg/ha">kg/ha</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Date and Notes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pb-4">
          <div className="space-y-2">
            <Label htmlFor="date">Scheduled Date *</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                disabled={isSubmitting}
                className="pl-10 h-12"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="treatment-notes">Notes (Optional)</Label>
            <Textarea
              id="treatment-notes"
              placeholder="Additional instructions..."
              className="resize-none min-h-[80px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1 h-14"
          onClick={() => { vibrateTap(); onSkip(); }}
          disabled={isSubmitting}
        >
          <SkipForward className="h-5 w-5 mr-2" />
          Skip
        </Button>
        <Button
          className="flex-1 h-14"
          onClick={handleSubmit}
          disabled={isSubmitting || !canSubmit()}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5 mr-2" />
              Schedule
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default TreatmentForm;
