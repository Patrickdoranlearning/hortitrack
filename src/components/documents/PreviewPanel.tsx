"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  RefreshCw,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentComponent, DocumentType } from "@/lib/documents/types";
import { renderPreviewClient, getSampleDataForType } from "./utils/renderPreviewClient";

type PreviewPanelProps = {
  /** Document layout components */
  layout: DocumentComponent[];
  /** Document type for sample data */
  documentType: DocumentType;
  /** HTML content (if provided externally) */
  html?: string;
  /** Whether preview is loading */
  isLoading?: boolean;
  /** Error message if any */
  error?: string | null;
  /** Last updated timestamp */
  lastUpdated?: Date | null;
  /** Callback to refresh preview */
  onRefresh?: () => void;
  /** Whether to show in full-screen mode */
  fullScreen?: boolean;
  /** Toggle full-screen callback */
  onToggleFullScreen?: () => void;
  /** Custom class name */
  className?: string;
};

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5];

/**
 * Live preview panel for document templates.
 * Shows a rendered preview that updates as the user edits.
 */
export function PreviewPanel({
  layout,
  documentType,
  html: externalHtml,
  isLoading = false,
  error = null,
  lastUpdated,
  onRefresh,
  fullScreen = false,
  onToggleFullScreen,
  className,
}: PreviewPanelProps) {
  const [zoom, setZoom] = useState(1);

  // Generate preview HTML client-side if not provided externally
  const previewHtml = useMemo(() => {
    if (externalHtml) return externalHtml;
    if (!layout || layout.length === 0) return "";

    try {
      const sampleData = getSampleDataForType(documentType);
      return renderPreviewClient(layout, sampleData, {
        title: `${documentType} Preview`,
        documentType,
      });
    } catch {
      return "";
    }
  }, [externalHtml, layout, documentType]);

  const handleZoomIn = useCallback(() => {
    const idx = ZOOM_LEVELS.indexOf(zoom);
    if (idx < ZOOM_LEVELS.length - 1) setZoom(ZOOM_LEVELS[idx + 1]);
  }, [zoom]);

  const handleZoomOut = useCallback(() => {
    const idx = ZOOM_LEVELS.indexOf(zoom);
    if (idx > 0) setZoom(ZOOM_LEVELS[idx - 1]);
  }, [zoom]);

  const formatLastUpdated = useCallback((date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 5) return "Just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    return date.toLocaleTimeString();
  }, []);

  return (
    <div
      className={cn(
        "flex flex-col bg-muted/30 border-l",
        fullScreen ? "fixed inset-0 z-50 border-l-0" : "h-full",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Preview</span>
          {isLoading ? (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Loader2 className="h-3 w-3 animate-spin" />
              Updating
            </Badge>
          ) : error ? (
            <Badge variant="destructive" className="gap-1 text-[10px]">
              <AlertCircle className="h-3 w-3" />
              Error
            </Badge>
          ) : lastUpdated ? (
            <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
              <CheckCircle2 className="h-3 w-3" />
              {formatLastUpdated(lastUpdated)}
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          {/* Zoom controls */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleZoomOut}
                  disabled={zoom <= 0.5}
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom out</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <span className="text-xs text-muted-foreground w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleZoomIn}
                  disabled={zoom >= 1.5}
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom in</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Refresh */}
          {onRefresh && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={onRefresh}
                    disabled={isLoading}
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh preview</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Full screen toggle */}
          {onToggleFullScreen && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={onToggleFullScreen}
                  >
                    {fullScreen ? (
                      <Minimize2 className="h-3.5 w-3.5" />
                    ) : (
                      <Maximize2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {fullScreen ? "Exit full screen" : "Full screen"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Preview content */}
      <div className="flex-1 overflow-auto p-4">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <AlertCircle className="h-8 w-8 text-destructive mb-2" />
            <p className="text-sm text-destructive font-medium">Preview Error</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">{error}</p>
            {onRefresh && (
              <Button variant="outline" size="sm" className="mt-3" onClick={onRefresh}>
                Try Again
              </Button>
            )}
          </div>
        ) : !previewHtml || layout.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-muted-foreground">
              <p className="text-sm font-medium">No preview available</p>
              <p className="text-xs mt-1">Add components to see a live preview</p>
            </div>
          </div>
        ) : (
          <div
            className="mx-auto transition-transform origin-top"
            style={{
              transform: `scale(${zoom})`,
              width: `${100 / zoom}%`,
            }}
          >
            <div className="bg-white rounded-lg shadow-lg border overflow-hidden">
              <iframe
                title="Document Preview"
                srcDoc={previewHtml}
                className="w-full border-0"
                style={{
                  height: fullScreen ? "calc(100vh - 120px)" : "600px",
                  minHeight: "400px",
                }}
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        )}
      </div>

      {/* Sample data notice */}
      <div className="px-3 py-2 border-t bg-muted/50">
        <p className="text-[10px] text-muted-foreground text-center">
          Preview uses sample data. Click &quot;Preview&quot; in toolbar to use real data.
        </p>
      </div>
    </div>
  );
}
