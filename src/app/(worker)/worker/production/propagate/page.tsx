"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PropagationForm } from "@/components/worker/production/PropagationForm";
import { vibrateTap } from "@/lib/haptics";

interface Variety {
  id: string;
  name: string;
  family: string | null;
}

interface Size {
  id: string;
  name: string;
  cellMultiple: number;
  containerType: string | null;
}

interface Location {
  id: string;
  name: string;
  nurserySite: string | null;
}

interface ReferenceData {
  varieties: Variety[];
  sizes: Size[];
  locations: Location[];
}

/**
 * Worker propagation page.
 * Mobile-optimized form for creating seed/cutting batches.
 */
export default function WorkerPropagatePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referenceData, setReferenceData] = useState<ReferenceData | null>(
    null
  );

  // Load reference data
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        // Fetch reference data (varieties, sizes, and locations)
        const refResponse = await fetch("/api/lookups/reference-data");
        if (!refResponse.ok) {
          throw new Error("Failed to load reference data");
        }
        const refData = await refResponse.json();

        // Transform to expected format
        const varieties: Variety[] = (refData.varieties || []).map(
          (v: Record<string, unknown>) => ({
            id: v.id as string,
            name: v.name as string,
            family: v.family as string | null,
          })
        );

        const sizes: Size[] = (refData.sizes || []).map(
          (s: Record<string, unknown>) => ({
            id: s.id as string,
            name: s.name as string,
            cellMultiple: (s.cell_multiple as number) ?? 1,
            containerType: s.container_type as string | null,
          })
        );

        const locations: Location[] = (refData.locations || []).map(
          (l: Record<string, unknown>) => ({
            id: l.id as string,
            name: l.name as string,
            nurserySite: l.nursery_site as string | null,
          })
        );

        setReferenceData({ varieties, sizes, locations });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load data";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleCancel = () => {
    vibrateTap();
    router.back();
  };

  const handleSuccess = (batch: { id: string; batchNumber: string }) => {
    router.push(`/worker/batches/${batch.id}`);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
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
  if (error || !referenceData) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="py-8 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Unable to Load</h2>
              <p className="text-muted-foreground text-sm mb-4">
                {error || "Failed to load required data"}
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => router.back()}>
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
      <PropagationForm
        varieties={referenceData.varieties}
        sizes={referenceData.sizes}
        locations={referenceData.locations}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
}
