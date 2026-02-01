"use client";

import * as React from "react";
import { CheckCircle2, TrendingUp, Clock, Leaf, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ProductivityFeedbackProps {
  plantsProcessed: number;
  startedAt: string;
  completedAt: string;
  plantsPerHour: number;
  className?: string;
}

/**
 * Shown after task completion to provide productivity feedback.
 * Displays plants processed, time taken, and rate achieved.
 */
export function ProductivityFeedback({
  plantsProcessed,
  startedAt,
  completedAt,
  plantsPerHour,
  className,
}: ProductivityFeedbackProps) {
  // Calculate duration
  const duration = React.useMemo(() => {
    const start = new Date(startedAt);
    const end = new Date(completedAt);
    const durationMinutes = Math.round((end.getTime() - start.getTime()) / 1000 / 60);

    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} minutes`;
  }, [startedAt, completedAt]);

  // Determine performance level for messaging
  const performanceLevel = React.useMemo(() => {
    // These thresholds could be made configurable
    if (plantsPerHour >= 500) return "excellent";
    if (plantsPerHour >= 300) return "good";
    if (plantsPerHour >= 150) return "standard";
    return "steady";
  }, [plantsPerHour]);

  const getMessage = () => {
    switch (performanceLevel) {
      case "excellent":
        return "Outstanding pace! You're crushing it!";
      case "good":
        return "Great work! Keep up the momentum!";
      case "standard":
        return "Solid progress! Well done!";
      default:
        return "Task complete! Good job!";
    }
  };

  return (
    <div className={cn("flex flex-col items-center px-4 py-8", className)}>
      {/* Success animation */}
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
        <div className="relative bg-green-100 dark:bg-green-900/50 rounded-full p-6">
          <CheckCircle2 className="h-16 w-16 text-green-600" />
        </div>
      </div>

      {/* Encouraging message */}
      <h2 className="text-2xl font-bold text-center mb-2">Task Complete!</h2>
      <p className="text-muted-foreground text-center mb-8">{getMessage()}</p>

      {/* Stats cards */}
      <div className="w-full max-w-sm space-y-3 mb-8">
        {/* Plants processed */}
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 dark:bg-green-900/50 rounded-lg p-2">
                <Leaf className="h-5 w-5 text-green-600" />
              </div>
              <span className="text-sm text-muted-foreground">Plants Processed</span>
            </div>
            <span className="text-xl font-bold">{plantsProcessed.toLocaleString()}</span>
          </CardContent>
        </Card>

        {/* Time taken */}
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 dark:bg-blue-900/50 rounded-lg p-2">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <span className="text-sm text-muted-foreground">Time Taken</span>
            </div>
            <span className="text-xl font-bold">{duration}</span>
          </CardContent>
        </Card>

        {/* Plants per hour */}
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/20 rounded-lg p-2">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-medium">Plants/Hour</span>
            </div>
            <span className="text-2xl font-bold text-primary">
              {plantsPerHour.toLocaleString()}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Performance badge */}
      <div className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-8",
        performanceLevel === "excellent" && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200",
        performanceLevel === "good" && "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200",
        performanceLevel === "standard" && "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
        performanceLevel === "steady" && "bg-muted text-muted-foreground"
      )}>
        {performanceLevel === "excellent" && "Star Performer"}
        {performanceLevel === "good" && "Above Average"}
        {performanceLevel === "standard" && "On Track"}
        {performanceLevel === "steady" && "Steady Progress"}
      </div>

      {/* Action button */}
      <Button
        asChild
        size="lg"
        className="w-full max-w-sm h-14 text-lg font-semibold"
      >
        <Link href="/worker">
          <ArrowLeft className="mr-2 h-5 w-5" />
          Back to Tasks
        </Link>
      </Button>
    </div>
  );
}

/**
 * Compact version for inline display
 */
export function ProductivitySummary({
  plantsProcessed,
  durationMinutes,
  plantsPerHour,
}: {
  plantsProcessed: number;
  durationMinutes: number;
  plantsPerHour: number;
}) {
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1">
        <Leaf className="h-4 w-4 text-muted-foreground" />
        <span>{plantsProcessed.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-1">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span>{formatDuration(durationMinutes)}</span>
      </div>
      <div className="flex items-center gap-1">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{plantsPerHour}/hr</span>
      </div>
    </div>
  );
}
