"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ShoppingCart,
  Plus,
  Minus,
  Check,
  Loader2,
  Package,
  Camera,
  Hash,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { vibrateTap, vibrateSuccess } from "@/lib/haptics";
import { useAttributeOptions } from "@/hooks/useAttributeOptions";
import ScannerClient from "@/components/Scanner/ScannerClient";
import { SaleLabelPrintSheet, type SaleLabelItem } from "./SaleLabelPrintSheet";

interface PickingTrolleyStepProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  customerName: string;
  totalUnits: number;
  onComplete: (trolleyInfo: TrolleyInfo) => Promise<void>;
  isSubmitting: boolean;
  /** Optional: items for sale label printing */
  labelItems?: SaleLabelItem[];
}

export interface TrolleyInfo {
  trolleyNumber?: string;
  trolleyType?: string;
  trolleyCounts?: Record<string, number>;
  shelves?: number;
}

// Default trolley types if attribute options not loaded
const DEFAULT_TROLLEY_TYPES = [
  { systemCode: "tag6", displayLabel: "Tag 6 (Yellow)" },
  { systemCode: "dc", displayLabel: "DC (No Tag)" },
  { systemCode: "danish", displayLabel: "Danish Trolley" },
  { systemCode: "dutch", displayLabel: "Dutch Trolley" },
  { systemCode: "half_trolley", displayLabel: "Half Trolley" },
  { systemCode: "pallet", displayLabel: "Pallet" },
];

export function PickingTrolleyStep({
  open,
  onOpenChange,
  orderNumber,
  customerName,
  totalUnits,
  onComplete,
  isSubmitting,
  labelItems,
}: PickingTrolleyStepProps) {
  const [trolleyNumber, setTrolleyNumber] = useState("");
  const [trolleyCounts, setTrolleyCounts] = useState<Record<string, number>>({});
  const [shelves, setShelves] = useState(1);
  const [showScanner, setShowScanner] = useState(false);
  const [showLabelPrint, setShowLabelPrint] = useState(false);
  const [labelsPrinted, setLabelsPrinted] = useState(false);

  // Load trolley types from attribute options
  const { options: trolleyTypeOptions, loading: loadingOptions } = useAttributeOptions("trolley_type");

  // Use attribute options if available, otherwise use defaults
  const trolleyTypes = trolleyTypeOptions.length > 0
    ? trolleyTypeOptions.filter((o) => o.isActive)
    : DEFAULT_TROLLEY_TYPES;

  // Initialize trolley counts
  useEffect(() => {
    if (open && Object.keys(trolleyCounts).length === 0) {
      const initialCounts: Record<string, number> = {};
      trolleyTypes.forEach((type) => {
        initialCounts[type.systemCode] = 0;
      });
      // Default to 1 Tag 6
      if (initialCounts["tag6"] !== undefined) {
        initialCounts["tag6"] = 1;
      } else if (trolleyTypes.length > 0) {
        initialCounts[trolleyTypes[0].systemCode] = 1;
      }
      setTrolleyCounts(initialCounts);
    }
  }, [open, trolleyTypes, trolleyCounts]);

  // Calculate total trolleys
  const totalTrolleys = Object.values(trolleyCounts).reduce((sum, count) => sum + count, 0);

  // Get primary trolley type (the one with highest count)
  const primaryTrolleyType = Object.entries(trolleyCounts)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  const handleTrolleyCountChange = (typeCode: string, delta: number) => {
    vibrateTap();
    setTrolleyCounts((prev) => ({
      ...prev,
      [typeCode]: Math.max(0, (prev[typeCode] || 0) + delta),
    }));
  };

  const handleScan = (scannedText: string) => {
    vibrateTap();
    // Parse trolley code - expected format: ht:trolley:T-XXX or just T-XXX
    let trolleyNum = scannedText;
    if (scannedText.startsWith("ht:trolley:")) {
      trolleyNum = scannedText.slice(11);
    } else if (scannedText.startsWith("TROLLEY:")) {
      trolleyNum = scannedText.slice(8);
    }
    setTrolleyNumber(trolleyNum);
    setShowScanner(false);
    vibrateSuccess();
  };

  const handleComplete = async () => {
    vibrateTap();
    await onComplete({
      trolleyNumber: trolleyNumber || undefined,
      trolleyType: primaryTrolleyType,
      trolleyCounts,
      shelves,
    });
  };

  const canComplete = totalTrolleys > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <SheetTitle className="text-left flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Assign Trolley
          </SheetTitle>
          <div className="text-sm text-muted-foreground">
            <span>Order #{orderNumber}</span>
            {customerName && <span> - {customerName}</span>}
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Order Summary */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-5 w-5" />
                <span>Total units</span>
              </div>
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {totalUnits}
              </Badge>
            </div>
          </Card>

          {/* Trolley Number (Optional) */}
          <Card className="p-4 space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Trolley Number (Optional)
            </Label>
            <div className="flex gap-2">
              <Input
                value={trolleyNumber}
                onChange={(e) => setTrolleyNumber(e.target.value.toUpperCase())}
                placeholder="e.g., T-122"
                className="flex-1 h-12 text-lg font-mono"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12"
                onClick={() => setShowScanner(true)}
              >
                <Camera className="h-5 w-5" />
              </Button>
            </div>
          </Card>

          {/* Scanner */}
          {showScanner && (
            <Card className="p-4">
              <ScannerClient onDecoded={handleScan} />
              <Button
                variant="outline"
                className="w-full mt-3"
                onClick={() => setShowScanner(false)}
              >
                Cancel Scan
              </Button>
            </Card>
          )}

          {/* Trolley Types */}
          <Card className="p-4 space-y-4">
            <Label className="text-sm font-medium flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Trolley Type
            </Label>
            {loadingOptions ? (
              <div className="py-4 text-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              </div>
            ) : (
              <div className="space-y-3">
                {trolleyTypes.map((type) => {
                  const count = trolleyCounts[type.systemCode] || 0;
                  const isSelected = count > 0;

                  return (
                    <div
                      key={type.systemCode}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border transition-colors",
                        isSelected && "border-primary bg-primary/5"
                      )}
                    >
                      <span className={cn(
                        "font-medium",
                        isSelected && "text-primary"
                      )}>
                        {type.displayLabel}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10"
                          onClick={() => handleTrolleyCountChange(type.systemCode, -1)}
                          disabled={count <= 0}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-10 text-center text-lg font-semibold">
                          {count}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10"
                          onClick={() => handleTrolleyCountChange(type.systemCode, 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Shelves Used */}
          <Card className="p-4 space-y-3">
            <Label className="text-sm font-medium">Shelves Used</Label>
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12"
                onClick={() => {
                  vibrateTap();
                  setShelves((s) => Math.max(1, s - 1));
                }}
                disabled={shelves <= 1}
              >
                <Minus className="h-5 w-5" />
              </Button>
              <span className="text-3xl font-bold w-16 text-center">{shelves}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12"
                onClick={() => {
                  vibrateTap();
                  setShelves((s) => s + 1);
                }}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
          </Card>

          {/* Print Labels Option */}
          {labelItems && labelItems.length > 0 && (
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Price Labels</span>
                </div>
                {labelsPrinted && (
                  <Badge variant="outline" className="text-green-600 border-green-300">
                    <Check className="h-3 w-3 mr-1" />
                    Printed
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Print price labels for {labelItems.length} item{labelItems.length !== 1 ? "s" : ""} before staging
              </p>
              <Button
                variant={labelsPrinted ? "outline" : "secondary"}
                className="w-full h-12 gap-2"
                onClick={() => {
                  vibrateTap();
                  setShowLabelPrint(true);
                }}
              >
                <Tag className="h-4 w-4" />
                {labelsPrinted ? "Reprint Labels" : "Print Labels"}
              </Button>
            </Card>
          )}

          {/* Ready Summary */}
          {canComplete && (
            <Card className="p-4 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold text-green-700 dark:text-green-300">
                  Ready to stage!
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  {totalUnits} units on {totalTrolleys} trolley{totalTrolleys !== 1 ? "s" : ""}
                  {trolleyNumber && ` (${trolleyNumber})`}
                </p>
              </div>
            </Card>
          )}
        </div>

        {/* Bottom Action */}
        <div
          className="border-t p-4 shrink-0 bg-background"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <Button
            size="lg"
            className="w-full h-14 text-lg gap-2 bg-green-600 hover:bg-green-700"
            onClick={handleComplete}
            disabled={!canComplete || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Check className="h-5 w-5" />
            )}
            FINISH & STAGE TROLLEY
          </Button>
        </div>

        {/* Sale Label Print Sheet */}
        {labelItems && labelItems.length > 0 && (
          <SaleLabelPrintSheet
            open={showLabelPrint}
            onOpenChange={setShowLabelPrint}
            orderNumber={orderNumber}
            customerName={customerName}
            items={labelItems}
            onComplete={() => setLabelsPrinted(true)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
