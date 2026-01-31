"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PlantHealthEvent } from "@/lib/history-types";
import { AlertTriangle, Bug, ExternalLink, MapPin, Calendar } from "lucide-react";
import Link from "next/link";

// Severity badge styling
const SEVERITY_STYLES: Record<string, {
  variant: "default" | "secondary" | "destructive" | "outline";
  className: string;
  iconColor: string;
}> = {
  low: {
    variant: "outline",
    className: "border-green-500 text-green-700 bg-green-50",
    iconColor: "text-green-600"
  },
  medium: {
    variant: "secondary",
    className: "bg-yellow-100 text-yellow-800 border-yellow-300",
    iconColor: "text-yellow-600"
  },
  high: {
    variant: "destructive",
    className: "bg-orange-500",
    iconColor: "text-orange-500"
  },
  critical: {
    variant: "destructive",
    className: "bg-red-600",
    iconColor: "text-red-500"
  },
};

interface ScoutLogCardProps {
  log: PlantHealthEvent;
  showBatchLink?: boolean;
  compact?: boolean;
}

export function ScoutLogCard({ log, showBatchLink = false, compact = false }: ScoutLogCardProps) {
  const severity = log.severity?.toLowerCase() || 'unknown';
  const severityStyle = SEVERITY_STYLES[severity] || SEVERITY_STYLES.low;

  if (compact) {
    return (
      <div className="flex items-center gap-3 py-2 border-b last:border-b-0">
        <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${severityStyle.iconColor}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{log.title || log.issueType || 'Scout Observation'}</span>
            <Badge variant={severityStyle.variant} className={`text-[10px] flex-shrink-0 ${severityStyle.className}`}>
              {log.severity || 'Unknown'}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>{new Date(log.at).toLocaleDateString()}</span>
            {log.userName && <span>by {log.userName}</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="p-4 bg-muted/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full bg-white border ${severity === 'critical' || severity === 'high' ? 'border-red-200' : severity === 'medium' ? 'border-yellow-200' : 'border-green-200'}`}>
            <AlertTriangle className={`h-4 w-4 ${severityStyle.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{log.title || 'Scout Observation'}</span>
              <Badge variant={severityStyle.variant} className={`text-xs ${severityStyle.className}`}>
                {log.severity || 'Unknown'}
              </Badge>
            </div>
            {log.issueType && log.issueType !== log.title && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                <Bug className="h-3 w-3" />
                {log.issueType}
              </div>
            )}
          </div>
        </div>
      </div>

      {log.details && (
        <p className="text-sm text-muted-foreground mt-3 pl-11">{log.details}</p>
      )}

      {/* Photos */}
      {log.photos && log.photos.length > 0 && (
        <div className="mt-3 pl-11 flex gap-2 flex-wrap">
          {log.photos.slice(0, 4).map((photo, idx) => (
            <img
              key={idx}
              src={photo}
              alt={`Scout photo ${idx + 1}`}
              className="h-16 w-16 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition"
            />
          ))}
          {log.photos.length > 4 && (
            <div className="h-16 w-16 rounded-lg border bg-muted flex items-center justify-center text-sm text-muted-foreground font-medium">
              +{log.photos.length - 4}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 pl-11 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(log.at).toLocaleDateString()} at {new Date(log.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {log.userName && (
            <span>by {log.userName}</span>
          )}
        </div>
        {showBatchLink && log.batchId && (
          <Link
            href={`/production/batches/${log.batchId}`}
            className="flex items-center gap-1 text-primary hover:underline"
          >
            {log.batchNumber ? `Batch #${log.batchNumber}` : 'View Batch'}
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
    </Card>
  );
}

export default ScoutLogCard;
