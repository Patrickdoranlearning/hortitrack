"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Scan, Camera, Keyboard, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ScannerClient from "@/components/Scanner/ScannerClient";

/**
 * Scan to Pick Page
 * Allows pickers to scan a trolley label (datamatrix) or enter order number manually
 * to open the picking workflow for that order
 *
 * Uses the same ScannerClient component as the production module for reliable scanning
 */
export default function ScanToPickPage() {
  const router = useRouter();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-open scanner on mount for quick scanning workflow
  useEffect(() => {
    // Small delay to ensure component is mounted
    const timer = setTimeout(() => {
      setScannerOpen(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim()) return;

    setIsLoading(true);

    try {
      // Look up the order by order number
      const response = await fetch(
        `/api/picking?orderNumber=${encodeURIComponent(orderNumber.trim())}`
      );

      if (!response.ok) {
        throw new Error("Order not found");
      }

      const data = await response.json();

      if (!data.pickListId) {
        toast.error("No pick list found for this order");
        return;
      }

      // Navigate to the picking workflow
      router.push(`/dispatch/picking/${data.pickListId}/workflow`);
    } catch (error) {
      console.error("Error looking up order:", error);
      toast.error("Order not found. Please check the order number.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanResult = async (code: string) => {
    if (isLoading) return; // Prevent double-processing

    console.log("[Picker Scan] Received code:", code);

    // Check if it's a valid trolley label code
    // Expected format: HT:orgId:orderId:timestamp
    if (!code.startsWith("HT:")) {
      toast.error("Invalid label code. Please scan a trolley label.");
      return;
    }

    setIsLoading(true);
    setScannerOpen(false);

    try {
      // Use the trolley label API to decode and lookup the order
      const response = await fetch(`/api/labels/trolley?code=${encodeURIComponent(code)}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Label not found");
      }

      const data = await response.json();

      if (!data.ok) {
        toast.error(data.error || "Failed to decode label");
        return;
      }

      // Check if there's a pick list
      if (data.pickList?.id) {
        toast.success("Label scanned", { description: `Order #${data.order?.order_number || ""}` });
        // Navigate to the picking workflow
        router.push(`/dispatch/picking/${data.pickList.id}/workflow`);
      } else if (data.order?.id) {
        // Look up or create pick list for this order
        const pickResponse = await fetch(`/api/picking?orderId=${data.order.id}`);
        const pickData = await pickResponse.json();

        if (pickData.pickListId) {
          toast.success("Label scanned", { description: `Order #${data.order.order_number || ""}` });
          router.push(`/dispatch/picking/${pickData.pickListId}/workflow`);
        } else {
          toast.error("No pick list found for this order");
        }
      } else {
        toast.error("Order not found for this label");
      }
    } catch (error: any) {
      console.error("Error looking up order:", error);
      toast.error(error.message || "Order not found. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto">
      <Button
        variant="ghost"
        className="mb-4 gap-2"
        onClick={() => router.push("/dispatch/picker")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Tasks
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5" />
            Scan to Pick
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Scanner Button */}
          <Button
            size="lg"
            className="w-full h-16 text-lg gap-3"
            onClick={() => setScannerOpen(true)}
            disabled={isLoading}
          >
            <Camera className="h-6 w-6" />
            Scan Trolley Label
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or enter manually
              </span>
            </div>
          </div>

          {/* Manual Entry Form */}
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orderNumber">Order Number</Label>
              <Input
                ref={inputRef}
                id="orderNumber"
                type="text"
                placeholder="e.g., ORD-2024-001"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              variant="secondary"
              className="w-full gap-2"
              disabled={!orderNumber.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Looking up order...
                </>
              ) : (
                <>
                  <Keyboard className="h-4 w-4" />
                  Find Order
                </>
              )}
            </Button>
          </form>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Processing...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scanner Dialog - Uses same ScannerClient as production module */}
      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="sm:max-w-md p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Scan Trolley Label
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-hidden rounded-b-lg p-4">
            <ScannerClient onDecoded={handleScanResult} />
            <p className="text-sm text-muted-foreground text-center mt-4">
              Position the DataMatrix code within the frame
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
