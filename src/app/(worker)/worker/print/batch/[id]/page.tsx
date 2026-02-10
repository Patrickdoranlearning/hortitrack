"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  Minus,
  Plus,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { vibrateTap, vibrateSuccess } from "@/lib/haptics";
import { toast } from "@/lib/toast";
import {
  LabelPrintView,
  type BatchLabelData,
  type LabelSize,
} from "@/components/worker/print/LabelPrintView";

interface BatchPrintData {
  id: string;
  batchNumber: string;
  varietyName: string | null;
  familyName: string | null;
  sizeName: string | null;
  locationName: string | null;
  quantity: number;
  plantedAt: string | null;
}

export default function BatchLabelPrintPage() {
  const params = useParams();
  const router = useRouter();
  const batchId = params.id as string;

  const [batch, setBatch] = useState<BatchPrintData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copies, setCopies] = useState(1);
  const [labelSize, setLabelSize] = useState<LabelSize>("medium");

  // Fetch batch data
  const fetchBatch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/worker/print/batch/${batchId}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to load batch");
      }

      const data = await response.json();
      setBatch(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load batch");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    fetchBatch();
  }, [fetchBatch]);

  const handleBack = () => {
    vibrateTap();
    router.back();
  };

  const handleRefresh = () => {
    vibrateTap();
    fetchBatch();
  };

  const handlePrint = () => {
    vibrateTap();

    // Add to recent prints
    const recentPrints = JSON.parse(
      localStorage.getItem("worker-recent-prints") || "[]"
    );
    const newRecent = {
      type: "batch" as const,
      id: batchId,
      label: `#${batch?.batchNumber}`,
      subLabel: batch?.varietyName || undefined,
      printedAt: new Date().toISOString(),
    };
    const updatedRecents = [
      newRecent,
      ...recentPrints.filter(
        (r: { type: string; id: string }) => !(r.type === "batch" && r.id === batchId)
      ),
    ].slice(0, 10);
    localStorage.setItem("worker-recent-prints", JSON.stringify(updatedRecents));

    // Trigger print
    window.print();
    vibrateSuccess();

    toast.success(`Printing ${copies} label${copies > 1 ? "s" : ""} for batch #${batch?.batchNumber}`);
  };

  const incrementCopies = () => {
    vibrateTap();
    setCopies((c) => Math.min(c + 1, 20));
  };

  const decrementCopies = () => {
    vibrateTap();
    setCopies((c) => Math.max(c - 1, 1));
  };

  // Loading state
  if (loading && !batch) {
    return (
      <div className="flex flex-col h-full">
        <Header onBack={handleBack} onRefresh={handleRefresh} loading={true} />
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Error state
  if (error && !batch) {
    return (
      <div className="flex flex-col h-full">
        <Header onBack={handleBack} onRefresh={handleRefresh} loading={false} />
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={handleRefresh} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!batch) {
    return null;
  }

  // Prepare label data
  const labelData: BatchLabelData = {
    type: "batch",
    qrValue: `ht:batch:${batch.batchNumber}`,
    batchNumber: batch.batchNumber,
    varietyName: batch.varietyName || "Unknown Variety",
    familyName: batch.familyName || undefined,
    sizeName: batch.sizeName || undefined,
    plantedDate: batch.plantedAt || undefined,
    quantity: batch.quantity,
    locationName: batch.locationName || undefined,
  };

  return (
    <>
      {/* Print-only content */}
      <LabelPrintView labels={[labelData]} size={labelSize} copies={copies} />

      {/* Screen content */}
      <div className="flex flex-col h-full no-print">
        <Header
          onBack={handleBack}
          onRefresh={handleRefresh}
          loading={loading}
          title="Print Batch Label"
        />

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Batch Info Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Batch Information</span>
                <Badge variant="secondary" className="font-mono">
                  #{batch.batchNumber}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              <InfoRow label="Variety" value={batch.varietyName || "-"} />
              {batch.familyName && <InfoRow label="Family" value={batch.familyName} />}
              {batch.sizeName && <InfoRow label="Size" value={batch.sizeName} />}
              <InfoRow label="Quantity" value={batch.quantity.toLocaleString()} />
              {batch.locationName && (
                <InfoRow label="Location" value={batch.locationName} />
              )}
              {batch.plantedAt && (
                <InfoRow label="Planted" value={formatDate(batch.plantedAt)} />
              )}
            </CardContent>
          </Card>

          {/* Label Preview */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Label Preview</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 flex justify-center">
              <div className="transform scale-90 origin-top">
                <LabelPrintView
                  labels={[labelData]}
                  size={labelSize}
                  copies={1}
                  showPreview
                />
              </div>
            </CardContent>
          </Card>

          {/* Print Options */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Print Options</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
              {/* Label Size */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Label Size</label>
                <Select
                  value={labelSize}
                  onValueChange={(v) => {
                    vibrateTap();
                    setLabelSize(v as LabelSize);
                  }}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small (50x30mm)</SelectItem>
                    <SelectItem value="medium">Medium (70x50mm)</SelectItem>
                    <SelectItem value="large">Large (100x70mm)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Copies */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Number of Copies</label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={decrementCopies}
                    disabled={copies <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center font-semibold">{copies}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={incrementCopies}
                    disabled={copies >= 20}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Print Button */}
          <Button
            size="lg"
            className="w-full h-14 text-lg gap-2"
            onClick={handlePrint}
          >
            <Printer className="h-5 w-5" />
            Print {copies} Label{copies > 1 ? "s" : ""}
          </Button>

          {/* Tips */}
          <div className="text-xs text-muted-foreground text-center px-4">
            Labels will open in your browser&apos;s print dialog. Make sure your
            printer is set up correctly.
          </div>
        </div>
      </div>
    </>
  );
}

// Header component
function Header({
  onBack,
  onRefresh,
  loading,
  title,
}: {
  onBack: () => void;
  onRefresh: () => void;
  loading: boolean;
  title?: string;
}) {
  return (
    <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 no-print">
      <div className="flex h-14 items-center justify-between px-4">
        <Button
          variant="ghost"
          size="sm"
          className="min-h-[44px] -ml-2"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <h1 className="font-semibold truncate max-w-[50%]">
          {title || "Print Label"}
        </h1>

        <Button
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px] -mr-2"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

// Info row component
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// Date formatter
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}
