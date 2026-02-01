"use client";

import * as React from "react";
import Link from "next/link";
import {
  Play,
  ExternalLink,
  Package,
  User,
  Loader2,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ProductivityFeedback } from "../ProductivityFeedback";
import type { WorkerTask, DispatchContext } from "@/lib/types/worker-tasks";

type ExecutionStep = "view" | "start" | "picking" | "complete";

interface PickListDetails {
  id: string;
  orderNumber: string | null;
  customerName: string | null;
  deliveryDate: string | null;
  itemsTotal: number;
  itemsPicked: number;
  status: string | null;
  items: Array<{
    id: string;
    varietyName: string | null;
    sizeName: string | null;
    quantity: number;
    quantityPicked: number;
  }>;
}

interface DispatchExecutionFlowProps {
  task: WorkerTask;
  pickList: PickListDetails | null;
  onRefresh: () => Promise<void>;
}

/**
 * Dispatch/picking task execution flow component.
 * Shows order summary and links to the existing picker UI.
 */
export function DispatchExecutionFlow({
  task,
  pickList,
  onRefresh,
}: DispatchExecutionFlowProps) {
  const getInitialStep = (): ExecutionStep => {
    if (task.status === "completed") return "complete";
    if (task.status === "in_progress") return "picking";
    return "view";
  };

  const [currentStep, setCurrentStep] = React.useState<ExecutionStep>(getInitialStep);
  const [isStarting, setIsStarting] = React.useState(false);
  const [completedData, setCompletedData] = React.useState<{
    plantsProcessed: number;
    startedAt: string;
    completedAt: string;
    plantsPerHour: number;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const context = task.moduleContext as DispatchContext | undefined;

  // Calculate progress
  const itemsPicked = pickList?.itemsPicked ?? context?.itemsPicked ?? 0;
  const itemsTotal = pickList?.itemsTotal ?? context?.itemsTotal ?? 0;
  const progressPercent = itemsTotal > 0 ? Math.round((itemsPicked / itemsTotal) * 100) : 0;
  const isPickingComplete = itemsPicked >= itemsTotal && itemsTotal > 0;

  const handleStart = async () => {
    setIsStarting(true);
    setError(null);

    try {
      const response = await fetch(`/api/tasks/${task.id}/start`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start task");
      }

      await onRefresh();
      setCurrentStep("picking");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start task");
    } finally {
      setIsStarting(false);
    }
  };

  const handleComplete = async () => {
    try {
      const response = await fetch(`/api/tasks/${task.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actualPlantQuantity: itemsPicked,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to complete task");
      }

      const data = await response.json();
      const completedTask = data.task;

      const startedAt = task.startedAt || new Date().toISOString();
      const completedAt = completedTask.completedAt || new Date().toISOString();
      const durationMinutes = Math.round(
        (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000 / 60
      );
      const plantsPerHour = durationMinutes > 0
        ? Math.round((itemsPicked / durationMinutes) * 60)
        : 0;

      setCompletedData({
        plantsProcessed: itemsPicked,
        startedAt,
        completedAt,
        plantsPerHour,
      });

      setCurrentStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete task");
    }
  };

  // Render complete screen
  if (currentStep === "complete" && completedData) {
    return (
      <ProductivityFeedback
        plantsProcessed={completedData.plantsProcessed}
        startedAt={completedData.startedAt}
        completedAt={completedData.completedAt}
        plantsPerHour={completedData.plantsPerHour}
      />
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 px-4 py-4 space-y-4 overflow-auto">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-xs bg-horti-earth/10 text-horti-earth">
              Picking
            </Badge>
            <Badge
              variant={task.status === "in_progress" ? "default" : "outline"}
              className="text-xs"
            >
              {task.status === "in_progress" ? "In Progress" : "Assigned"}
            </Badge>
          </div>
          <h1 className="text-xl font-bold">{task.title}</h1>
          {task.description && (
            <p className="text-muted-foreground mt-1">{task.description}</p>
          )}
        </div>

        <Separator />

        {/* Order info */}
        <div className="grid grid-cols-2 gap-4">
          {(pickList?.orderNumber || context?.orderNumber) && (
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Order</p>
                  <p className="font-semibold">{pickList?.orderNumber || context?.orderNumber}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {(pickList?.customerName || context?.customerName) && (
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-semibold truncate">
                    {pickList?.customerName || context?.customerName}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Progress card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Picking Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Items Picked</span>
              <span className="font-semibold">
                {itemsPicked} / {itemsTotal}
              </span>
            </div>
            <Progress value={progressPercent} className="h-3" />
            {isPickingComplete && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">All items picked!</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Items list (if available) */}
        {pickList?.items && pickList.items.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Items ({pickList.items.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y max-h-64 overflow-y-auto">
                {pickList.items.map((item) => {
                  const isComplete = item.quantityPicked >= item.quantity;
                  return (
                    <div
                      key={item.id}
                      className={`px-4 py-3 flex items-center justify-between ${
                        isComplete ? "bg-green-50/50 dark:bg-green-950/20" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isComplete && (
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                        )}
                        <div>
                          <p className="font-medium text-sm">
                            {item.varietyName || "Unknown"}
                          </p>
                          {item.sizeName && (
                            <p className="text-xs text-muted-foreground">{item.sizeName}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant={isComplete ? "default" : "outline"}
                          className={isComplete ? "bg-green-600" : ""}
                        >
                          {item.quantityPicked} / {item.quantity}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delivery date */}
        {pickList?.deliveryDate && (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Delivery Date</p>
              <p className="font-semibold">
                {new Date(pickList.deliveryDate).toLocaleDateString("en-IE", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Error message */}
        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </div>

      {/* Bottom action buttons */}
      <div className="p-4 border-t bg-background safe-area-inset-bottom space-y-3">
        {currentStep === "view" ? (
          <Button
            className="w-full h-14 text-lg font-semibold"
            onClick={handleStart}
            disabled={isStarting}
          >
            {isStarting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="mr-2 h-5 w-5" />
                Start Picking
              </>
            )}
          </Button>
        ) : currentStep === "picking" ? (
          <>
            {/* Link to picker UI */}
            {pickList?.id && (
              <Button
                variant="outline"
                className="w-full h-12"
                asChild
              >
                <Link href={`/dispatch/picking/${pickList.id}`}>
                  <ExternalLink className="mr-2 h-5 w-5" />
                  Open Picker
                </Link>
              </Button>
            )}

            {/* Complete button - enabled when picking is done */}
            <Button
              className="w-full h-14 text-lg font-semibold"
              onClick={handleComplete}
              disabled={!isPickingComplete}
            >
              {isPickingComplete ? (
                <>
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Complete Picking
                </>
              ) : (
                <>
                  <ArrowRight className="mr-2 h-5 w-5" />
                  Continue Picking ({progressPercent}%)
                </>
              )}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
