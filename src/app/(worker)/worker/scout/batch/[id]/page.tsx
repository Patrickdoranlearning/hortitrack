"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  Package,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { vibrateTap, vibrateSuccess, vibrateError } from "@/lib/haptics";
import { toast } from "@/lib/toast";
import { ScoutIssueSelector, type IssueType } from "@/components/worker/scout/ScoutIssueSelector";
import { SeveritySlider, type Severity } from "@/components/worker/scout/SeveritySlider";
import { PhotoCapture } from "@/components/worker/scout/PhotoCapture";
import type { WorkerBatchDetail } from "@/types/worker";

async function fetchBatch(url: string): Promise<WorkerBatchDetail> {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) throw new Error("Batch not found");
    throw new Error("Failed to fetch batch");
  }
  return res.json();
}

export default function WorkerScoutBatchPage() {
  const params = useParams();
  const router = useRouter();
  const batchId = params.id as string;

  // Form state
  const [isAllClear, setIsAllClear] = useState(false);
  const [issueType, setIssueType] = useState<IssueType | null>(null);
  const [severity, setSeverity] = useState<Severity>("medium");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    data: batch,
    error,
    isLoading,
  } = useSWR(`/api/worker/batches/${batchId}`, fetchBatch);

  const handleBack = () => {
    vibrateTap();
    router.back();
  };

  const handleAllClearToggle = (checked: boolean) => {
    vibrateTap();
    setIsAllClear(checked);
    if (checked) {
      setIssueType(null);
    }
  };

  const handleSubmit = async () => {
    vibrateTap();

    // Validate
    if (!isAllClear && !issueType) {
      vibrateError();
      toast.error("Choose an issue type or mark as all clear");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/worker/scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId,
          issueType: isAllClear ? null : issueType,
          severity: isAllClear ? null : severity,
          notes: notes.trim() || null,
          photoUrl: photos[0] || null, // TODO: Handle multiple photos
          isAllClear,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save scout log");
      }

      vibrateSuccess();
      toast.success(isAllClear
        ? "Batch marked as all clear"
        : `${issueType} issue recorded`);

      // Navigate back
      router.back();
    } catch (err) {
      vibrateError();
      toast.error(err instanceof Error ? err.message : "Please try again");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header onBack={handleBack} />
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !batch) {
    return (
      <div className="flex flex-col h-full">
        <Header onBack={handleBack} />
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-muted-foreground mb-4">
            {error?.message || "Batch not found"}
          </p>
          <Button onClick={handleBack} variant="outline">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header onBack={handleBack} title={`Scout ${batch.batchNumber}`} />

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Batch Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Package className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-mono font-semibold">{batch.batchNumber}</h2>
                <p className="text-sm text-muted-foreground truncate">
                  {batch.varietyName || "Unknown variety"}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {batch.quantity.toLocaleString()} plants
                  </Badge>
                  {batch.locationName && (
                    <span className="text-xs text-muted-foreground">
                      @ {batch.locationName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* All Clear Toggle */}
        <Card className={cn(isAllClear && "border-green-500 bg-green-50 dark:bg-green-900/20")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2
                  className={cn(
                    "h-6 w-6",
                    isAllClear ? "text-green-600" : "text-muted-foreground"
                  )}
                />
                <div>
                  <Label htmlFor="all-clear" className="text-base font-medium">
                    All Clear
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    No issues observed
                  </p>
                </div>
              </div>
              <Switch
                id="all-clear"
                checked={isAllClear}
                onCheckedChange={handleAllClearToggle}
                disabled={isSubmitting}
              />
            </div>
          </CardContent>
        </Card>

        {/* Issue Form - shown when not all clear */}
        {!isAllClear && (
          <>
            {/* Issue Type Selector */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Issue Type</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <ScoutIssueSelector
                  value={issueType}
                  onChange={setIssueType}
                  disabled={isSubmitting}
                />
              </CardContent>
            </Card>

            {/* Severity Slider */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Severity</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <SeveritySlider
                  value={severity}
                  onChange={setSeverity}
                  disabled={isSubmitting}
                />
              </CardContent>
            </Card>
          </>
        )}

        {/* Notes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Notes (Optional)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <Textarea
              placeholder="Additional observations..."
              className="resize-none min-h-[80px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
            />
          </CardContent>
        </Card>

        {/* Photo Capture */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Photo Evidence
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <PhotoCapture
              photos={photos}
              onPhotosChange={setPhotos}
              disabled={isSubmitting}
            />
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Button
          className="w-full h-14 text-lg"
          onClick={handleSubmit}
          disabled={isSubmitting || (!isAllClear && !issueType)}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Saving...
            </>
          ) : isAllClear ? (
            <>
              <CheckCircle2 className="h-5 w-5 mr-2" />
              Mark All Clear
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 mr-2" />
              Log Issue
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// Header component
function Header({
  onBack,
  title,
}: {
  onBack: () => void;
  title?: string;
}) {
  return (
    <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4">
        <Button
          variant="ghost"
          size="sm"
          className="min-h-[44px] -ml-2"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <h1 className="flex-1 text-center font-medium truncate px-4">
          {title || "Scout Batch"}
        </h1>

        <div className="w-16" /> {/* Spacer for centering */}
      </div>
    </div>
  );
}
