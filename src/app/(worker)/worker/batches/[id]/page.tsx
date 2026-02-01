"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Trash2,
  Droplets,
  Wheat,
  Eye,
  Printer,
  RefreshCw,
  AlertCircle,
  Sprout,
  History,
} from "lucide-react";
import { SprayIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { vibrateTap, vibrateSuccess } from "@/lib/haptics";
import { useToast } from "@/hooks/use-toast";
import type { WorkerBatchDetail } from "@/types/worker";
import { MoveLocationDialog } from "@/components/worker/batch-actions/MoveLocationDialog";
import { RecordLossDialog } from "@/components/worker/batch-actions/RecordLossDialog";
import { LogActionDialog } from "@/components/worker/batch-actions/LogActionDialog";
import { BatchDetailTabs } from "@/components/worker/batch/BatchDetailTabs";

type LogActionType = "spray" | "water" | "feed" | "observation";

export default function WorkerBatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const batchId = params.id as string;

  const [batch, setBatch] = useState<WorkerBatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [moveOpen, setMoveOpen] = useState(false);
  const [lossOpen, setLossOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [logActionType, setLogActionType] = useState<LogActionType>("observation");

  // Fetch batch details
  const fetchBatch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/worker/batches/${batchId}`);

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

  const handleActionSuccess = (message: string) => {
    vibrateSuccess();
    toast({
      title: "Success",
      description: message,
    });
    fetchBatch(); // Refresh batch data
  };

  const openLogAction = (type: LogActionType) => {
    vibrateTap();
    setLogActionType(type);
    setLogOpen(true);
  };

  const handlePrintLabel = () => {
    vibrateTap();
    // Navigate to print page or open print dialog
    window.open(`/production/batches/${batchId}/label`, "_blank");
  };

  const getStatusVariant = (
    status: string | null
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "Ready for Sale":
      case "Looking Good":
        return "default";
      case "Growing":
      case "Propagation":
        return "secondary";
      case "Incoming":
        return "outline";
      case "Archived":
        return "destructive";
      default:
        return "secondary";
    }
  };

  // Loading state
  if (loading && !batch) {
    return (
      <div className="flex flex-col h-full">
        <Header onBack={handleBack} onRefresh={handleRefresh} loading={true} />
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
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

  return (
    <div className="flex flex-col h-full">
      <Header
        onBack={handleBack}
        onRefresh={handleRefresh}
        loading={loading}
        title={batch.batchNumber}
      />

      <BatchDetailTabs batchId={batchId}>
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Batch Header Card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold truncate">
                    {batch.varietyName || "Unknown Variety"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {[batch.familyName, batch.sizeName]
                      .filter(Boolean)
                      .join(" - ") || "No details"}
                  </p>
                </div>
                {batch.status && (
                  <Badge
                    variant={getStatusVariant(batch.status)}
                    className="text-sm flex-shrink-0"
                  >
                    {batch.status}
                  </Badge>
                )}
              </div>
              {batch.phase && (
                <Badge variant="outline" className="capitalize">
                  {batch.phase}
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Key Info Cards */}
          <div className="grid grid-cols-2 gap-3">
            <InfoCard
              label="Quantity"
              value={batch.quantity.toLocaleString()}
              subValue={`of ${batch.initialQuantity.toLocaleString()}`}
            />
            <InfoCard
              label="Location"
              value={batch.locationName || "Unassigned"}
              icon={<MapPin className="h-4 w-4" />}
            />
          </div>

          {/* Quick Action Buttons */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid grid-cols-2 gap-3">
                <ActionButton
                  icon={<MapPin className="h-5 w-5" />}
                  label="Move Batch"
                  onClick={() => {
                    vibrateTap();
                    setMoveOpen(true);
                  }}
                  variant="secondary"
                />
                <ActionButton
                  icon={<Trash2 className="h-5 w-5" />}
                  label="Record Loss"
                  onClick={() => {
                    vibrateTap();
                    setLossOpen(true);
                  }}
                  variant="destructive"
                />
                <ActionButton
                  icon={<SprayIcon className="h-5 w-5" />}
                  label="Log Spray"
                  onClick={() => openLogAction("spray")}
                />
                <ActionButton
                  icon={<Droplets className="h-5 w-5" />}
                  label="Log Water"
                  onClick={() => openLogAction("water")}
                />
                <ActionButton
                  icon={<Wheat className="h-5 w-5" />}
                  label="Log Feed"
                  onClick={() => openLogAction("feed")}
                />
                <ActionButton
                  icon={<Eye className="h-5 w-5" />}
                  label="Observation"
                  onClick={() => openLogAction("observation")}
                />
              </div>
              <div className="mt-3 pt-3 border-t">
                <ActionButton
                  icon={<Printer className="h-5 w-5" />}
                  label="Print Label"
                  onClick={handlePrintLabel}
                  variant="outline"
                  fullWidth
                />
              </div>
            </CardContent>
          </Card>

          {/* Additional Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sprout className="h-4 w-4" />
                Batch Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              {batch.plantedAt && (
                <DetailRow label="Planted" value={formatDate(batch.plantedAt)} />
              )}
              {batch.readyAt && (
                <DetailRow label="Ready Date" value={formatDate(batch.readyAt)} />
              )}
              {batch.supplierName && (
                <DetailRow label="Supplier" value={batch.supplierName} />
              )}
              {batch.notes && (
                <DetailRow label="Notes" value={batch.notes} />
              )}
              {batch.createdAt && (
                <DetailRow
                  label="Created"
                  value={formatDate(batch.createdAt)}
                />
              )}
            </CardContent>
          </Card>

          {/* View History Link */}
          <Button
            variant="ghost"
            className="w-full h-12"
            onClick={() => {
              vibrateTap();
              router.push(`/production/batches?batch=${batchId}`);
            }}
          >
            <History className="h-4 w-4 mr-2" />
            View Full History
          </Button>
        </div>
      </BatchDetailTabs>

      {/* Dialogs */}
      <MoveLocationDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        batchId={batchId}
        currentLocation={batch.locationName}
        onSuccess={(msg) => {
          setMoveOpen(false);
          handleActionSuccess(msg);
        }}
      />

      <RecordLossDialog
        open={lossOpen}
        onOpenChange={setLossOpen}
        batchId={batchId}
        maxQuantity={batch.quantity}
        onSuccess={(msg) => {
          setLossOpen(false);
          handleActionSuccess(msg);
        }}
      />

      <LogActionDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        batchId={batchId}
        actionType={logActionType}
        onSuccess={(msg) => {
          setLogOpen(false);
          handleActionSuccess(msg);
        }}
      />
    </div>
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
    <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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

        <h1 className="font-mono text-sm font-medium truncate max-w-[40%]">
          {title || "Batch Details"}
        </h1>

        <Button
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px] -mr-2"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>
    </div>
  );
}

// Info card component
function InfoCard({
  label,
  value,
  subValue,
  icon,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        {icon}
        {label}
      </div>
      <div className="font-semibold truncate">{value}</div>
      {subValue && (
        <div className="text-xs text-muted-foreground">{subValue}</div>
      )}
    </Card>
  );
}

// Action button component
function ActionButton({
  icon,
  label,
  onClick,
  variant = "outline",
  fullWidth = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "secondary" | "destructive" | "outline";
  fullWidth?: boolean;
}) {
  return (
    <Button
      variant={variant}
      className={cn(
        "h-14 flex flex-col items-center justify-center gap-1",
        fullWidth && "col-span-2 flex-row gap-2"
      )}
      onClick={onClick}
    >
      {icon}
      <span className="text-xs">{label}</span>
    </Button>
  );
}

// Detail row component
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

// Date formatter
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}
