"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PlantHealthEvent } from "@/lib/history-types";
import { AlertTriangle, Bug, ExternalLink, Calendar, Gauge } from "lucide-react";
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

  // Determine if this is a reading vs an issue
  const isReading = log.ecReading != null || log.phReading != null;
  const displayIcon = isReading ? Gauge : AlertTriangle;
  const IconComponent = displayIcon;

  if (compact) {
    return (
      <div className="flex items-start gap-3 py-3 px-3 border rounded-lg bg-muted/20 mb-2">
        <div className={`p-1.5 rounded-full ${isReading ? 'bg-blue-100' : 'bg-orange-100'}`}>
          <IconComponent className={`h-4 w-4 flex-shrink-0 ${isReading ? 'text-blue-600' : severityStyle.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            {isReading ? (
              // Display readings prominently
              <span className="font-medium text-sm">
                {log.ecReading != null && <span className="mr-3">EC: <strong>{log.ecReading}</strong> mS/cm</span>}
                {log.phReading != null && <span>pH: <strong>{log.phReading}</strong></span>}
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{log.title || log.issueType || 'Scout Observation'}</span>
                <Badge variant={severityStyle.variant} className={`text-[10px] flex-shrink-0 ${severityStyle.className}`}>
                  {log.severity || 'Unknown'}
                </Badge>
              </div>
            )}
          </div>
          {log.details && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{log.details}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs">
            <span className="flex items-center gap-1 font-medium text-foreground">
              <Calendar className="h-3 w-3" />
              {new Date(log.at).toLocaleDateString()} {new Date(log.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {log.userName && (
              <span className="text-muted-foreground">by {log.userName}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="p-4 bg-muted/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full bg-white border ${isReading ? 'border-blue-200' : severity === 'critical' || severity === 'high' ? 'border-red-200' : severity === 'medium' ? 'border-yellow-200' : 'border-green-200'}`}>
            <IconComponent className={`h-4 w-4 ${isReading ? 'text-blue-500' : severityStyle.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            {isReading ? (
              // Reading display - show EC/pH prominently
              <div>
                <span className="font-medium">Reading</span>
                <div className="flex items-center gap-4 mt-1">
                  {log.ecReading != null && (
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground text-sm">EC:</span>
                      <span className="font-semibold text-lg">{log.ecReading}</span>
                      <span className="text-xs text-muted-foreground">mS/cm</span>
                    </div>
                  )}
                  {log.phReading != null && (
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground text-sm">pH:</span>
                      <span className="font-semibold text-lg">{log.phReading}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Issue display
              <>
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
              </>
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
