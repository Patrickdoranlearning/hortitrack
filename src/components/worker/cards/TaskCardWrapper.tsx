"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, ArrowRight, Loader2 } from "lucide-react";
import type { WorkerTask } from "@/lib/types/worker-tasks";
import { getStatusLabel, getStatusBadgeVariant } from "@/lib/types/worker-tasks";
import { cn } from "@/lib/utils";

interface TaskCardWrapperProps {
  task: WorkerTask;
  /** Badge color variant for the task type */
  typeBadgeVariant?: "default" | "secondary" | "outline" | "accent";
  /** Label shown in type badge */
  typeLabel: string;
  /** Main content slots */
  children: React.ReactNode;
  /** Optional footer content (e.g., location) */
  footer?: React.ReactNode;
  /** Callback after task action */
  onUpdate?: () => void;
}

/**
 * Shared wrapper for all task card types
 * Provides consistent layout, status badges, and action buttons
 */
export function TaskCardWrapper({
  task,
  typeBadgeVariant = "secondary",
  typeLabel,
  children,
  footer,
  onUpdate,
}: TaskCardWrapperProps) {
  const [loading, setLoading] = useState(false);
  const isInProgress = task.status === "in_progress";

  const handleStart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      setLoading(true);
      const response = await fetch(`/api/tasks/${task.id}/start`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start task");
      }

      onUpdate?.();
    } catch (err) {
      // In production, show toast notification
      console.error("Failed to start task:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Link href={`/worker/task/${task.id}`}>
      <Card
        className={cn(
          "transition-all active:scale-[0.98]",
          isInProgress && "ring-2 ring-primary ring-offset-2"
        )}
      >
        <CardContent className="p-4">
          {/* Top row: Type badge + Status badge */}
          <div className="flex items-center justify-between mb-2">
            <Badge variant={typeBadgeVariant} className="text-xs">
              {typeLabel}
            </Badge>
            <Badge
              variant={getStatusBadgeVariant(task.status)}
              className="text-xs"
            >
              {getStatusLabel(task.status)}
            </Badge>
          </div>

          {/* Title */}
          <h3 className="font-semibold text-base mb-1 line-clamp-2">
            {task.title}
          </h3>

          {/* Module-specific content */}
          <div className="text-sm text-muted-foreground space-y-1">
            {children}
          </div>

          {/* Footer (location, etc.) */}
          {footer && (
            <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
              {footer}
            </div>
          )}

          {/* Action Button - Large touch target */}
          <div className="mt-3">
            {isInProgress ? (
              <Button
                className="w-full h-12 text-base font-semibold"
                onClick={(e) => e.preventDefault()}
              >
                <ArrowRight className="mr-2 h-5 w-5" />
                Continue
              </Button>
            ) : (
              <Button
                className="w-full h-12 text-base font-semibold"
                variant="secondary"
                onClick={handleStart}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Play className="mr-2 h-5 w-5" />
                )}
                Start
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
