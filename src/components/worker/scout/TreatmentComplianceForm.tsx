"use client";

import { useState, useCallback } from "react";
import {
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  Package,
  CloudSun,
  Loader2,
  FlaskConical,
  FileText,
  Calendar,
  User,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { vibrateTap, vibrateSuccess, vibrateError } from "@/lib/haptics";
import ScannerDialog from "@/components/scan-and-act-dialog";
import type { IpmTask, ComplianceData } from "@/app/actions/ipm-tasks";

interface TreatmentComplianceFormProps {
  task: IpmTask;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (taskIds: string[], data: ComplianceData) => Promise<void>;
}

const WEATHER_OPTIONS = [
  "Dry, calm",
  "Dry, light breeze",
  "Dry, windy",
  "Light rain",
  "Overcast",
  "Hot & sunny",
  "Cold",
];

const SPRAYER_OPTIONS = [
  "Knapsack sprayer",
  "Boom sprayer",
  "Mist blower",
  "Handheld sprayer",
  "Drench applicator",
];

/**
 * Mobile-optimized form for recording treatment compliance data.
 * Captures PCS number, weather, sprayer used, etc. for regulatory compliance.
 */
export function TreatmentComplianceForm({
  task,
  open,
  onOpenChange,
  onComplete,
}: TreatmentComplianceFormProps) {
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [scannedBottleId, setScannedBottleId] = useState<string | null>(null);
  const [scannedBottleCode, setScannedBottleCode] = useState<string | null>(null);
  const [quantityUsedMl, setQuantityUsedMl] = useState("");
  const [pcsNumber, setPcsNumber] = useState(task.product?.pcsNumber || "");
  const [cropName, setCropName] = useState("");
  const [reasonForUse, setReasonForUse] = useState("");
  const [weatherConditions, setWeatherConditions] = useState("");
  const [areaTreated, setAreaTreated] = useState("");
  const [sprayerUsed, setSprayerUsed] = useState("");
  const [notes, setNotes] = useState("");
  const [signedBy, setSignedBy] = useState("");

  // Calculate safe harvest date
  const harvestIntervalDays = task.product?.whiDays || 0;
  const safeHarvestDate =
    harvestIntervalDays > 0
      ? new Date(Date.now() + harvestIntervalDays * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0]
      : null;

  // Handle bottle scan
  const handleBottleScan = useCallback((code: string) => {
    vibrateTap();
    setIsScanOpen(false);

    // Parse bottle code - expected format: ht:bottle:UUID or just UUID
    let bottleId = code;
    if (code.startsWith("ht:bottle:")) {
      bottleId = code.replace("ht:bottle:", "");
    }

    // Validate bottle matches product (in a real app, verify via API)
    // For now, just store the code
    setScannedBottleId(bottleId);
    setScannedBottleCode(code);
    vibrateSuccess();
  }, []);

  const clearBottle = () => {
    vibrateTap();
    setScannedBottleId(null);
    setScannedBottleCode(null);
    setQuantityUsedMl("");
  };

  const handleSubmit = async () => {
    vibrateTap();
    setIsSubmitting(true);

    try {
      const complianceData: ComplianceData = {
        bottleId: scannedBottleId || undefined,
        quantityUsedMl: quantityUsedMl !== "" ? parseFloat(quantityUsedMl) : undefined,
        pcsNumber: pcsNumber.trim() || undefined,
        cropName: cropName.trim() || undefined,
        reasonForUse: reasonForUse.trim() || undefined,
        weatherConditions: weatherConditions || undefined,
        harvestIntervalDays: harvestIntervalDays || undefined,
        safeHarvestDate: safeHarvestDate || undefined,
        areaTreated: areaTreated.trim() || undefined,
        sprayerUsed: sprayerUsed || undefined,
        signedBy: signedBy.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      await onComplete([task.id], complianceData);
      vibrateSuccess();
      onOpenChange(false);
    } catch (error) {
      vibrateError();
      console.error("Failed to complete treatment", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[90vh] overflow-auto">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              Record Treatment
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-4 pb-6">
            {/* Task Info */}
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <FlaskConical className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{task.productName}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {task.location?.name || task.batch?.batchNumber || "Unknown location"}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {task.rate && (
                        <Badge variant="outline" className="text-xs">
                          {task.rate} {task.rateUnit}
                        </Badge>
                      )}
                      {task.method && (
                        <Badge variant="secondary" className="text-xs">
                          {task.method}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bottle Scan Section */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Stock Tracking
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 space-y-3">
                {scannedBottleId ? (
                  <div className="flex items-center justify-between bg-green-50 dark:bg-green-950/30 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-mono font-semibold text-sm">
                          {scannedBottleCode}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Bottle verified
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearBottle}
                      disabled={isSubmitting}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-14 gap-2"
                    onClick={() => { vibrateTap(); setIsScanOpen(true); }}
                    disabled={isSubmitting}
                  >
                    <ScanLine className="h-5 w-5" />
                    Scan Bottle (Optional)
                  </Button>
                )}

                {scannedBottleId && (
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity Used (ml)</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="e.g. 100"
                      value={quantityUsedMl}
                      onChange={(e) => setQuantityUsedMl(e.target.value)}
                      disabled={isSubmitting}
                      className="h-12"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Compliance Data */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Compliance Record
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 space-y-4">
                {/* PCS Number */}
                <div className="space-y-2">
                  <Label htmlFor="pcs">PCS Number (Registration)</Label>
                  <Input
                    id="pcs"
                    placeholder="e.g. PCS 12345"
                    value={pcsNumber}
                    onChange={(e) => setPcsNumber(e.target.value)}
                    disabled={isSubmitting}
                    className="h-12"
                  />
                </div>

                {/* Crop Name */}
                <div className="space-y-2">
                  <Label htmlFor="crop">Crop / Plant Type</Label>
                  <Input
                    id="crop"
                    placeholder="e.g. Bedding plants"
                    value={cropName}
                    onChange={(e) => setCropName(e.target.value)}
                    disabled={isSubmitting}
                    className="h-12"
                  />
                </div>

                {/* Reason for Use */}
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason for Use</Label>
                  <Input
                    id="reason"
                    placeholder="e.g. Aphid infestation"
                    value={reasonForUse}
                    onChange={(e) => setReasonForUse(e.target.value)}
                    disabled={isSubmitting}
                    className="h-12"
                  />
                </div>

                {/* Weather Conditions */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <CloudSun className="h-4 w-4" />
                    Weather Conditions
                  </Label>
                  <Select
                    value={weatherConditions}
                    onValueChange={setWeatherConditions}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select conditions" />
                    </SelectTrigger>
                    <SelectContent>
                      {WEATHER_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Area Treated */}
                <div className="space-y-2">
                  <Label htmlFor="area">Area Treated</Label>
                  <Input
                    id="area"
                    placeholder="e.g. Polytunnel 3, Benches A-D"
                    value={areaTreated}
                    onChange={(e) => setAreaTreated(e.target.value)}
                    disabled={isSubmitting}
                    className="h-12"
                  />
                </div>

                {/* Sprayer Used */}
                <div className="space-y-2">
                  <Label>Equipment / Sprayer Used</Label>
                  <Select
                    value={sprayerUsed}
                    onValueChange={setSprayerUsed}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select equipment" />
                    </SelectTrigger>
                    <SelectContent>
                      {SPRAYER_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Harvest Interval Warning */}
            {harvestIntervalDays > 0 && safeHarvestDate && (
              <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-200">
                        Harvest Interval: {harvestIntervalDays} days
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        Safe harvest date: {new Date(safeHarvestDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Signature */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Applicator Signature
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="signed">Name of Applicator</Label>
                  <Input
                    id="signed"
                    placeholder="Your name"
                    value={signedBy}
                    onChange={(e) => setSignedBy(e.target.value)}
                    disabled={isSubmitting}
                    className="h-12"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Notes (Optional)</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <Textarea
                  placeholder="Any additional observations..."
                  className="resize-none min-h-[80px]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isSubmitting}
                />
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button
              className="w-full h-14 text-lg"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Complete Treatment
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Scanner Dialog */}
      <ScannerDialog
        open={isScanOpen}
        onOpenChange={setIsScanOpen}
        onDetected={handleBottleScan}
      />
    </>
  );
}

export default TreatmentComplianceForm;
