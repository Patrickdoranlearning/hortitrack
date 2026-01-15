"use client";

import { Badge } from "@/components/ui/badge";
import { Truck, AlertTriangle } from "lucide-react";
import { useTrolleyBalance, isOverdue } from "@/hooks/useTrolleyBalance";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type CustomerTrolleyBadgeProps = {
  customerId: string;
  showIfZero?: boolean;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
};

export function CustomerTrolleyBadge({
  customerId,
  showIfZero = false,
  size = "md",
  showLabel = false,
  className,
}: CustomerTrolleyBadgeProps) {
  const { balance, isLoading } = useTrolleyBalance(customerId);

  // Don't render if loading or no balance and showIfZero is false
  if (isLoading) {
    return null;
  }

  const trolleysOut = balance?.trolleysOut ?? 0;

  if (trolleysOut === 0 && !showIfZero) {
    return null;
  }

  const overdue = isOverdue(balance);
  const daysOutstanding = balance?.daysOutstanding;

  const badgeContent = (
    <Badge
      variant={overdue ? "destructive" : trolleysOut > 0 ? "warning" : "secondary"}
      className={cn(
        "gap-1",
        size === "sm" && "text-xs px-1.5 py-0",
        size === "md" && "text-sm",
        className
      )}
    >
      {overdue && <AlertTriangle className={cn("h-3 w-3", size === "sm" && "h-2.5 w-2.5")} />}
      {!overdue && <Truck className={cn("h-3 w-3", size === "sm" && "h-2.5 w-2.5")} />}
      <span>{trolleysOut}</span>
      {showLabel && <span className="ml-0.5">trolley{trolleysOut !== 1 && "s"}</span>}
    </Badge>
  );

  // If we have days outstanding info, wrap in tooltip
  if (daysOutstanding !== null) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
          <TooltipContent>
            <p>
              {trolleysOut} trolley{trolleysOut !== 1 && "s"} outstanding
            </p>
            <p className="text-xs text-muted-foreground">
              {daysOutstanding === 0
                ? "Since today"
                : `For ${daysOutstanding} day${daysOutstanding !== 1 ? "s" : ""}`}
              {overdue && " - Overdue!"}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badgeContent;
}

/**
 * Static version that doesn't fetch data - use when you already have balance info
 */
export function CustomerTrolleyBadgeStatic({
  trolleysOut,
  daysOutstanding,
  showIfZero = false,
  size = "md",
  showLabel = false,
  className,
}: {
  trolleysOut: number;
  daysOutstanding?: number | null;
  showIfZero?: boolean;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}) {
  if (trolleysOut === 0 && !showIfZero) {
    return null;
  }

  const overdue = daysOutstanding !== null && daysOutstanding !== undefined && daysOutstanding > 14;

  const badgeContent = (
    <Badge
      variant={overdue ? "destructive" : trolleysOut > 0 ? "warning" : "secondary"}
      className={cn(
        "gap-1",
        size === "sm" && "text-xs px-1.5 py-0",
        size === "md" && "text-sm",
        className
      )}
    >
      {overdue && <AlertTriangle className={cn("h-3 w-3", size === "sm" && "h-2.5 w-2.5")} />}
      {!overdue && <Truck className={cn("h-3 w-3", size === "sm" && "h-2.5 w-2.5")} />}
      <span>{trolleysOut}</span>
      {showLabel && <span className="ml-0.5">trolley{trolleysOut !== 1 && "s"}</span>}
    </Badge>
  );

  if (daysOutstanding !== null && daysOutstanding !== undefined) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
          <TooltipContent>
            <p>
              {trolleysOut} trolley{trolleysOut !== 1 && "s"} outstanding
            </p>
            <p className="text-xs text-muted-foreground">
              {daysOutstanding === 0
                ? "Since today"
                : `For ${daysOutstanding} day${daysOutstanding !== 1 ? "s" : ""}`}
              {overdue && " - Overdue!"}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badgeContent;
}
