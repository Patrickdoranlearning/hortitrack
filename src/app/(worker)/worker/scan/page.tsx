"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, Search, ScanLine, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScanResult } from "@/components/worker/ScanResult";
import { TaskSearch } from "@/components/worker/TaskSearch";
import type { WorkerTask } from "@/lib/types/worker-tasks";
import { vibrateTap, vibrateSuccess } from "@/lib/haptics";

// Dynamically import scanner to avoid SSR issues with camera
const ScannerClient = dynamic(
  () => import("@/components/Scanner/ScannerClient"),
  {
    ssr: false,
    loading: () => (
      <div className="aspect-video w-full bg-muted rounded-2xl flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

interface BatchInfo {
  id: string;
  batchNumber: string | null;
  varietyName: string | null;
}

interface MaterialInfo {
  id: string;
  partNumber: string;
  name: string;
  categoryName: string | null;
  totalStock: number;
  uom: string;
}

interface ScanLookupResult {
  found: boolean;
  task?: WorkerTask;
  suggestions?: WorkerTask[];
  batch?: BatchInfo;
  material?: MaterialInfo;
  message?: string;
}

type ViewMode = "scan" | "result" | "search";

export default function WorkerScanPage() {
  const [viewMode, setViewMode] = React.useState<ViewMode>("scan");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ScanLookupResult | null>(null);
  const [lastScannedCode, setLastScannedCode] = React.useState<string | null>(
    null
  );

  const handleDecoded = React.useCallback(async (code: string) => {
    // Avoid re-processing the same code
    if (code === lastScannedCode) return;
    setLastScannedCode(code);

    // Trigger haptic feedback on scan
    vibrateTap();

    try {
      setLoading(true);
      setError(null);
      setViewMode("result");

      const response = await fetch("/api/worker/scan-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Lookup failed");
      }

      const lookupResult: ScanLookupResult = await response.json();
      setResult(lookupResult);

      // Trigger haptic feedback on found task
      if (lookupResult.found) {
        vibrateSuccess();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to process scan"
      );
    } finally {
      setLoading(false);
    }
  }, [lastScannedCode]);

  const handleRetry = React.useCallback(() => {
    setLastScannedCode(null);
    setResult(null);
    setError(null);
    setViewMode("scan");
  }, []);

  const handleManualSearch = React.useCallback(() => {
    setViewMode("search");
  }, []);

  const handleScanInstead = React.useCallback(() => {
    setLastScannedCode(null);
    setResult(null);
    setError(null);
    setViewMode("scan");
  }, []);

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4">
          <Button variant="ghost" size="sm" asChild className="min-h-[44px] -ml-2">
            <Link href="/worker">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>

          <h1 className="font-semibold">
            {viewMode === "scan"
              ? "Scan to Start"
              : viewMode === "search"
              ? "Search Tasks"
              : "Scan Result"}
          </h1>

          {/* Toggle between scan and search */}
          <Button
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px] -mr-2"
            onClick={() => {
              if (viewMode === "search") {
                handleScanInstead();
              } else {
                handleManualSearch();
              }
            }}
          >
            {viewMode === "search" ? (
              <ScanLine className="h-5 w-5" />
            ) : (
              <Search className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {viewMode === "scan" && (
          <div className="p-4 space-y-4">
            {/* Instructions */}
            <div className="text-center mb-2">
              <p className="text-sm text-muted-foreground">
                Point your camera at a batch, task, or location barcode
              </p>
            </div>

            {/* Scanner */}
            <div className="relative">
              <ScannerClient onDecoded={handleDecoded} roiScale={0.8} />
            </div>

            {/* Quick actions */}
            <div className="flex flex-col gap-3 pt-4">
              <Button
                variant="outline"
                className="w-full h-12"
                onClick={handleManualSearch}
              >
                <Search className="mr-2 h-5 w-5" />
                Search Instead
              </Button>
            </div>

            {/* Supported codes info */}
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <h3 className="font-medium text-sm mb-2">Supported Codes</h3>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Batch barcodes (QR/Data Matrix)
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Task barcodes (printed from task sheets)
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Location barcodes (polytunnel labels)
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Material barcodes (part numbers, lot labels)
                </li>
              </ul>
            </div>
          </div>
        )}

        {viewMode === "result" && (
          <ScanResult
            loading={loading}
            found={result?.found ?? false}
            task={result?.task}
            suggestions={result?.suggestions}
            batch={result?.batch}
            material={result?.material}
            message={result?.message}
            error={error}
            onRetry={handleRetry}
            onManualSearch={handleManualSearch}
          />
        )}

        {viewMode === "search" && (
          <TaskSearch onScanInstead={handleScanInstead} />
        )}
      </div>
    </div>
  );
}
