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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Printer,
  Loader2,
  Trash2,
  Star,
  CheckCircle2,
  Settings2,
  Wifi,
  Usb,
  Monitor,
  Copy,
  RefreshCw,
  AlertCircle,
  Download,
} from "lucide-react";

type PrinterType = {
  id: string;
  name: string;
  type: string;
  connection_type: string;
  host?: string;
  port?: number;
  agent_id?: string;
  usb_device_id?: string;
  usb_device_name?: string;
  is_default: boolean;
  is_active: boolean;
  dpi: number;
  created_at: string;
};

type PrintAgent = {
  id: string;
  name: string;
  status: "online" | "offline";
  last_seen_at: string | null;
  workstation_info: {
    hostname?: string;
    platform?: string;
    osVersion?: string;
    agentVersion?: string;
  };
  agent_key_prefix: string;
  created_at: string;
};

export default function PrinterSettings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("printers");

  // Printers state
  const [printers, setPrinters] = useState<PrinterType[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterType | null>(null);
  const [testingPrinter, setTestingPrinter] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [printerToDelete, setPrinterToDelete] = useState<PrinterType | null>(null);
  const [isDeletingPrinter, setIsDeletingPrinter] = useState(false);

  // Agents state
  const [agents, setAgents] = useState<PrintAgent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [addAgentDialogOpen, setAddAgentDialogOpen] = useState(false);
  const [newAgentKey, setNewAgentKey] = useState<string | null>(null);
  const [regenerateKeyDialogOpen, setRegenerateKeyDialogOpen] = useState(false);
  const [agentToRegenerate, setAgentToRegenerate] = useState<PrintAgent | null>(null);
  const [deleteAgentDialogOpen, setDeleteAgentDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<PrintAgent | null>(null);
  const [isDeletingAgent, setIsDeletingAgent] = useState(false);

  // Printer form state
  const [formData, setFormData] = useState({
    name: "",
    type: "zebra",
    connection_type: "network",
    host: "",
    port: "9100",
    dpi: "203",
    is_default: false,
    agent_id: "",
    usb_device_id: "",
    usb_device_name: "",
  });
  const [isSavingPrinter, setIsSavingPrinter] = useState(false);

  // Agent form state
  const [agentName, setAgentName] = useState("");
  const [isSavingAgent, setIsSavingAgent] = useState(false);

  // Fetch printers
  const fetchPrinters = useCallback(async () => {
    try {
      setLoadingPrinters(true);
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
      setLoadingPrinters(false);
    }
  }, [toast]);

  // Fetch agents
  const fetchAgents = useCallback(async () => {
    try {
      setLoadingAgents(true);
      const res = await fetch("/api/print-agents");
      const json = await res.json();
      if (json.data) {
        setAgents(json.data);
      }
    } catch (e) {
      console.error("Failed to fetch agents:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load print agents",
      });
    } finally {
      setLoadingAgents(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPrinters();
    fetchAgents();
  }, [fetchPrinters, fetchAgents]);

  // Printer handlers
  const handleOpenAddPrinter = () => {
    setEditingPrinter(null);
    setFormData({
      name: "",
      type: "zebra",
      connection_type: "network",
      host: "",
      port: "9100",
      dpi: "203",
      is_default: false,
      agent_id: "",
      usb_device_id: "",
      usb_device_name: "",
    });
    setAddDialogOpen(true);
  };

  const handleOpenEditPrinter = (printer: PrinterType) => {
    setEditingPrinter(printer);
    setFormData({
      name: printer.name,
      type: printer.type,
      connection_type: printer.connection_type || "network",
      host: printer.host || "",
      port: String(printer.port || 9100),
      dpi: String(printer.dpi || 203),
      is_default: printer.is_default,
      agent_id: printer.agent_id || "",
      usb_device_id: printer.usb_device_id || "",
      usb_device_name: printer.usb_device_name || "",
    });
    setAddDialogOpen(true);
  };

  const handleSavePrinter = async () => {
    if (!formData.name) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Printer name is required",
      });
      return;
    }

    if (formData.connection_type === "network" && !formData.host) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "IP address is required for network printers",
      });
      return;
    }

    if (formData.connection_type === "agent" && !formData.agent_id) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please select a print agent",
      });
      return;
    }

    setIsSavingPrinter(true);
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
        payload.agent_id = null;
        payload.usb_device_id = null;
        payload.usb_device_name = null;
      } else if (formData.connection_type === "agent") {
        payload.agent_id = formData.agent_id;
        payload.usb_device_id = formData.usb_device_id || null;
        payload.usb_device_name = formData.usb_device_name || null;
        payload.host = null;
        payload.port = null;
      }

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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save printer";
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    } finally {
      setIsSavingPrinter(false);
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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not connect to the printer.";
      toast({
        variant: "destructive",
        title: "Test Failed",
        description: message,
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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to set default";
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    }
  };

  const handleDeletePrinter = async () => {
    if (!printerToDelete) return;

    setIsDeletingPrinter(true);
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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to delete printer";
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    } finally {
      setIsDeletingPrinter(false);
    }
  };

  // Agent handlers
  const handleOpenAddAgent = () => {
    setAgentName("");
    setNewAgentKey(null);
    setAddAgentDialogOpen(true);
  };

  const handleSaveAgent = async () => {
    if (!agentName.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Agent name is required",
      });
      return;
    }

    setIsSavingAgent(true);
    try {
      const res = await fetch("/api/print-agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: agentName.trim() }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to create agent");
      }

      // Show the API key
      setNewAgentKey(json.agentKey);
      toast({
        title: "Agent Created",
        description: "Copy the API key now - it won't be shown again!",
      });
      fetchAgents();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to create agent";
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    } finally {
      setIsSavingAgent(false);
    }
  };

  const handleRegenerateKey = async () => {
    if (!agentToRegenerate) return;

    setIsSavingAgent(true);
    try {
      const res = await fetch(`/api/print-agents/${agentToRegenerate.id}/regenerate-key`, {
        method: "POST",
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to regenerate key");
      }

      // Show the new API key
      setNewAgentKey(json.agentKey);
      setRegenerateKeyDialogOpen(false);
      setAgentToRegenerate(null);
      setAddAgentDialogOpen(true); // Reuse the dialog to show the key
      setAgentName(json.data.name);
      toast({
        title: "Key Regenerated",
        description: "Copy the new API key now - it won't be shown again!",
      });
      fetchAgents();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to regenerate key";
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    } finally {
      setIsSavingAgent(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!agentToDelete) return;

    setIsDeletingAgent(true);
    try {
      const res = await fetch(`/api/print-agents/${agentToDelete.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete agent");
      }

      toast({
        title: "Agent Deleted",
        description: `"${agentToDelete.name}" has been removed`,
      });
      setDeleteAgentDialogOpen(false);
      setAgentToDelete(null);
      fetchAgents();
      fetchPrinters(); // Refresh printers as some may have lost their agent
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to delete agent";
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    } finally {
      setIsDeletingAgent(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: "API key copied to clipboard",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Copy Failed",
        description: "Please select and copy the key manually",
      });
    }
  };

  const getAgentForPrinter = (printer: PrinterType): PrintAgent | undefined => {
    return agents.find((a) => a.id === printer.agent_id);
  };

  const formatLastSeen = (lastSeen: string | null): string => {
    if (!lastSeen) return "Never";
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="printers">
            <Printer className="h-4 w-4 mr-2" />
            Printers
          </TabsTrigger>
          <TabsTrigger value="agents">
            <Monitor className="h-4 w-4 mr-2" />
            Print Agents
          </TabsTrigger>
        </TabsList>

        {/* Printers Tab */}
        <TabsContent value="printers" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Configured Printers</h3>
              <p className="text-sm text-muted-foreground">
                Manage thermal label printers for your organization
              </p>
            </div>
            <Button onClick={handleOpenAddPrinter}>
              <Plus className="h-4 w-4 mr-2" />
              Add Printer
            </Button>
          </div>

          {loadingPrinters ? (
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
                <Button onClick={handleOpenAddPrinter}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Printer
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {printers.map((printer) => {
                const agent = getAgentForPrinter(printer);
                const isAgentPrinter = printer.connection_type === "agent";

                return (
                  <Card key={printer.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            {isAgentPrinter ? (
                              <Usb className="h-5 w-5" />
                            ) : (
                              <Wifi className="h-5 w-5" />
                            )}
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
                      {isAgentPrinter ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Monitor className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs">
                            {agent ? (
                              <span className="flex items-center gap-1">
                                {agent.name}
                                <Badge
                                  variant={agent.status === "online" ? "default" : "secondary"}
                                  className="text-xs px-1.5 py-0"
                                >
                                  {agent.status}
                                </Badge>
                              </span>
                            ) : (
                              <span className="text-destructive">Agent not found</span>
                            )}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm">
                          <Wifi className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-xs">
                            {printer.host}:{printer.port}
                          </span>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestPrinter(printer.id)}
                          disabled={testingPrinter === printer.id || (isAgentPrinter && agent?.status !== "online")}
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
                          onClick={() => handleOpenEditPrinter(printer)}
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
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents" className="space-y-6">
          {/* Download Card */}
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Download className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Download Print Agent</CardTitle>
                  <CardDescription>
                    Install the desktop app on workstations with USB label printers
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href="/downloads/Hortitrack-Print-Agent-Setup.exe" download>
                    <Download className="h-4 w-4 mr-2" />
                    Windows (.exe)
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href="/downloads/Hortitrack-Print-Agent.dmg" download>
                    <Download className="h-4 w-4 mr-2" />
                    macOS (.dmg)
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                After installing, create an agent below and enter the API key in the desktop app.
              </p>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Print Agents</h3>
              <p className="text-sm text-muted-foreground">
                Desktop agents that enable printing to USB-connected printers
              </p>
            </div>
            <Button onClick={handleOpenAddAgent}>
              <Plus className="h-4 w-4 mr-2" />
              Add Agent
            </Button>
          </div>

          {loadingAgents ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : agents.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Monitor className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No print agents configured</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-md">
                  Print agents allow you to print to USB-connected printers on your workstations.
                  Add an agent, then install the desktop app to enable local printing.
                </p>
                <Button onClick={handleOpenAddAgent}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Agent
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {agents.map((agent) => (
                <Card key={agent.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${agent.status === "online" ? "bg-green-100" : "bg-muted"}`}>
                          <Monitor className={`h-5 w-5 ${agent.status === "online" ? "text-green-600" : ""}`} />
                        </div>
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {agent.name}
                            <Badge variant={agent.status === "online" ? "default" : "secondary"}>
                              {agent.status}
                            </Badge>
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {agent.workstation_info?.hostname || "Not connected yet"}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>Key: {agent.agent_key_prefix}...</div>
                      <div>Last seen: {formatLastSeen(agent.last_seen_at)}</div>
                      {agent.workstation_info?.platform && (
                        <div>
                          {agent.workstation_info.platform} • v{agent.workstation_info.agentVersion || "?"}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAgentToRegenerate(agent);
                          setRegenerateKeyDialogOpen(true);
                        }}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        New Key
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setAgentToDelete(agent);
                          setDeleteAgentDialogOpen(true);
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
        </TabsContent>
      </Tabs>

      {/* Add/Edit Printer Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPrinter ? "Edit Printer" : "Add Printer"}
            </DialogTitle>
            <DialogDescription>
              Configure a thermal label printer
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
                    <SelectItem value="toshiba">Toshiba</SelectItem>
                    <SelectItem value="dymo">Dymo</SelectItem>
                    <SelectItem value="brother">Brother</SelectItem>
                    <SelectItem value="generic">Generic ZPL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Connection Type</Label>
              <Select
                value={formData.connection_type}
                onValueChange={(v) =>
                  setFormData({ ...formData, connection_type: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="network">
                    <div className="flex items-center gap-2">
                      <Wifi className="h-4 w-4" />
                      Network (TCP/IP)
                    </div>
                  </SelectItem>
                  <SelectItem value="agent">
                    <div className="flex items-center gap-2">
                      <Usb className="h-4 w-4" />
                      USB via Print Agent
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.connection_type === "network" && (
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
            )}

            {formData.connection_type === "agent" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Print Agent</Label>
                  <Select
                    value={formData.agent_id}
                    onValueChange={(v) =>
                      setFormData({ ...formData, agent_id: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an agent..." />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          No agents configured. Add one first.
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

                <div className="space-y-2">
                  <Label>USB Printer Name (Optional)</Label>
                  <Input
                    placeholder="e.g., Zebra ZD420"
                    value={formData.usb_device_name}
                    onChange={(e) =>
                      setFormData({ ...formData, usb_device_name: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the printer name as it appears on the workstation. The agent will discover connected printers automatically.
                  </p>
                </div>
              </div>
            )}

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
              disabled={isSavingPrinter}
            >
              Cancel
            </Button>
            <Button onClick={handleSavePrinter} disabled={isSavingPrinter}>
              {isSavingPrinter ? (
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

      {/* Delete Printer Confirmation Dialog */}
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
              disabled={isDeletingPrinter}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeletePrinter}
              disabled={isDeletingPrinter}
            >
              {isDeletingPrinter ? (
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

      {/* Add Agent / Show Key Dialog */}
      <Dialog open={addAgentDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setNewAgentKey(null);
        }
        setAddAgentDialogOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {newAgentKey ? "Agent API Key" : "Add Print Agent"}
            </DialogTitle>
            <DialogDescription>
              {newAgentKey
                ? "Save this API key now - it will only be shown once!"
                : "Create a new print agent for a workstation"}
            </DialogDescription>
          </DialogHeader>

          {newAgentKey ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>Copy this key now. You won't be able to see it again!</span>
              </div>

              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={newAgentKey}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(newAgentKey)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">Next steps:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Download and install the Hortitrack Print Agent</li>
                  <li>Enter this API key when prompted</li>
                  <li>The agent will connect and discover USB printers</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Agent Name</Label>
                <Input
                  placeholder="e.g., Potting Shed PC"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Give this agent a descriptive name to identify the workstation
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            {newAgentKey ? (
              <Button onClick={() => setAddAgentDialogOpen(false)}>
                Done
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setAddAgentDialogOpen(false)}
                  disabled={isSavingAgent}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveAgent} disabled={isSavingAgent}>
                  {isSavingAgent ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Agent"
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate Key Confirmation Dialog */}
      <Dialog open={regenerateKeyDialogOpen} onOpenChange={setRegenerateKeyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate API Key</DialogTitle>
            <DialogDescription>
              This will generate a new API key for "{agentToRegenerate?.name}". The current key will stop working immediately. You'll need to update the agent with the new key.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRegenerateKeyDialogOpen(false)}
              disabled={isSavingAgent}
            >
              Cancel
            </Button>
            <Button onClick={handleRegenerateKey} disabled={isSavingAgent}>
              {isSavingAgent ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Regenerating...
                </>
              ) : (
                "Regenerate Key"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Agent Confirmation Dialog */}
      <Dialog open={deleteAgentDialogOpen} onOpenChange={setDeleteAgentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Print Agent</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{agentToDelete?.name}"? Any printers associated with this agent will no longer be able to print.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteAgentDialogOpen(false)}
              disabled={isDeletingAgent}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAgent}
              disabled={isDeletingAgent}
            >
              {isDeletingAgent ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Agent"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
