"use client";

import { useState, useRef, useCallback } from "react";
import {
  Bug,
  Gauge,
  Camera,
  CheckCircle2,
  Package,
  X,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { vibrateTap } from "@/lib/haptics";
import { ScoutIssueSelector, type IssueType } from "./ScoutIssueSelector";
import { SeveritySlider, type Severity } from "./SeveritySlider";
import type { Batch } from "./ScoutWizardFlow";

export type ScoutLogData = {
  logType: "issue" | "reading";
  issue?: {
    reason: string;
    severity: Severity;
    notes?: string;
  };
  reading?: {
    ec?: number;
    ph?: number;
    notes?: string;
  };
  photoFile?: File;
  photoPreview?: string;
  selectedBatchIds: string[];
  locationId: string;
};

interface ScoutLogFormProps {
  locationId: string;
  locationName: string;
  batches: Batch[];
  onSubmit: (data: ScoutLogData) => void;
  isSubmitting?: boolean;
}

/**
 * Mobile-optimized form for logging scout issues or readings.
 * Part of the Scout Wizard flow.
 */
export function ScoutLogForm({
  locationId,
  locationName,
  batches,
  onSubmit,
  isSubmitting = false,
}: ScoutLogFormProps) {
  // Form state
  const [tab, setTab] = useState<"issue" | "reading">("issue");
  const [issueType, setIssueType] = useState<IssueType | null>(null);
  const [severity, setSeverity] = useState<Severity>("medium");
  const [issueNotes, setIssueNotes] = useState("");
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>(
    batches.map((b) => b.id)
  );

  // Reading state
  const [ecValue, setEcValue] = useState("");
  const [phValue, setPhValue] = useState("");
  const [readingNotes, setReadingNotes] = useState("");

  // Photo state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  // Batch selection
  const toggleBatch = (batchId: string) => {
    vibrateTap();
    if (selectedBatchIds.includes(batchId)) {
      setSelectedBatchIds(selectedBatchIds.filter((id) => id !== batchId));
    } else {
      setSelectedBatchIds([...selectedBatchIds, batchId]);
    }
  };

  const selectAllBatches = () => {
    vibrateTap();
    setSelectedBatchIds(batches.map((b) => b.id));
  };

  const deselectAllBatches = () => {
    vibrateTap();
    setSelectedBatchIds([]);
  };

  // Photo handling
  const handlePhotoSelect = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    vibrateTap();
    const file = files[0];
    setPhotoFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const clearPhoto = () => {
    vibrateTap();
    setPhotoFile(null);
    setPhotoPreview(null);
    if (camRef.current) camRef.current.value = "";
    if (galRef.current) galRef.current.value = "";
  };

  // Reading indicators
  const ec = ecValue !== "" ? parseFloat(ecValue) : null;
  const ph = phValue !== "" ? parseFloat(phValue) : null;

  const ecStatus = ec !== null
    ? ec < 0.5 ? "low" : ec > 3.0 ? "high" : "normal"
    : null;
  const phStatus = ph !== null
    ? ph < 5.5 ? "low" : ph > 6.5 ? "high" : "normal"
    : null;

  // Submit handler
  const handleSubmit = () => {
    vibrateTap();

    if (tab === "issue") {
      if (!issueType) {
        return; // Button should be disabled
      }

      onSubmit({
        logType: "issue",
        issue: {
          reason: issueType,
          severity,
          notes: issueNotes.trim() || undefined,
        },
        selectedBatchIds,
        locationId,
        photoFile: photoFile || undefined,
        photoPreview: photoPreview || undefined,
      });
    } else {
      if (ec === null && ph === null) {
        return; // Button should be disabled
      }

      onSubmit({
        logType: "reading",
        reading: {
          ec: ec !== null ? ec : undefined,
          ph: ph !== null ? ph : undefined,
          notes: readingNotes.trim() || undefined,
        },
        selectedBatchIds: batches.map((b) => b.id), // All batches for readings
        locationId,
        photoFile: photoFile || undefined,
        photoPreview: photoPreview || undefined,
      });
    }
  };

  const canSubmit = tab === "issue"
    ? issueType !== null
    : ec !== null || ph !== null;

  return (
    <div className="px-4 pb-4 space-y-4">
      {/* Hidden file inputs */}
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handlePhotoSelect(e.target.files)}
      />
      <input
        ref={galRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handlePhotoSelect(e.target.files)}
      />

      {/* Log Type Tabs */}
      <Tabs value={tab} onValueChange={(v) => { vibrateTap(); setTab(v as "issue" | "reading"); }}>
        <TabsList className="grid w-full grid-cols-2 h-12">
          <TabsTrigger value="issue" className="gap-2 min-h-[44px]">
            <Bug className="h-4 w-4" />
            Log Issue
          </TabsTrigger>
          <TabsTrigger value="reading" className="gap-2 min-h-[44px]">
            <Gauge className="h-4 w-4" />
            Log Reading
          </TabsTrigger>
        </TabsList>

        {/* Issue Tab */}
        <TabsContent value="issue" className="mt-4 space-y-4">
          {/* Issue Type Selector */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Issue Type *</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <ScoutIssueSelector
                value={issueType}
                onChange={setIssueType}
                disabled={isSubmitting}
              />
            </CardContent>
          </Card>

          {/* Severity Slider */}
          {issueType && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Severity</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <SeveritySlider
                  value={severity}
                  onChange={setSeverity}
                  disabled={isSubmitting}
                />
              </CardContent>
            </Card>
          )}

          {/* Batch Selection */}
          {batches.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Affected Batches ({selectedBatchIds.length}/{batches.length})
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={selectAllBatches}
                      disabled={isSubmitting}
                    >
                      All
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={deselectAllBatches}
                      disabled={isSubmitting}
                    >
                      None
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="border rounded-lg p-3 max-h-[160px] overflow-y-auto space-y-2">
                  {batches.map((batch) => (
                    <div key={batch.id} className="flex items-center gap-3 min-h-[44px]">
                      <Checkbox
                        id={`batch-${batch.id}`}
                        checked={selectedBatchIds.includes(batch.id)}
                        onCheckedChange={() => toggleBatch(batch.id)}
                        disabled={isSubmitting}
                        className="h-5 w-5"
                      />
                      <label
                        htmlFor={`batch-${batch.id}`}
                        className="text-sm cursor-pointer flex-1 flex items-center gap-2"
                      >
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono">{batch.batchNumber}</span>
                        {batch.variety && (
                          <span className="text-muted-foreground text-xs truncate">
                            {batch.variety}
                          </span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Notes (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <Textarea
                placeholder="Additional observations..."
                className="resize-none min-h-[80px]"
                value={issueNotes}
                onChange={(e) => setIssueNotes(e.target.value)}
                disabled={isSubmitting}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reading Tab */}
        <TabsContent value="reading" className="mt-4 space-y-4">
          {/* EC and pH inputs */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Measurements</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="grid grid-cols-2 gap-4">
                {/* EC */}
                <div className="space-y-2">
                  <Label htmlFor="ec">EC Reading (mS/cm)</Label>
                  <Input
                    id="ec"
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    placeholder="e.g. 1.2"
                    value={ecValue}
                    onChange={(e) => setEcValue(e.target.value)}
                    disabled={isSubmitting}
                    className="h-12 text-lg"
                  />
                  {ecStatus && (
                    <Badge
                      variant={ecStatus === "normal" ? "outline" : "destructive"}
                      className="text-xs"
                    >
                      {ecStatus === "low" && "Low - needs feeding"}
                      {ecStatus === "high" && "High"}
                      {ecStatus === "normal" && "Normal"}
                    </Badge>
                  )}
                </div>

                {/* pH */}
                <div className="space-y-2">
                  <Label htmlFor="ph">pH Reading</Label>
                  <Input
                    id="ph"
                    type="number"
                    step="0.1"
                    min="0"
                    max="14"
                    placeholder="e.g. 6.5"
                    value={phValue}
                    onChange={(e) => setPhValue(e.target.value)}
                    disabled={isSubmitting}
                    className="h-12 text-lg"
                  />
                  {phStatus && (
                    <Badge
                      variant={phStatus === "normal" ? "outline" : "destructive"}
                      className="text-xs"
                    >
                      {phStatus === "low" && "Acidic"}
                      {phStatus === "high" && "Alkaline"}
                      {phStatus === "normal" && "Optimal"}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Reference ranges */}
              <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                <div className="font-medium mb-1">Reference Ranges</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>EC: 0.5-3.0 mS/cm (typical)</div>
                  <div>pH: 5.5-6.5 (most plants)</div>
                </div>
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
                placeholder="Sample location, observations..."
                className="resize-none min-h-[80px]"
                value={readingNotes}
                onChange={(e) => setReadingNotes(e.target.value)}
                disabled={isSubmitting}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Photo Capture */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Photo (Optional)
            </CardTitle>
            {photoPreview && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={clearPhoto}
                disabled={isSubmitting}
              >
                <X className="h-4 w-4 mr-1" />
                Remove
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          {photoPreview ? (
            <div className="relative aspect-video rounded-lg overflow-hidden bg-muted border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoPreview}
                alt="Captured photo"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-16 flex-col gap-1"
                onClick={() => { vibrateTap(); camRef.current?.click(); }}
                disabled={isSubmitting}
              >
                <Camera className="h-5 w-5" />
                <span className="text-sm">Camera</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-16 flex-col gap-1"
                onClick={() => { vibrateTap(); galRef.current?.click(); }}
                disabled={isSubmitting}
              >
                <ImageIcon className="h-5 w-5" />
                <span className="text-sm">Gallery</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit Button */}
      <Button
        className="w-full h-14 text-lg"
        onClick={handleSubmit}
        disabled={isSubmitting || !canSubmit}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <CheckCircle2 className="h-5 w-5 mr-2" />
            Continue
          </>
        )}
      </Button>
    </div>
  );
}

export default ScoutLogForm;
