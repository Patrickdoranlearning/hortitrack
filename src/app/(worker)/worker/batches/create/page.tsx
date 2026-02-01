"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Search,
  CheckCircle2,
  Plus,
  Eye,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { vibrateTap, vibrateSuccess } from "@/lib/haptics";
import { useToast } from "@/hooks/use-toast";

interface Variety {
  id: string;
  name: string;
  family?: string | null;
}

interface Size {
  id: string;
  name: string;
  cell_multiple: number;
  container_type?: string | null;
}

interface Location {
  id: string;
  name: string;
}

interface ReferenceData {
  varieties: Variety[];
  sizes: Size[];
  locations: Location[];
}

export default function WorkerBatchCreatePage() {
  const router = useRouter();
  const { toast } = useToast();

  // Reference data
  const [referenceData, setReferenceData] = useState<ReferenceData | null>(null);
  const [loadingRef, setLoadingRef] = useState(true);

  // Form state
  const [varietyId, setVarietyId] = useState<string>("");
  const [sizeId, setSizeId] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [plantingDate, setPlantingDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<{
    batchNumber: string;
    batchId: string;
    varietyName: string;
    quantity: number;
  } | null>(null);

  // Search/selector state
  const [varietySearch, setVarietySearch] = useState("");
  const [sizeSearch, setSizeSearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [showVarietySelector, setShowVarietySelector] = useState(false);
  const [showSizeSelector, setShowSizeSelector] = useState(false);
  const [showLocationSelector, setShowLocationSelector] = useState(false);

  // Fetch reference data
  useEffect(() => {
    async function fetchReferenceData() {
      try {
        setLoadingRef(true);
        const response = await fetch("/api/catalog/reference-data");
        if (!response.ok) {
          throw new Error("Failed to load data");
        }
        const data = await response.json();
        setReferenceData(data);

        // Set default location
        if (data.locations?.length > 0) {
          setLocationId(data.locations[0].id);
        }
      } catch {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load varieties, sizes, and locations",
        });
      } finally {
        setLoadingRef(false);
      }
    }

    fetchReferenceData();
  }, [toast]);

  // Get selected items
  const selectedVariety = referenceData?.varieties.find((v) => v.id === varietyId);
  const selectedSize = referenceData?.sizes.find((s) => s.id === sizeId);
  const selectedLocation = referenceData?.locations.find((l) => l.id === locationId);

  // Calculate total units
  const totalUnits = selectedSize
    ? quantity * Math.max(1, selectedSize.cell_multiple)
    : quantity;

  // Filter functions
  const filteredVarieties = referenceData?.varieties.filter((v) =>
    v.name.toLowerCase().includes(varietySearch.toLowerCase())
  ) ?? [];

  const filteredSizes = referenceData?.sizes.filter((s) =>
    s.name.toLowerCase().includes(sizeSearch.toLowerCase())
  ) ?? [];

  const filteredLocations = referenceData?.locations.filter((l) =>
    l.name.toLowerCase().includes(locationSearch.toLowerCase())
  ) ?? [];

  const handleBack = () => {
    vibrateTap();
    router.back();
  };

  const handleQuantityChange = (value: number) => {
    setQuantity(Math.max(1, value));
  };

  const handleSubmit = async () => {
    if (!varietyId || !sizeId || !locationId) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please select variety, size, and location",
      });
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch("/api/production/batches/propagate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plant_variety_id: varietyId,
          size_id: sizeId,
          location_id: locationId,
          containers: quantity,
          planted_at: plantingDate,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create batch");
      }

      const data = await response.json();
      vibrateSuccess();

      setSuccessData({
        batchNumber: data.batch?.batch_number ?? "",
        batchId: data.batch?.id ?? "",
        varietyName: selectedVariety?.name ?? "Unknown",
        quantity: totalUnits,
      });

      // Reset form
      setVarietyId("");
      setSizeId("");
      setQuantity(1);
      setVarietySearch("");
      setSizeSearch("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Creation failed",
        description: error instanceof Error ? error.message : "Failed to create batch",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = varietyId && sizeId && locationId && quantity > 0;

  // Loading state
  if (loadingRef) {
    return (
      <div className="flex flex-col h-full">
        <Header onBack={handleBack} title="New Batch" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header onBack={handleBack} title="New Batch" />

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Variety Selector */}
        <Card>
          <CardContent className="p-4">
            <Label className="text-sm text-muted-foreground">Variety</Label>
            <Button
              variant="outline"
              className="w-full h-12 justify-between mt-2"
              onClick={() => {
                vibrateTap();
                setShowVarietySelector(true);
              }}
            >
              <span className={cn(!selectedVariety && "text-muted-foreground")}>
                {selectedVariety?.name ?? "Select variety"}
              </span>
              <Search className="h-4 w-4 text-muted-foreground" />
            </Button>
            {selectedVariety?.family && (
              <p className="text-sm text-muted-foreground mt-1">
                Family: {selectedVariety.family}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Size Selector */}
        <Card>
          <CardContent className="p-4">
            <Label className="text-sm text-muted-foreground">Size / Container</Label>
            <Button
              variant="outline"
              className="w-full h-12 justify-between mt-2"
              onClick={() => {
                vibrateTap();
                setShowSizeSelector(true);
              }}
            >
              <span className={cn(!selectedSize && "text-muted-foreground")}>
                {selectedSize?.name ?? "Select size"}
              </span>
              <Search className="h-4 w-4 text-muted-foreground" />
            </Button>
            {selectedSize?.cell_multiple && selectedSize.cell_multiple > 1 && (
              <p className="text-sm text-muted-foreground mt-1">
                {selectedSize.cell_multiple} cells per container
              </p>
            )}
          </CardContent>
        </Card>

        {/* Quantity */}
        <Card>
          <CardContent className="p-4">
            <Label className="text-sm text-muted-foreground">Containers</Label>
            <div className="flex items-center gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-12 w-12"
                onClick={() => handleQuantityChange(quantity - 1)}
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                className="h-12 text-center text-lg font-semibold"
                value={quantity}
                onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                min={1}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-12 w-12"
                onClick={() => handleQuantityChange(quantity + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {selectedSize && (
              <p className="text-sm font-medium text-primary mt-2">
                Total: {totalUnits.toLocaleString()} plants
              </p>
            )}
          </CardContent>
        </Card>

        {/* Location Selector */}
        <Card>
          <CardContent className="p-4">
            <Label className="text-sm text-muted-foreground">Location</Label>
            <Button
              variant="outline"
              className="w-full h-12 justify-between mt-2"
              onClick={() => {
                vibrateTap();
                setShowLocationSelector(true);
              }}
            >
              <span className={cn(!selectedLocation && "text-muted-foreground")}>
                {selectedLocation?.name ?? "Select location"}
              </span>
              <Search className="h-4 w-4 text-muted-foreground" />
            </Button>
          </CardContent>
        </Card>

        {/* Planting Date */}
        <Card>
          <CardContent className="p-4">
            <Label className="text-sm text-muted-foreground">Planting Date</Label>
            <Input
              type="date"
              className="h-12 mt-2"
              value={plantingDate}
              onChange={(e) => setPlantingDate(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Button
          className="w-full h-14 text-lg"
          onClick={handleSubmit}
          disabled={!isValid || submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            `Create Batch (${totalUnits.toLocaleString()} plants)`
          )}
        </Button>
      </div>

      {/* Variety Selector Dialog */}
      <SelectorDialog
        open={showVarietySelector}
        onOpenChange={setShowVarietySelector}
        title="Select Variety"
        searchPlaceholder="Search varieties..."
        searchValue={varietySearch}
        onSearchChange={setVarietySearch}
        items={filteredVarieties}
        selectedId={varietyId}
        onSelect={(id) => {
          setVarietyId(id);
          setShowVarietySelector(false);
        }}
        renderItem={(item: Variety) => (
          <div>
            <div className="font-medium">{item.name}</div>
            {item.family && (
              <div className="text-xs text-muted-foreground">{item.family}</div>
            )}
          </div>
        )}
      />

      {/* Size Selector Dialog */}
      <SelectorDialog
        open={showSizeSelector}
        onOpenChange={setShowSizeSelector}
        title="Select Size"
        searchPlaceholder="Search sizes..."
        searchValue={sizeSearch}
        onSearchChange={setSizeSearch}
        items={filteredSizes}
        selectedId={sizeId}
        onSelect={(id) => {
          setSizeId(id);
          setShowSizeSelector(false);
        }}
        renderItem={(item: Size) => (
          <div>
            <div className="font-medium">{item.name}</div>
            {item.cell_multiple > 1 && (
              <div className="text-xs text-muted-foreground">
                {item.cell_multiple} cells
              </div>
            )}
          </div>
        )}
      />

      {/* Location Selector Dialog */}
      <SelectorDialog
        open={showLocationSelector}
        onOpenChange={setShowLocationSelector}
        title="Select Location"
        searchPlaceholder="Search locations..."
        searchValue={locationSearch}
        onSearchChange={setLocationSearch}
        items={filteredLocations}
        selectedId={locationId}
        onSelect={(id) => {
          setLocationId(id);
          setShowLocationSelector(false);
        }}
        renderItem={(item: Location) => (
          <div className="font-medium">{item.name}</div>
        )}
      />

      {/* Success Dialog */}
      <Dialog open={!!successData} onOpenChange={(open) => !open && setSuccessData(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <DialogTitle className="text-center text-xl">
              Batch Created!
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-center space-y-3">
                <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-left">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Batch:</span>
                    <span className="font-mono font-medium">
                      {successData?.batchNumber}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Variety:</span>
                    <span className="font-medium">{successData?.varietyName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Plants:</span>
                    <span className="font-medium text-green-600">
                      {successData?.quantity.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-4">
            <Button
              variant="outline"
              className="w-full h-12"
              onClick={() => setSuccessData(null)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Another
            </Button>
            <Button
              className="w-full h-12"
              onClick={() => {
                if (successData?.batchId) {
                  router.push(`/worker/batches/${successData.batchId}`);
                }
              }}
            >
              <Eye className="h-4 w-4 mr-2" />
              View Batch
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Header component
function Header({
  onBack,
  title,
}: {
  onBack: () => void;
  title: string;
}) {
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
        <h1 className="font-semibold">{title}</h1>
        <div className="w-[72px]" /> {/* Spacer for centering */}
      </div>
    </div>
  );
}

// Generic selector dialog component
interface SelectorDialogProps<T extends { id: string }> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  items: T[];
  selectedId: string;
  onSelect: (id: string) => void;
  renderItem: (item: T) => React.ReactNode;
}

function SelectorDialog<T extends { id: string }>({
  open,
  onOpenChange,
  title,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  items,
  selectedId,
  onSelect,
  renderItem,
}: SelectorDialogProps<T>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            className="pl-9 h-12"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto border rounded-lg min-h-[200px]">
          {items.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No items found
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "w-full px-4 py-3 text-left transition-colors",
                  "border-b last:border-b-0",
                  "focus:outline-none focus:bg-accent",
                  selectedId === item.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-accent"
                )}
                onClick={() => {
                  vibrateTap();
                  onSelect(item.id);
                }}
              >
                {renderItem(item)}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
