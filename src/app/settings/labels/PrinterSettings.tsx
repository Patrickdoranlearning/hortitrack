"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Printer,
  Loader2,
  Trash2,
  Star,
  CheckCircle2,
  XCircle,
  Settings2,
  Wifi,
} from "lucide-react";

type PrinterType = {
  id: string;
  name: string;
  type: string;
  connection_type: string;
  host?: string;
  port?: number;
  is_default: boolean;
  is_active: boolean;
  dpi: number;
  created_at: string;
};

export default function PrinterSettings() {
  const { toast } = useToast();
  const [printers, setPrinters] = useState<PrinterType[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterType | null>(null);
  const [testingPrinter, setTestingPrinter] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [printerToDelete, setPrinterToDelete] = useState<PrinterType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    type: "zebra",
    host: "",
    port: "9100",
    dpi: "203",
    is_default: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  const fetchPrinters = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/printers");
      const json = await res.json();
      if (json.data) {
        setPrinters(json.data);
      }
    } catch (e) {
      console.error("Failed to fetch printers:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load printers",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPrinters();
  }, [fetchPrinters]);

  const handleOpenAdd = () => {
    setEditingPrinter(null);
    setFormData({
      name: "",
      type: "zebra",
      host: "",
      port: "9100",
      dpi: "203",
      is_default: false,
    });
    setAddDialogOpen(true);
  };

  const handleOpenEdit = (printer: PrinterType) => {
    setEditingPrinter(printer);
    setFormData({
      name: printer.name,
      type: printer.type,
      host: printer.host || "",
      port: String(printer.port || 9100),
      dpi: String(printer.dpi || 203),
      is_default: printer.is_default,
    });
    setAddDialogOpen(true);
  };

  const handleSavePrinter = async () => {
    if (!formData.name || !formData.host) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Name and IP address are required",
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        type: formData.type,
        connection_type: "network",
        host: formData.host,
        port: parseInt(formData.port) || 9100,
        dpi: parseInt(formData.dpi) || 203,
        is_default: formData.is_default,
      };

      const url = editingPrinter
        ? `/api/printers/${editingPrinter.id}`
        : "/api/printers";
      const method = editingPrinter ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error || "Failed to save printer");
      }

      toast({
        title: editingPrinter ? "Printer Updated" : "Printer Added",
        description: `"${formData.name}" has been saved`,
      });
      setAddDialogOpen(false);
      fetchPrinters();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestPrinter = async (printerId: string) => {
    setTestingPrinter(printerId);
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
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Test Failed",
        description: e.message || "Could not connect to the printer.",
      });
    } finally {
      setTestingPrinter(null);
    }
  };

  const handleSetDefault = async (printer: PrinterType) => {
    try {
      const res = await fetch(`/api/printers/${printer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: true }),
      });

      if (!res.ok) {
        throw new Error("Failed to update printer");
      }

      toast({
        title: "Default Updated",
        description: `"${printer.name}" is now the default printer`,
      });
      fetchPrinters();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message,
      });
    }
  };

  const handleDelete = async () => {
    if (!printerToDelete) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/printers/${printerToDelete.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete printer");
      }

      toast({
        title: "Printer Deleted",
        description: `"${printerToDelete.name}" has been removed`,
      });
      setDeleteDialogOpen(false);
      setPrinterToDelete(null);
      fetchPrinters();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Configured Printers</h3>
          <p className="text-sm text-muted-foreground">
            Manage thermal label printers for your organization
          </p>
        </div>
        <Button onClick={handleOpenAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Printer
        </Button>
      </div>

      {/* Printer List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : printers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Printer className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No printers configured</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Add your first label printer to get started
            </p>
            <Button onClick={handleOpenAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add Printer
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {printers.map((printer) => (
            <Card key={printer.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <Printer className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {printer.name}
                        {printer.is_default && (
                          <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {printer.type} • {printer.dpi} DPI
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Wifi className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-xs">
                    {printer.host}:{printer.port}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestPrinter(printer.id)}
                    disabled={testingPrinter === printer.id}
                  >
                    {testingPrinter === printer.id ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                    )}
                    Test
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(printer)}
                  >
                    <Settings2 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  {!printer.is_default && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetDefault(printer)}
                    >
                      <Star className="h-4 w-4 mr-1" />
                      Default
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      setPrinterToDelete(printer);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Printer Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPrinter ? "Edit Printer" : "Add Printer"}
            </DialogTitle>
            <DialogDescription>
              Configure a network-connected thermal label printer
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Printer Name</Label>
                <Input
                  placeholder="e.g., Sales Floor Zebra"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Printer Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v })}
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

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>IP Address</Label>
                <Input
                  placeholder="192.168.1.100"
                  value={formData.host}
                  onChange={(e) =>
                    setFormData({ ...formData, host: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Port</Label>
                <Input
                  placeholder="9100"
                  value={formData.port}
                  onChange={(e) =>
                    setFormData({ ...formData, port: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Printer DPI</Label>
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
                id="is_default_printer"
                checked={formData.is_default}
                onChange={(e) =>
                  setFormData({ ...formData, is_default: e.target.checked })
                }
                className="rounded"
              />
              <Label htmlFor="is_default_printer" className="cursor-pointer">
                Set as default printer
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSavePrinter} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Printer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Printer</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{printerToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

