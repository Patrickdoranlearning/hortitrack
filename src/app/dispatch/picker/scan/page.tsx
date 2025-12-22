"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scan, Camera, Keyboard, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DataMatrixScanner } from "@/components/dispatch/picker/DataMatrixScanner";

/**
 * Scan to Pick Page
 * Allows pickers to scan a trolley label (datamatrix) or enter order number manually
 * to open the picking workflow for that order
 */
export default function ScanToPickPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"scan" | "manual">("scan"); // Start with scan mode
  const [orderNumber, setOrderNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the input when in manual mode
    if (mode === "manual" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [mode]);

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
    // Check if it's a valid trolley label code
    // Expected format: HT:orgId:orderId:timestamp
    if (!code.startsWith("HT:")) {
      toast.error("Invalid label code. Please scan a trolley label.");
      return;
    }

    setIsLoading(true);

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
        // Navigate to the picking workflow
        router.push(`/dispatch/picking/${data.pickList.id}/workflow`);
      } else if (data.order?.id) {
        // Look up or create pick list for this order
        const pickResponse = await fetch(`/api/picking?orderId=${data.order.id}`);
        const pickData = await pickResponse.json();

        if (pickData.pickListId) {
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
          {/* Mode Selector */}
          <div className="flex gap-2">
            <Button
              variant={mode === "scan" ? "default" : "outline"}
              className="flex-1 gap-2"
              onClick={() => setMode("scan")}
            >
              <Camera className="h-4 w-4" />
              Scan Label
            </Button>
            <Button
              variant={mode === "manual" ? "default" : "outline"}
              className="flex-1 gap-2"
              onClick={() => setMode("manual")}
            >
              <Keyboard className="h-4 w-4" />
              Enter Manually
            </Button>
          </div>

          {mode === "scan" ? (
            <div className="space-y-4">
              <DataMatrixScanner
                onScan={handleScanResult}
                onError={(error) => toast.error(error)}
              />
              <p className="text-sm text-muted-foreground text-center">
                Point your camera at the DataMatrix code on the trolley label
              </p>
              {isLoading && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Looking up order...
                </div>
              )}
            </div>
          ) : (
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
                <p className="text-xs text-muted-foreground">
                  Enter the order number from the trolley label
                </p>
              </div>

              <Button
                type="submit"
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
                    <Scan className="h-4 w-4" />
                    Find Order
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
