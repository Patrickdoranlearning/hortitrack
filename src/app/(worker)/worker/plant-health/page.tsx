"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  ScanLine,
  Eye,
  MapPin,
  Package,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  ChevronRight,
  Bug,
  Calendar,
  FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { vibrateTap, vibrateSuccess } from "@/lib/haptics";
import { PullToRefresh } from "@/components/worker/PullToRefresh";
import ScannerDialog from "@/components/scan-and-act-dialog";
import { TaskCard } from "@/components/worker/TaskCard";
import { TreatmentScheduleCard } from "@/components/worker/scout/TreatmentScheduleCard";
import { useWorkerTasks } from "@/offline/WorkerOfflineProvider";
import type { GetScoutsResponse, WorkerScoutLog } from "@/types/worker";
import type { IpmTask } from "@/app/actions/ipm-tasks";
import { formatDistanceToNow } from "date-fns";

async function fetchScouts(url: string): Promise<GetScoutsResponse> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch scouts");
  return res.json();
}

async function fetchTreatments(url: string): Promise<{ tasks: IpmTask[] }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch treatments");
  return res.json();
}

export default function PlantHealthLandingPage() {
  const router = useRouter();
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Get IPM/plant health tasks
  const { tasks, loading: tasksLoading, refresh: refreshTasks, isOnline } = useWorkerTasks();

  // Filter plant health tasks
  const plantHealthTasks = useMemo(() => {
    return tasks.filter(
      (t) => t.sourceModule === "plant_health" && (t.status === "in_progress" || t.status === "assigned" || t.status === "pending")
    );
  }, [tasks]);

  const ipmTasksDue = plantHealthTasks.filter(t => t.status === "pending" || t.status === "assigned");

  // Get scout logs
  const {
    data: scoutData,
    isLoading: scoutsLoading,
    mutate: mutateScouts,
  } = useSWR("/api/worker/scout", fetchScouts);

  // Get scheduled treatments
  const {
    data: treatmentData,
    isLoading: treatmentsLoading,
    mutate: mutateTreatments,
  } = useSWR("/api/worker/scout/treatments?status=pending&limit=10", fetchTreatments);

  const scouts = scoutData?.scouts ?? [];
  const stats = scoutData?.stats ?? { scoutedToday: 0, issuesFoundToday: 0 };
  const treatments = treatmentData?.tasks ?? [];

  const handleRefresh = async () => {
    vibrateTap();
    setRefreshing(true);
    try {
      await Promise.all([refreshTasks(), mutateScouts(), mutateTreatments()]);
      vibrateSuccess();
    } finally {
      setRefreshing(false);
    }
  };

  const handleScanClick = () => {
    vibrateTap();
    setIsScanOpen(true);
  };

  const handleScanDetected = useCallback(
    (text: string) => {
      if (!text) return;
      setIsScanOpen(false);

      // Check code format
      if (text.startsWith("ht:loc:")) {
        // Location code
        const locationId = text.replace("ht:loc:", "");
        router.push(`/worker/scout/location/${locationId}`);
      } else if (text.startsWith("ht:batch:")) {
        // Batch code
        const batchId = text.replace("ht:batch:", "");
        router.push(`/worker/scout/batch/${batchId}`);
      } else if (text.match(/^[0-9a-f-]{36}$/i)) {
        // UUID - assume batch ID
        router.push(`/worker/scout/batch/${text}`);
      } else if (text.match(/^B\d+/i)) {
        // Batch number format - need to look it up
        router.push(`/worker/scan?code=${encodeURIComponent(text)}&action=scout`);
      } else {
        // Unknown - try scan lookup
        router.push(`/worker/scan?code=${encodeURIComponent(text)}&action=scout`);
      }
    },
    [router]
  );

  const handleScoutClick = (scout: WorkerScoutLog) => {
    vibrateTap();
    if (scout.batchId) {
      router.push(`/worker/scout/batch/${scout.batchId}`);
    } else if (scout.locationId) {
      router.push(`/worker/scout/location/${scout.locationId}`);
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return dateStr;
    }
  };

  return (
    <PullToRefresh onRefresh={handleRefresh} refreshing={refreshing} enabled={isOnline} className="h-full">
      <div className="px-4 py-4 space-y-4">
        {/* Scan Button - Prominent */}
        <Card
          className={cn(
            "bg-primary text-primary-foreground cursor-pointer",
            "transition-all active:scale-[0.98]",
            "touch-manipulation"
          )}
          onClick={handleScanClick}
        >
          <CardContent className="p-6 flex items-center justify-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <ScanLine className="h-8 w-8" />
            </div>
            <div className="text-left">
              <h2 className="text-xl font-semibold">Scan to Scout</h2>
              <p className="text-sm opacity-90">Batch or location QR code</p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Eye className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold">{stats.scoutedToday}</span>
              </div>
              <p className="text-sm text-muted-foreground">Scouted Today</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <span className="text-2xl font-bold">{stats.issuesFoundToday}</span>
              </div>
              <p className="text-sm text-muted-foreground">Issues Found</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-16 flex-col gap-1"
            onClick={() => {
              vibrateTap();
              router.push("/worker/locations");
            }}
          >
            <MapPin className="h-5 w-5" />
            <span className="text-sm">Browse Locations</span>
          </Button>
          <Button
            variant="outline"
            className="h-16 flex-col gap-1"
            onClick={() => {
              vibrateTap();
              router.push("/worker/batches");
            }}
          >
            <Package className="h-5 w-5" />
            <span className="text-sm">Browse Batches</span>
          </Button>
        </div>

        {/* IPM Tasks Due Section */}
        {(tasksLoading || ipmTasksDue.length > 0) && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bug className="h-4 w-4" />
                  IPM Tasks Due
                </CardTitle>
                {ipmTasksDue.length > 0 && (
                  <Badge variant="secondary">{ipmTasksDue.length}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {tasksLoading ? (
                <div className="space-y-3">
                  {[...Array(2)].map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-lg" />
                  ))}
                </div>
              ) : ipmTasksDue.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No IPM tasks due</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ipmTasksDue.slice(0, 5).map((task) => (
                    <TaskCard key={task.id} task={task} onUpdate={handleRefresh} />
                  ))}
                  {ipmTasksDue.length > 5 && (
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        vibrateTap();
                        router.push("/worker/tasks?module=plant_health");
                      }}
                    >
                      View all {ipmTasksDue.length} tasks
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Treatment Schedule */}
        {(treatmentsLoading || treatments.length > 0) && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FlaskConical className="h-4 w-4" />
                  Treatment Schedule
                </CardTitle>
                {treatments.length > 0 && (
                  <Badge variant="secondary">{treatments.length}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {treatmentsLoading ? (
                <div className="space-y-3">
                  {[...Array(2)].map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))}
                </div>
              ) : treatments.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No scheduled treatments</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {treatments.slice(0, 5).map((task) => (
                    <TreatmentScheduleCard
                      key={task.id}
                      task={task}
                      onUpdate={handleRefresh}
                      compact
                    />
                  ))}
                  {treatments.length > 5 && (
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        vibrateTap();
                        router.push("/worker/tasks?module=plant_health");
                      }}
                    >
                      View all {treatments.length} treatments
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent Scouts */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Scouts
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleRefresh}
                disabled={scoutsLoading || refreshing}
              >
                <RefreshCw
                  className={cn("h-4 w-4", (scoutsLoading || refreshing) && "animate-spin")}
                />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {scoutsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : scouts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Eye className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No scouts recorded today</p>
                <p className="text-sm">Scan a batch or location to start</p>
              </div>
            ) : (
              <div className="space-y-2">
                {scouts.slice(0, 10).map((scout) => (
                  <div
                    key={scout.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border",
                      "cursor-pointer active:bg-muted/50 transition-all",
                      "touch-manipulation"
                    )}
                    onClick={() => handleScoutClick(scout)}
                  >
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                        scout.isAllClear
                          ? "bg-green-100 text-green-600"
                          : scout.severity === "critical"
                          ? "bg-red-100 text-red-600"
                          : scout.severity === "medium"
                          ? "bg-amber-100 text-amber-600"
                          : "bg-blue-100 text-blue-600"
                      )}
                    >
                      {scout.isAllClear ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <AlertTriangle className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {scout.batchNumber ? (
                          <span className="font-mono text-sm font-medium">
                            {scout.batchNumber}
                          </span>
                        ) : scout.locationName ? (
                          <span className="text-sm font-medium">{scout.locationName}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unknown</span>
                        )}
                        {scout.isAllClear ? (
                          <Badge variant="outline" className="text-xs text-green-600">
                            Clear
                          </Badge>
                        ) : scout.issueType ? (
                          <Badge
                            variant={scout.severity === "critical" ? "destructive" : "secondary"}
                            className="text-xs capitalize"
                          >
                            {scout.issueType}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {scout.varietyName || scout.notes || "No details"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {formatTime(scout.createdAt)}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scanner Dialog */}
      <ScannerDialog
        open={isScanOpen}
        onOpenChange={setIsScanOpen}
        onDetected={handleScanDetected}
      />
    </PullToRefresh>
  );
}
