// src/components/BatchLabelPreview.tsx
"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogDescriptionHidden } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import LabelPreview from "./LabelPreview";
import { useToast } from "@/hooks/use-toast";
import { Printer, Settings2, Loader2, CheckCircle2, AlertCircle, Plus, Minus, Edit3, ExternalLink } from "lucide-react";
import Link from "next/link";

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

type LabelTemplate = {
  id: string;
  name: string;
  description?: string;
  label_type: string;
  width_mm: number;
  height_mm: number;
  margin_mm: number;
  is_default: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  batch: {
    id: string;
    batchNumber: string;
    plantVariety: string;
    plantFamily: string;
    size: string;
    location?: string;
    initialQuantity: number;
    quantity: number;
  };
};

export default function BatchLabelPreview({ open, onOpenChange, batch }: Props) {
  const { toast } = useToast();
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [copies, setCopies] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [activeTab, setActiveTab] = useState("print");

  // Fetch printers and templates when dialog opens
  useEffect(() => {
    if (open) {
      fetchPrinters();
      fetchTemplates();
    }
  }, [open]);

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
      // Silently fail - printers will show empty state
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/label-templates?type=batch");
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
    } catch {
      // Silently fail - will use default template
    }
  };

  const printToZebra = async () => {
    if (!selectedPrinter && printers.length > 0) {
      toast({
        variant: "destructive",
        title: "No Printer Selected",
        description: "Please select a printer before printing.",
      });
      return;
    }

    setIsPrinting(true);
    try {
      const res = await fetch(`/api/labels/print`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          batchNumber: batch.batchNumber,
          variety: batch.plantVariety,
          family: batch.plantFamily,
          quantity: batch.initialQuantity,
          size: batch.size,
          location: batch.location,
          payload: `ht:batch:${batch.batchNumber}`,
          printerId: selectedPrinter || undefined,
          templateId: selectedTemplate || undefined,
          copies,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || res.statusText);
      }
      
      toast({
        title: "Print Job Sent",
        description: copies > 1 
          ? `${copies} labels have been sent to the printer.`
          : "The label has been sent to the printer.",
      });
      onOpenChange(false);

    } catch (e: any) {
       toast({
        variant: "destructive",
        title: "Print Failed",
        description: e.message || "Could not connect to the printer.",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const selectedTemplateData = templates.find(t => t.id === selectedTemplate);
  const selectedPrinterData = printers.find(p => p.id === selectedPrinter);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Print Label • Batch #{batch.batchNumber}
          </DialogTitle>
          <DialogDescriptionHidden>Preview and print label for batch</DialogDescriptionHidden>
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
            <div className="flex justify-center items-center py-4 bg-muted/30 rounded-lg min-h-[180px]">
              <div 
                className="origin-top-left"
                style={{ 
                  transform: 'scale(0.85)', 
                  width: '70mm',
                  height: '50mm',
                  marginRight: 'calc(-70mm * 0.15)',
                  marginBottom: 'calc(-50mm * 0.15)',
                }}
              >
                <LabelPreview 
                  batchNumber={batch.batchNumber}
                  variety={batch.plantVariety}
                  family={batch.plantFamily}
                  quantity={batch.initialQuantity}
                  size={batch.size}
                  location={batch.location}
                  dataMatrixPayload={`ht:batch:${batch.batchNumber}`}
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
                    {selectedPrinterData.type} • {selectedPrinterData.connection_type === "agent"
                      ? "USB via Agent"
                      : `${selectedPrinterData.host}:${selectedPrinterData.port}`}
                  </p>
                )}
              </div>

              {/* Template Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="template" className="text-sm font-medium">
                    Label Template
                  </Label>
                  <Link
                    href={selectedTemplate ? `/settings/labels/editor?id=${selectedTemplate}` : "/settings/labels/editor"}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                    target="_blank"
                  >
                    <Edit3 className="h-3 w-3" />
                    Edit Layout
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
                {templates.length > 0 ? (
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger id="template">
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex items-center gap-2">
                            <span>{template.name}</span>
                            <span className="text-muted-foreground text-xs">
                              ({template.width_mm}×{template.height_mm}mm)
                            </span>
                            {template.is_default && (
                              <Badge variant="secondary" className="text-xs">Default</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">Using default 70×50mm template</p>
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

// Types for print agents
type PrintAgent = {
  id: string;
  name: string;
  status: "online" | "offline";
};

// Printer Settings Component with full add printer dialog
function PrinterSettings({
  printers,
  onRefresh
}: {
  printers: Printer[];
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [agents, setAgents] = useState<PrintAgent[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    type: "zebra",
    connection_type: "network",
    host: "",
    port: "9100",
    dpi: "203",
    is_default: false,
    agent_id: "",
    usb_device_name: "",
  });

  // Fetch agents when dialog opens
  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/print-agents");
      const json = await res.json();
      if (json.data) {
        setAgents(json.data);
      }
    } catch {
      // Silently fail - agents will show empty
    }
  };

  const handleOpenAddDialog = () => {
    setFormData({
      name: "",
      type: "zebra",
      connection_type: "network",
      host: "",
      port: "9100",
      dpi: "203",
      is_default: false,
      agent_id: "",
      usb_device_name: "",
    });
    fetchAgents();
    setAddDialogOpen(true);
  };

  const handleAddPrinter = async () => {
    if (!formData.name) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please enter a name for the printer.",
      });
      return;
    }

    if (formData.connection_type === "network" && !formData.host) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please enter an IP address for the printer.",
      });
      return;
    }

    if (formData.connection_type === "agent" && !formData.agent_id) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please select a print agent.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: formData.name,
        type: formData.type,
        connection_type: formData.connection_type,
        dpi: parseInt(formData.dpi) || 203,
        is_default: formData.is_default,
      };

      if (formData.connection_type === "network") {
        payload.host = formData.host;
        payload.port = parseInt(formData.port) || 9100;
      } else if (formData.connection_type === "agent") {
        payload.agent_id = formData.agent_id;
        payload.usb_device_name = formData.usb_device_name || null;
      }

      const res = await fetch("/api/printers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const j = await res.json();
        throw new Error(j?.error || "Failed to add printer");
      }

      toast({
        title: "Printer Added",
        description: `${formData.name} has been added successfully.`,
      });

      setAddDialogOpen(false);
      onRefresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to add printer";
      toast({
        variant: "destructive",
        title: "Failed to Add Printer",
        description: message,
      });
    } finally {
      setIsSaving(false);
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

      toast({
        title: "Test Successful",
        description: "A test label has been sent to the printer.",
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not connect to the printer.";
      toast({
        variant: "destructive",
        title: "Test Failed",
        description: message,
      });
    } finally {
      setIsTesting(null);
    }
  };

  const handleSetDefault = async (printerId: string) => {
    try {
      const res = await fetch(`/api/printers/${printerId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ is_default: true }),
      });

      if (!res.ok) {
        throw new Error("Failed to update printer");
      }

      onRefresh();
      toast({
        title: "Default Updated",
        description: "Default printer has been changed.",
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to update printer";
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: message,
      });
    }
  };

  const handleDeletePrinter = async (printerId: string, printerName: string) => {
    if (!confirm(`Are you sure you want to delete "${printerName}"?`)) return;

    try {
      const res = await fetch(`/api/printers/${printerId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete printer");
      }

      onRefresh();
      toast({
        title: "Printer Deleted",
        description: `${printerName} has been removed.`,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to delete printer";
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: message,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Configured Printers</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpenAddDialog}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Printer
        </Button>
      </div>

      {/* Add Printer Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Printer</DialogTitle>
            <DialogDescription>Configure a thermal label printer</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Printer Name</Label>
                <Input
                  placeholder="e.g., Tunnel 1 Zebra"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Printer Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zebra">Zebra</SelectItem>
                    <SelectItem value="toshiba">Toshiba</SelectItem>
                    <SelectItem value="dymo">Dymo</SelectItem>
                    <SelectItem value="brother">Brother</SelectItem>
                    <SelectItem value="generic">Generic ZPL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Connection Type</Label>
              <Select
                value={formData.connection_type}
                onValueChange={(v) => setFormData({ ...formData, connection_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="network">Network (TCP/IP)</SelectItem>
                  <SelectItem value="agent">USB via Print Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.connection_type === "network" && (
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">IP Address</Label>
                  <Input
                    placeholder="192.168.1.100"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Port</Label>
                  <Input
                    placeholder="9100"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                  />
                </div>
              </div>
            )}

            {formData.connection_type === "agent" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Print Agent</Label>
                  <Select
                    value={formData.agent_id}
                    onValueChange={(v) => setFormData({ ...formData, agent_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an agent..." />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          No agents configured. Add one in Settings.
                        </div>
                      ) : (
                        agents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            <div className="flex items-center gap-2">
                              {agent.name}
                              <Badge
                                variant={agent.status === "online" ? "default" : "secondary"}
                                className="text-xs px-1.5 py-0"
                              >
                                {agent.status}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">USB Printer Name (Optional)</Label>
                  <Input
                    placeholder="e.g., Zebra ZD420"
                    value={formData.usb_device_name}
                    onChange={(e) => setFormData({ ...formData, usb_device_name: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the printer name as it appears on the workstation.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Printer DPI</Label>
              <Select
                value={formData.dpi}
                onValueChange={(v) => setFormData({ ...formData, dpi: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="203">203 DPI (Standard)</SelectItem>
                  <SelectItem value="300">300 DPI (High)</SelectItem>
                  <SelectItem value="600">600 DPI (Ultra High)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_default_quick"
                checked={formData.is_default}
                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="is_default_quick" className="text-xs cursor-pointer">
                Set as default printer
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleAddPrinter} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Printer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                    {printer.type} • {printer.connection_type === "agent" ? "USB via Agent" : `${printer.host}:${printer.port}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
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
                {!printer.is_default && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetDefault(printer.id)}
                  >
                    Set Default
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDeletePrinter(printer.id, printer.name)}
                >
                  Delete
                </Button>
              </div>
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
