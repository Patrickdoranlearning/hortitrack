"use client";

import { useState, useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Printer,
  Plus,
  Minus,
  Check,
  Loader2,
  AlertTriangle,
  Package,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { vibrateTap, vibrateSuccess, vibrateWarning } from "@/lib/haptics";
import bwipjs from "bwip-js";

interface PrinterType {
  id: string;
  name: string;
  type: string;
  connection_type: string;
  host?: string;
  port?: number;
  is_default: boolean;
  dpi: number;
}

interface LabelTemplate {
  id: string;
  name: string;
  description?: string;
  label_type: string;
  width_mm: number;
  height_mm: number;
  margin_mm: number;
  is_default: boolean;
}

export interface SaleLabelItem {
  productName: string;
  size: string;
  price: number;
  quantity: number;
  batchNumber?: string;
}

interface SaleLabelPrintSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  customerName: string;
  items: SaleLabelItem[];
  onComplete?: () => void;
}

/**
 * Mobile-optimized sale label printing sheet for worker picking flow.
 * Allows workers to print price labels for picked items before staging.
 */
export function SaleLabelPrintSheet({
  open,
  onOpenChange,
  orderNumber,
  customerName,
  items,
  onComplete,
}: SaleLabelPrintSheetProps) {
  const [printers, setPrinters] = useState<PrinterType[]>([]);
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [itemQuantities, setItemQuantities] = useState<Record<number, number>>({});
  const [isPrinting, setIsPrinting] = useState(false);
  const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printComplete, setPrintComplete] = useState(false);

  // Initialize quantities based on items
  useEffect(() => {
    if (open) {
      const initialQtys: Record<number, number> = {};
      items.forEach((item, index) => {
        initialQtys[index] = item.quantity;
      });
      setItemQuantities(initialQtys);
      setPrintComplete(false);
      setError(null);
    }
  }, [open, items]);

  // Fetch printers and templates when sheet opens
  useEffect(() => {
    if (open) {
      fetchPrinters();
      fetchTemplates();
    }
  }, [open]);

  const fetchPrinters = async () => {
    setIsLoadingPrinters(true);
    try {
      const res = await fetch("/api/printers");
      const json = await res.json();
      if (json.data) {
        setPrinters(json.data);
        // Select default printer
        const defaultPrinter = json.data.find((p: PrinterType) => p.is_default);
        if (defaultPrinter) {
          setSelectedPrinter(defaultPrinter.id);
        } else if (json.data.length > 0) {
          setSelectedPrinter(json.data[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to fetch printers:", e);
    } finally {
      setIsLoadingPrinters(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/label-templates?type=sale");
      const json = await res.json();
      if (json.data) {
        setTemplates(json.data);
        // Select default template
        const defaultTemplate = json.data.find((t: LabelTemplate) => t.is_default);
        if (defaultTemplate) {
          setSelectedTemplate(defaultTemplate.id);
        } else if (json.data.length > 0) {
          setSelectedTemplate(json.data[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to fetch templates:", e);
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    vibrateTap();
    setItemQuantities((prev) => ({
      ...prev,
      [index]: Math.max(0, (prev[index] || 0) + delta),
    }));
  };

  const getTotalLabels = () => {
    return Object.values(itemQuantities).reduce((sum, qty) => sum + qty, 0);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const handlePrint = async () => {
    if (!selectedPrinter && printers.length > 0) {
      setError("Please select a printer");
      vibrateWarning();
      return;
    }

    setIsPrinting(true);
    setError(null);
    vibrateTap();

    try {
      // Print labels for each item with quantity > 0
      const printPromises = items
        .map((item, index) => {
          const qty = itemQuantities[index] || 0;
          if (qty <= 0) return null;

          const barcode = `PLU:${item.productName}|${item.size}`.slice(0, 40);

          return fetch("/api/labels/print-sale", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productTitle: item.productName,
              size: item.size,
              priceText: formatPrice(item.price),
              barcode,
              symbology: "code128",
              lotNumber: item.batchNumber,
              printerId: selectedPrinter || undefined,
              templateId: selectedTemplate || undefined,
              copies: qty,
            }),
          });
        })
        .filter(Boolean);

      if (printPromises.length === 0) {
        setError("No labels to print");
        vibrateWarning();
        setIsPrinting(false);
        return;
      }

      const results = await Promise.all(printPromises);
      const failures = results.filter((r) => r && !r.ok);

      if (failures.length > 0) {
        setError(`${failures.length} label(s) failed to print`);
        vibrateWarning();
      } else {
        vibrateSuccess();
        setPrintComplete(true);
      }
    } catch (e) {
      console.error("Print error:", e);
      setError("Failed to print labels");
      vibrateWarning();
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDone = () => {
    vibrateTap();
    onOpenChange(false);
    onComplete?.();
  };

  const selectedTemplateData = templates.find((t) => t.id === selectedTemplate);
  const totalLabels = getTotalLabels();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <SheetTitle className="text-left flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Print Price Labels
          </SheetTitle>
          <div className="text-sm text-muted-foreground">
            <span>Order #{orderNumber}</span>
            {customerName && <span> - {customerName}</span>}
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => setError(null)}
              >
                Dismiss
              </Button>
            </div>
          )}

          {/* Print Complete Message */}
          {printComplete && (
            <Card className="p-4 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-semibold text-green-700 dark:text-green-300">
                    Labels Sent to Printer
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {totalLabels} label{totalLabels !== 1 ? "s" : ""} queued
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Printer Selection */}
          <Card className="p-4 space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Printer className="h-4 w-4" />
              Printer
            </Label>
            {isLoadingPrinters ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : printers.length > 0 ? (
              <Select value={selectedPrinter} onValueChange={setSelectedPrinter}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select a printer" />
                </SelectTrigger>
                <SelectContent>
                  {printers.map((printer) => (
                    <SelectItem key={printer.id} value={printer.id}>
                      <div className="flex items-center gap-2">
                        <span>{printer.name}</span>
                        {printer.is_default && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="text-sm">No printers configured</span>
              </div>
            )}

            {/* Template Selection */}
            {templates.length > 0 && (
              <div className="space-y-2 pt-2">
                <Label className="text-sm text-muted-foreground">Label Size</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select label size" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <span>
                          {template.name} ({template.width_mm}x{template.height_mm}mm)
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </Card>

          {/* Items to Print */}
          <Card className="p-4 space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Items ({items.length})
            </Label>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={index}
                  className={cn(
                    "p-3 rounded-lg border transition-colors",
                    (itemQuantities[index] || 0) > 0 && "border-primary bg-primary/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.productName}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                        <span>{item.size}</span>
                        <span className="font-semibold text-foreground">
                          {formatPrice(item.price)}
                        </span>
                      </div>
                      {item.batchNumber && (
                        <Badge variant="outline" className="mt-1 text-xs font-mono">
                          {item.batchNumber}
                        </Badge>
                      )}
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-12 w-12"
                        onClick={() => updateQuantity(index, -1)}
                        disabled={isPrinting || (itemQuantities[index] || 0) <= 0}
                      >
                        <Minus className="h-5 w-5" />
                      </Button>
                      <span className="w-12 text-center text-lg font-semibold tabular-nums">
                        {itemQuantities[index] || 0}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-12 w-12"
                        onClick={() => updateQuantity(index, 1)}
                        disabled={isPrinting}
                      >
                        <Plus className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Preview */}
          {selectedTemplateData && totalLabels > 0 && (
            <Card className="p-4">
              <Label className="text-sm font-medium mb-3 block">Preview</Label>
              <div className="flex justify-center">
                <SaleLabelPreviewMini
                  productTitle={items[0]?.productName || ""}
                  size={items[0]?.size || ""}
                  priceText={formatPrice(items[0]?.price || 0)}
                  widthMm={selectedTemplateData.width_mm}
                  heightMm={selectedTemplateData.height_mm}
                />
              </div>
              <p className="text-xs text-center text-muted-foreground mt-2">
                First item preview (scale: 75%)
              </p>
            </Card>
          )}
        </div>

        {/* Bottom Action */}
        <div
          className="border-t p-4 shrink-0 bg-background space-y-3"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          {/* Summary */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Total labels: <span className="font-semibold text-foreground">{totalLabels}</span>
            </span>
            {printComplete && (
              <Badge variant="outline" className="text-green-600 border-green-300">
                Printed
              </Badge>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {!printComplete ? (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 h-14"
                  onClick={() => onOpenChange(false)}
                  disabled={isPrinting}
                >
                  Skip
                </Button>
                <Button
                  size="lg"
                  className="flex-1 h-14 gap-2"
                  onClick={handlePrint}
                  disabled={isPrinting || totalLabels === 0 || (printers.length > 0 && !selectedPrinter)}
                >
                  {isPrinting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Printing...
                    </>
                  ) : (
                    <>
                      <Printer className="h-5 w-5" />
                      Print ({totalLabels})
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button
                size="lg"
                className="w-full h-14 gap-2 bg-green-600 hover:bg-green-700"
                onClick={handleDone}
              >
                <Check className="h-5 w-5" />
                Done
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Mini label preview component for mobile display
 */
function SaleLabelPreviewMini({
  productTitle,
  size,
  priceText,
  widthMm = 70,
  heightMm = 50,
}: {
  productTitle: string;
  size: string;
  priceText: string;
  widthMm?: number;
  heightMm?: number;
}) {
  const barcodeRef = useRef<HTMLCanvasElement | null>(null);
  const barcode = `PLU:${productTitle}|${size}`.slice(0, 40);
  const isCompact = widthMm <= 45 && heightMm <= 45;

  useEffect(() => {
    if (!barcodeRef.current || !barcode) return;
    try {
      bwipjs.toCanvas(barcodeRef.current, {
        bcid: "code128",
        text: barcode,
        scale: 1.5,
        height: 6,
        includetext: false,
      });
    } catch (e) {
      console.error("Barcode render failed:", e);
    }
  }, [barcode]);

  return (
    <div
      style={{
        width: `${widthMm * 2}px`,
        height: `${heightMm * 2}px`,
        boxSizing: "border-box",
        padding: "6px",
        background: "white",
        border: "1px solid rgba(0,0,0,.15)",
        borderRadius: 4,
        boxShadow: "0 2px 8px rgba(0,0,0,.1)",
        fontFamily: "Inter, system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        transform: "scale(0.75)",
        transformOrigin: "center",
      }}
    >
      {/* Product title */}
      <div
        style={{
          fontWeight: 600,
          fontSize: isCompact ? "8px" : "10px",
          lineHeight: 1.2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          marginBottom: "2px",
        }}
      >
        {productTitle}
      </div>

      {/* Size */}
      {!isCompact && (
        <div
          style={{
            fontSize: "8px",
            lineHeight: 1.2,
            opacity: 0.7,
            marginBottom: "4px",
          }}
        >
          {size}
        </div>
      )}

      {/* Price */}
      <div
        style={{
          fontWeight: 700,
          fontSize: isCompact ? "12px" : "14px",
          lineHeight: 1,
          color: "#1a1a1a",
          flexGrow: 1,
          display: "flex",
          alignItems: "center",
        }}
      >
        {priceText}
      </div>

      {/* Barcode */}
      <div style={{ flexShrink: 0 }}>
        <canvas
          ref={barcodeRef}
          style={{ maxWidth: "100%", height: "auto" }}
        />
      </div>
    </div>
  );
}

export default SaleLabelPrintSheet;
