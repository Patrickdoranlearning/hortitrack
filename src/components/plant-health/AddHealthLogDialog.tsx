"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Bug,
  Leaf,
  Droplets,
  Scissors,
  Star,
  Ruler,
  Loader2,
  Camera,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { logBatchHealthEvent, type BatchHealthEventInput } from "@/app/actions/batch-health";
import { listIpmProducts, type IpmProduct } from "@/app/actions/ipm";

type EventType = "treatment" | "fertilizer" | "irrigation" | "pruning" | "grading" | "measurement";

interface AddHealthLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  batchNumber?: string;
  onSuccess?: () => void;
}

const EVENT_TYPE_META: Record<EventType, { label: string; icon: React.ElementType; color: string }> = {
  treatment: { label: "Treatment", icon: Bug, color: "text-rose-600" },
  fertilizer: { label: "Fertilizer", icon: Leaf, color: "text-green-600" },
  irrigation: { label: "Irrigation", icon: Droplets, color: "text-blue-500" },
  pruning: { label: "Pruning", icon: Scissors, color: "text-amber-600" },
  grading: { label: "Grading", icon: Star, color: "text-violet-600" },
  measurement: { label: "Measurement", icon: Ruler, color: "text-sky-600" },
};

const METHODS = ["Foliar Spray", "Drench", "Granular", "Bio-Control", "Manual"];
const RATE_UNITS = ["ml/L", "g/L", "ml/10L", "g/10L", "ml/ha", "kg/ha"];
const WEATHER_OPTIONS = ["Dry", "Humid", "Rainy", "Windy", "Overcast", "Sunny"];

export function AddHealthLogDialog({
  open,
  onOpenChange,
  batchId,
  batchNumber,
  onSuccess,
}: AddHealthLogDialogProps) {
  const { toast } = useToast();
  const [eventType, setEventType] = React.useState<EventType>("treatment");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [products, setProducts] = React.useState<IpmProduct[]>([]);
  const [productsLoading, setProductsLoading] = React.useState(false);

  // Form state
  const [selectedProductId, setSelectedProductId] = React.useState<string>("");
  const [productName, setProductName] = React.useState("");
  const [rate, setRate] = React.useState("");
  const [rateUnit, setRateUnit] = React.useState("ml/L");
  const [method, setMethod] = React.useState("Foliar Spray");
  const [weatherConditions, setWeatherConditions] = React.useState("");
  const [areaTreated, setAreaTreated] = React.useState("");
  const [sprayerUsed, setSprayerUsed] = React.useState("");
  const [reasonForUse, setReasonForUse] = React.useState("");
  const [notes, setNotes] = React.useState("");

  // Measurement fields
  const [ecReading, setEcReading] = React.useState("");
  const [phReading, setPhReading] = React.useState("");

  // Fertilizer fields
  const [fertilizerName, setFertilizerName] = React.useState("");
  const [fertilizerComposition, setFertilizerComposition] = React.useState("");

  // Calculated safe harvest date
  const [safeHarvestDate, setSafeHarvestDate] = React.useState<string | null>(null);

  // Load IPM products for treatment selection
  React.useEffect(() => {
    if (open && eventType === "treatment") {
      setProductsLoading(true);
      listIpmProducts()
        .then((result) => {
          if (result.success && result.data) {
            setProducts(result.data.filter(p => p.isActive));
          }
        })
        .finally(() => setProductsLoading(false));
    }
  }, [open, eventType]);

  // Calculate safe harvest date when product changes
  React.useEffect(() => {
    if (selectedProductId && products.length > 0) {
      const product = products.find(p => p.id === selectedProductId);
      if (product?.harvestIntervalDays) {
        const harvestDate = new Date();
        harvestDate.setDate(harvestDate.getDate() + product.harvestIntervalDays);
        setSafeHarvestDate(harvestDate.toISOString().split('T')[0]);
        // Auto-fill product details
        setProductName(product.name);
        if (product.suggestedRate) setRate(String(product.suggestedRate));
        if (product.suggestedRateUnit) setRateUnit(product.suggestedRateUnit);
        if (product.applicationMethods?.length) setMethod(product.applicationMethods[0]);
      } else {
        setSafeHarvestDate(null);
      }
    } else {
      setSafeHarvestDate(null);
    }
  }, [selectedProductId, products]);

  const resetForm = () => {
    setSelectedProductId("");
    setProductName("");
    setRate("");
    setRateUnit("ml/L");
    setMethod("Foliar Spray");
    setWeatherConditions("");
    setAreaTreated("");
    setSprayerUsed("");
    setReasonForUse("");
    setNotes("");
    setEcReading("");
    setPhReading("");
    setFertilizerName("");
    setFertilizerComposition("");
    setSafeHarvestDate(null);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const input: BatchHealthEventInput = {
        batchId,
        eventType,
        notes: notes || undefined,
      };

      // Add type-specific fields
      if (eventType === "treatment") {
        if (!productName) {
          toast({ variant: "destructive", title: "Product name required" });
          setIsSubmitting(false);
          return;
        }
        input.productName = productName;
        input.ipmProductId = selectedProductId || undefined;
        input.rate = rate ? parseFloat(rate) : undefined;
        input.rateUnit = rateUnit;
        input.method = method;
        input.weatherConditions = weatherConditions || undefined;
        input.areaTreated = areaTreated || undefined;
        input.sprayerUsed = sprayerUsed || undefined;
        input.reasonForUse = reasonForUse || undefined;
        input.safeHarvestDate = safeHarvestDate || undefined;
        const product = products.find(p => p.id === selectedProductId);
        if (product?.harvestIntervalDays) {
          input.harvestIntervalDays = product.harvestIntervalDays;
        }
      } else if (eventType === "fertilizer") {
        input.productName = fertilizerName || undefined;
        input.rate = rate ? parseFloat(rate) : undefined;
        input.rateUnit = rateUnit;
        input.method = method;
        input.fertilizerComposition = fertilizerComposition || undefined;
      } else if (eventType === "measurement") {
        if (!ecReading && !phReading) {
          toast({ variant: "destructive", title: "At least one reading required" });
          setIsSubmitting(false);
          return;
        }
        input.ecReading = ecReading ? parseFloat(ecReading) : undefined;
        input.phReading = phReading ? parseFloat(phReading) : undefined;
      } else if (eventType === "irrigation") {
        input.method = method;
      } else if (eventType === "pruning" || eventType === "grading") {
        // Just notes
      }

      const result = await logBatchHealthEvent(input);

      if (result.success) {
        toast({ title: "Health event logged", description: `${EVENT_TYPE_META[eventType].label} recorded for batch` });
        resetForm();
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast({ variant: "destructive", title: "Failed to log event", description: result.error });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: String(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Health Event</DialogTitle>
          <DialogDescription>
            Record a health event for batch {batchNumber ? `#${batchNumber}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Event Type Selector */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Event Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(EVENT_TYPE_META) as [EventType, typeof EVENT_TYPE_META[EventType]][]).map(([type, meta]) => {
                const Icon = meta.icon;
                const isSelected = eventType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setEventType(type)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-muted hover:border-primary/50"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${isSelected ? meta.color : "text-muted-foreground"}`} />
                    <span className="text-xs font-medium">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Treatment Form */}
          {eventType === "treatment" && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="product">Product</Label>
                {productsLoading ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading products...
                  </div>
                ) : (
                  <Select value={selectedProductId || undefined} onValueChange={(val) => setSelectedProductId(val === "__custom__" ? "" : val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select IPM product or enter custom" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__custom__">Custom product</SelectItem>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} {p.pcsNumber ? `(PCS: ${p.pcsNumber})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {!selectedProductId && (
                <div>
                  <Label htmlFor="productName">Product Name</Label>
                  <Input
                    id="productName"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="Enter product name"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="rate">Rate</Label>
                  <Input
                    id="rate"
                    type="number"
                    step="0.1"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    placeholder="e.g., 2.5"
                  />
                </div>
                <div>
                  <Label htmlFor="rateUnit">Unit</Label>
                  <Select value={rateUnit} onValueChange={setRateUnit}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RATE_UNITS.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="method">Method</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METHODS.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="weather">Weather</Label>
                  <Select value={weatherConditions} onValueChange={setWeatherConditions}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {WEATHER_OPTIONS.map((w) => (
                        <SelectItem key={w} value={w}>{w}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="reasonForUse">Reason for Use</Label>
                <Input
                  id="reasonForUse"
                  value={reasonForUse}
                  onChange={(e) => setReasonForUse(e.target.value)}
                  placeholder="e.g., Aphid infestation"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="areaTreated">Area Treated</Label>
                  <Input
                    id="areaTreated"
                    value={areaTreated}
                    onChange={(e) => setAreaTreated(e.target.value)}
                    placeholder="e.g., Tunnel 3"
                  />
                </div>
                <div>
                  <Label htmlFor="sprayerUsed">Sprayer Used</Label>
                  <Input
                    id="sprayerUsed"
                    value={sprayerUsed}
                    onChange={(e) => setSprayerUsed(e.target.value)}
                    placeholder="e.g., Knapsack #2"
                  />
                </div>
              </div>

              {safeHarvestDate && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-50 border border-orange-200 text-orange-800 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <span>
                    <strong>Safe Harvest Date:</strong> {new Date(safeHarvestDate).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Fertilizer Form */}
          {eventType === "fertilizer" && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="fertilizerName">Fertilizer Name</Label>
                <Input
                  id="fertilizerName"
                  value={fertilizerName}
                  onChange={(e) => setFertilizerName(e.target.value)}
                  placeholder="e.g., Osmocote Plus"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="fertRate">Rate</Label>
                  <Input
                    id="fertRate"
                    type="number"
                    step="0.1"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    placeholder="e.g., 3"
                  />
                </div>
                <div>
                  <Label htmlFor="fertUnit">Unit</Label>
                  <Select value={rateUnit} onValueChange={setRateUnit}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RATE_UNITS.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="method">Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="composition">Composition (N-P-K)</Label>
                <Input
                  id="composition"
                  value={fertilizerComposition}
                  onChange={(e) => setFertilizerComposition(e.target.value)}
                  placeholder="e.g., 14-14-14"
                />
              </div>
            </div>
          )}

          {/* Measurement Form */}
          {eventType === "measurement" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ec">EC Reading</Label>
                  <Input
                    id="ec"
                    type="number"
                    step="0.1"
                    value={ecReading}
                    onChange={(e) => setEcReading(e.target.value)}
                    placeholder="e.g., 1.8"
                  />
                </div>
                <div>
                  <Label htmlFor="ph">pH Reading</Label>
                  <Input
                    id="ph"
                    type="number"
                    step="0.1"
                    value={phReading}
                    onChange={(e) => setPhReading(e.target.value)}
                    placeholder="e.g., 6.2"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Irrigation Form */}
          {eventType === "irrigation" && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="irrMethod">Irrigation Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Drip">Drip</SelectItem>
                    <SelectItem value="Overhead">Overhead</SelectItem>
                    <SelectItem value="Hand Water">Hand Water</SelectItem>
                    <SelectItem value="Flood">Flood</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Pruning/Grading - just notes */}
          {(eventType === "pruning" || eventType === "grading") && (
            <div className="text-sm text-muted-foreground">
              Add any notes about the {eventType} activity below.
            </div>
          )}

          {/* Notes - common to all */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Log Event"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddHealthLogDialog;
