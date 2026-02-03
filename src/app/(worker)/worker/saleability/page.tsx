"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { vibrateTap } from "@/lib/haptics";
import { SaleabilityWizard, type ProductionStatusOption } from "@/components/production/saleability";

/**
 * Worker Saleability Wizard Page
 *
 * Mobile-optimized wizard for scanning batches and updating their saleable status.
 * Supports:
 * - QR code scanning
 * - Search by batch number or variety
 * - Status updates
 * - Photo uploads
 * - Continuous mode for batch scanning sessions
 */
export default function WorkerSaleabilityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusOptions, setStatusOptions] = useState<ProductionStatusOption[]>([]);

  // Fetch status options on mount
  useEffect(() => {
    async function loadStatusOptions() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/production/status-options");
        if (!response.ok) {
          throw new Error("Failed to load status options");
        }

        const data = await response.json();
        setStatusOptions(data.options ?? []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load data";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    loadStatusOptions();
  }, []);

  const handleBack = useCallback(() => {
    vibrateTap();
    router.back();
  }, [router]);

  const handleComplete = useCallback(() => {
    vibrateTap();
    router.push("/worker/production");
  }, [router]);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header onBack={handleBack} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header onBack={handleBack} />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="py-8 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Unable to Load</h2>
              <p className="text-muted-foreground text-sm mb-4">{error}</p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Go Back
                </Button>
                <Button onClick={() => window.location.reload()}>
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header onBack={handleBack} />

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Wizard Card */}
        <Card>
          <CardContent className="pt-6">
            <SaleabilityWizard
              statusOptions={statusOptions}
              onComplete={handleComplete}
            />
          </CardContent>
        </Card>

        {/* Quick Tips Card */}
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Tips for Quick Updates
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Scan mode:</strong> Use the scanner to quickly find batches by their QR code.
            </p>
            <p>
              <strong>Search mode:</strong> Type a batch number or variety name to search.
            </p>
            <p>
              <strong>Continuous mode:</strong> Keep it on to scan multiple batches in a session.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Header component
function Header({ onBack }: { onBack: () => void }) {
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
        <h1 className="font-semibold">Saleability Wizard</h1>
        <div className="w-[72px]" /> {/* Spacer for centering */}
      </div>
    </div>
  );
}
