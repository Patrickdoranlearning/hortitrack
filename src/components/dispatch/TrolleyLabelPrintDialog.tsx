// src/components/dispatch/TrolleyLabelPrintDialog.tsx
"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescriptionHidden } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import TrolleyLabelPreview from "./TrolleyLabelPreview";
import { toast } from "@/lib/toast";
import { Printer, Settings2, Loader2, AlertCircle, Plus, Minus } from "lucide-react";
import { generateTrolleyLabelCode } from "./trolley-label-utils";

type Printer = {
  id: string;
  name: string;
  type: string;
  connection_type: string;
  host?: string;
  port?: number;
  is_default: boolean;
  dpi: number;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  order: {
    id: string;
    orderNumber: string;
    customerName: string;
    deliveryDate?: string | null;
    trolleysEstimated?: number | null;
  };
  orgId?: string;
};

export default function TrolleyLabelPrintDialog({ open, onOpenChange, order, orgId }: Props) {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>("");
  const [copies, setCopies] = useState<number>(order.trolleysEstimated || 1);
  const [isPrinting, setIsPrinting] = useState(false);
  const [activeTab, setActiveTab] = useState("print");

  // Generate the datamatrix payload
  const dataMatrixPayload = generateTrolleyLabelCode(orgId || 'org', order.id);

  // Format delivery date
  const formattedDate = order.deliveryDate
    ? new Date(order.deliveryDate).toLocaleDateString('en-IE', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : undefined;

  // Fetch printers when dialog opens
  useEffect(() => {
    if (open) {
      fetchPrinters();
      // Reset copies to order's trolley estimate
      setCopies(order.trolleysEstimated || 1);
    }
  }, [open, order.trolleysEstimated]);

  const fetchPrinters = async () => {
    try {
      const res = await fetch("/api/printers");
      const json = await res.json();
      if (json.data) {
        setPrinters(json.data);
        // Select default printer
        const defaultPrinter = json.data.find((p: Printer) => p.is_default);
        if (defaultPrinter) {
          setSelectedPrinter(defaultPrinter.id);
        } else if (json.data.length > 0) {
          setSelectedPrinter(json.data[0].id);
        }
      }
    } catch {
      // Printer fetch failed silently
    }
  };

  const printToZebra = async () => {
    if (!selectedPrinter && printers.length > 0) {
      toast.error("Please select a printer before printing.");
      return;
    }

    setIsPrinting(true);
    try {
      const res = await fetch(`/api/labels/trolley`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          customerName: order.customerName,
          orderNumber: order.orderNumber,
          deliveryDate: order.deliveryDate,
          trolleyNumber: "1",
          printerId: selectedPrinter || undefined,
          copies,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || res.statusText);
      }

      toast.success(copies > 1
          ? `${copies} trolley labels have been sent to the printer.`
          : "The trolley label has been sent to the printer.");
      onOpenChange(false);

    } catch (e: any) {
       toast.error(e.message || "Could not connect to the printer.");
    } finally {
      setIsPrinting(false);
    }
  };

  const selectedPrinterData = printers.find(p => p.id === selectedPrinter);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Print Trolley Label • #{order.orderNumber}
          </DialogTitle>
          <DialogDescriptionHidden>Preview and print trolley label for order</DialogDescriptionHidden>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 min-h-0 flex flex-col">
          <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
            <TabsTrigger value="print" className="flex items-center gap-2">
              <Printer className="h-4 w-4" />
              Print
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="print" className="space-y-4 mt-4 flex-1 overflow-y-auto pr-1">
            {/* Label Preview */}
            <div className="flex justify-center items-center py-4 bg-muted/30 rounded-lg min-h-[200px]">
              <div
                className="origin-top-left"
                style={{
                  transform: 'scale(0.65)',
                  width: '100mm',
                  height: '70mm',
                  marginRight: 'calc(-100mm * 0.35)',
                  marginBottom: 'calc(-70mm * 0.35)',
                }}
              >
                <TrolleyLabelPreview
                  orderNumber={order.orderNumber}
                  customerName={order.customerName}
                  deliveryDate={formattedDate}
                  trolleyNumber="1"
                  totalTrolleys={copies > 1 ? copies : undefined}
                  dataMatrixPayload={dataMatrixPayload}
                />
              </div>
            </div>

            {/* Print Options */}
            <div className="grid gap-4">
              {/* Printer Selection */}
              <div className="space-y-2">
                <Label htmlFor="printer" className="text-sm font-medium">
                  Printer
                </Label>
                {printers.length > 0 ? (
                  <Select value={selectedPrinter} onValueChange={setSelectedPrinter}>
                    <SelectTrigger id="printer">
                      <SelectValue placeholder="Select a printer" />
                    </SelectTrigger>
                    <SelectContent>
                      {printers.map((printer) => (
                        <SelectItem key={printer.id} value={printer.id}>
                          <div className="flex items-center gap-2">
                            <span>{printer.name}</span>
                            {printer.is_default && (
                              <Badge variant="secondary" className="text-xs">Default</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm">
                      No printers configured. Go to Settings tab to add a printer.
                    </span>
                  </div>
                )}
                {selectedPrinterData && (
                  <p className="text-xs text-muted-foreground">
                    {selectedPrinterData.type} • {selectedPrinterData.host}:{selectedPrinterData.port}
                  </p>
                )}
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <Label htmlFor="copies" className="text-sm font-medium">
                  Number of Copies
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setCopies(Math.max(1, copies - 1))}
                    disabled={copies <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    id="copies"
                    type="number"
                    min={1}
                    max={100}
                    value={copies}
                    onChange={(e) => setCopies(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                    className="w-20 text-center"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setCopies(Math.min(100, copies + 1))}
                    disabled={copies >= 100}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground ml-2">
                    {copies === 1 ? "label" : "labels"}
                  </span>
                </div>
                {order.trolleysEstimated && order.trolleysEstimated > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Order has {order.trolleysEstimated} estimated trolley{order.trolleysEstimated !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4 mt-4 flex-1 overflow-y-auto pr-1">
            <PrinterSettings
              printers={printers}
              onRefresh={fetchPrinters}
            />
          </TabsContent>
        </Tabs>

        <Separator className="my-2 flex-shrink-0" />

        <DialogFooter className="gap-2 sm:gap-0 flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={printToZebra}
            disabled={isPrinting || (printers.length > 0 && !selectedPrinter)}
            className="min-w-[100px]"
          >
            {isPrinting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Printing...
              </>
            ) : (
              <>
                <Printer className="mr-2 h-4 w-4" />
                Print {copies > 1 ? `(${copies})` : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Printer Settings Component (simplified version)
function PrinterSettings({
  printers,
  onRefresh
}: {
  printers: Printer[];
  onRefresh: () => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [newPrinter, setNewPrinter] = useState({
    name: "",
    type: "zebra",
    host: "",
    port: "9100",
    is_default: false,
  });

  const handleAddPrinter = async () => {
    if (!newPrinter.name || !newPrinter.host) {
      toast.error("Please enter a name and IP address for the printer.");
      return;
    }

    try {
      const res = await fetch("/api/printers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newPrinter.name,
          type: newPrinter.type,
          connection_type: "network",
          host: newPrinter.host,
          port: parseInt(newPrinter.port) || 9100,
          is_default: newPrinter.is_default,
        }),
      });

      if (!res.ok) {
        const j = await res.json();
        throw new Error(j?.error || "Failed to add printer");
      }

      toast.success(`${newPrinter.name} has been added successfully.`);

      setNewPrinter({ name: "", type: "zebra", host: "", port: "9100", is_default: false });
      setIsAdding(false);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleTestPrinter = async (printerId: string) => {
    setIsTesting(printerId);
    try {
      const res = await fetch(`/api/printers/${printerId}/test`, {
        method: "POST",
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error || "Test failed");
      }

      toast.success("A test label has been sent to the printer.");
    } catch (e: any) {
      toast.error(e.message || "Could not connect to the printer.");
    } finally {
      setIsTesting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Configured Printers</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAdding(!isAdding)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Printer
        </Button>
      </div>

      {/* Add Printer Form */}
      {isAdding && (
        <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Printer Name</Label>
              <Input
                placeholder="e.g., Dispatch Zebra"
                value={newPrinter.name}
                onChange={(e) => setNewPrinter({ ...newPrinter, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Printer Type</Label>
              <Select
                value={newPrinter.type}
                onValueChange={(v) => setNewPrinter({ ...newPrinter, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zebra">Zebra</SelectItem>
                  <SelectItem value="dymo">Dymo</SelectItem>
                  <SelectItem value="brother">Brother</SelectItem>
                  <SelectItem value="generic">Generic ZPL</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">IP Address</Label>
              <Input
                placeholder="192.168.1.100"
                value={newPrinter.host}
                onChange={(e) => setNewPrinter({ ...newPrinter, host: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Port</Label>
              <Input
                placeholder="9100"
                value={newPrinter.port}
                onChange={(e) => setNewPrinter({ ...newPrinter, port: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_default"
              checked={newPrinter.is_default}
              onChange={(e) => setNewPrinter({ ...newPrinter, is_default: e.target.checked })}
              className="rounded"
            />
            <Label htmlFor="is_default" className="text-xs cursor-pointer">
              Set as default printer
            </Label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddPrinter}>
              Add Printer
            </Button>
          </div>
        </div>
      )}

      {/* Printer List */}
      {printers.length > 0 ? (
        <div className="space-y-2">
          {printers.map((printer) => (
            <div
              key={printer.id}
              className="flex items-center justify-between p-3 border rounded-lg bg-background"
            >
              <div className="flex items-center gap-3">
                <Printer className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{printer.name}</span>
                    {printer.is_default && (
                      <Badge variant="secondary" className="text-xs">Default</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {printer.type} • {printer.host}:{printer.port}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleTestPrinter(printer.id)}
                disabled={isTesting === printer.id}
              >
                {isTesting === printer.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Test"
                )}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Printer className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No printers configured yet.</p>
          <p className="text-xs mt-1">Click "Add Printer" to get started.</p>
        </div>
      )}
    </div>
  );
}
