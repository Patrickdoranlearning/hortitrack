"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabaseClient } from "@/lib/supabase/client";
import ScannerDialog from "@/components/scan-and-act-dialog";
import { candidateBatchNumbers } from "@/lib/scan/parse";
import { parseScanCode } from "@/lib/scan/parse.client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Camera,
  ChevronDown,
  Download,
  Loader2,
  QrCode,
  Search,
  Filter,
  CheckCircle2,
  Leaf,
  ShoppingCart,
  X,
  Image as ImageIcon,
  Settings2,
} from "lucide-react";
import Link from "next/link";

// Types
type SaleableBatchRow = {
  id: string;
  batchNumber: string;
  status: string | null;
  statusId: string | null;
  behavior: string | null; // growing, available, archived
  quantity: number;
  plantVariety: string | null;
  plantVarietyId: string | null;
  size: string | null;
  sizeId: string | null;
  location: string | null;
  locationId: string | null;
  plantedAt: string | null;
  updatedAt: string | null;
  growerPhotoUrl: string | null;
  salesPhotoUrl: string | null;
};

type ProductionStatusOption = {
  id: string;
  systemCode: string;
  displayLabel: string;
  behavior: string | null;
  color: string | null;
};

type Props = {
  initialBatches: SaleableBatchRow[];
  productionStatusOptions: ProductionStatusOption[];
  defaultStatuses: string[];
  varieties?: Array<{ id: string; name: string }>;
  locations?: Array<{ id: string; name: string }>;
};

// Behavior colors
const BEHAVIOR_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  growing: { bg: "bg-blue-100", text: "text-blue-700", label: "Growing" },
  available: { bg: "bg-green-100", text: "text-green-700", label: "Available" },
  archived: { bg: "bg-slate-100", text: "text-slate-500", label: "Archived" },
};

function formatDate(value: string | null) {
  if (!value) return "—";
  try {
    const date = new Date(value);
    // Use ISO-style format to avoid hydration mismatch between server/client locales
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return value;
  }
}

function getBehaviorStyle(behavior: string | null) {
  return BEHAVIOR_STYLES[behavior ?? ""] ?? { bg: "bg-slate-100", text: "text-slate-700", label: "Unknown" };
}

export default function SaleableBatchesClient({
  initialBatches,
  productionStatusOptions,
  defaultStatuses,
  varieties = [],
  locations = [],
}: Props) {
  const { toast } = useToast();
  const [batches, setBatches] = useState(initialBatches);
  
  // Search and filter state
  const [search, setSearch] = useState("");
  const [behaviorFilter, setBehaviorFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [varietyFilter, setVarietyFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  
  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Scan state
  const [scanValue, setScanValue] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [defaultScanStatus, setDefaultScanStatus] = useState<string>("");
  const [showScanDropdown, setShowScanDropdown] = useState(false);
  const [selectedScanBatch, setSelectedScanBatch] = useState<SaleableBatchRow | null>(null);
  
  // Photo upload state
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const quickPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [photoTargetId, setPhotoTargetId] = useState<string | null>(null);
  
  // Bulk action state
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Group status options by behavior
  const statusesByBehavior = useMemo(() => {
    const grouped: Record<string, ProductionStatusOption[]> = {
      available: [],
      growing: [],
      archived: [],
    };
    for (const opt of productionStatusOptions) {
      const behavior = opt.behavior ?? "growing";
      if (!grouped[behavior]) grouped[behavior] = [];
      grouped[behavior].push(opt);
    }
    return grouped;
  }, [productionStatusOptions]);

  // Default scan status (first "available" status, or first status)
  const defaultAvailableStatus = useMemo(() => {
    const available = statusesByBehavior.available?.[0];
    return available?.id ?? productionStatusOptions[0]?.id ?? "";
  }, [statusesByBehavior, productionStatusOptions]);

  const toText = (value: string | number | null | undefined) =>
    (value ?? "").toString().toLowerCase();

  // Matches for the scan autocomplete
  const scanMatches = useMemo(() => {
    const query = scanValue.trim().toLowerCase();
    if (!query) return [];
    return batches.filter((batch) =>
      toText(batch.batchNumber).includes(query) ||
      toText(batch.plantVariety).includes(query) ||
      toText(batch.location).includes(query)
    );
  }, [batches, scanValue]);

  // Filtered batches with all filters applied
  const filteredBatches = useMemo(() => {
    const query = search.trim().toLowerCase();
    return batches.filter((batch) => {
      // Behavior filter
      if (behaviorFilter !== "all" && batch.behavior !== behaviorFilter) {
        return false;
      }
      // Status filter
      if (statusFilter !== "all" && batch.statusId !== statusFilter) {
        return false;
      }
      // Variety filter
      if (varietyFilter !== "all" && batch.plantVarietyId !== varietyFilter) {
        return false;
      }
      // Location filter
      if (locationFilter !== "all" && batch.locationId !== locationFilter) {
        return false;
      }
      // Search query
      if (!query) return true;
      return (
        toText(batch.batchNumber).includes(query) ||
        toText(batch.plantVariety).includes(query) ||
        toText(batch.location).includes(query)
      );
    });
  }, [batches, search, behaviorFilter, statusFilter, varietyFilter, locationFilter]);

  // Stats
  const stats = useMemo(() => {
    const available = filteredBatches.filter((b) => b.behavior === "available");
    const growing = filteredBatches.filter((b) => b.behavior === "growing");
    return {
      total: filteredBatches.length,
      totalUnits: filteredBatches.reduce((sum, b) => sum + (b.quantity ?? 0), 0),
      available: available.length,
      availableUnits: available.reduce((sum, b) => sum + (b.quantity ?? 0), 0),
      growing: growing.length,
      withPhotos: filteredBatches.filter((b) => b.salesPhotoUrl || b.growerPhotoUrl).length,
    };
  }, [filteredBatches]);

  // Select all / none
  const allSelected = filteredBatches.length > 0 && filteredBatches.every((b) => selectedIds.has(b.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredBatches.map((b) => b.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Bulk status update
  const handleBulkStatusUpdate = async (statusOption: ProductionStatusOption) => {
    if (selectedIds.size === 0) {
      toast({ variant: "destructive", title: "No batches selected" });
      return;
    }

    setIsBulkUpdating(true);
    try {
      const response = await fetch("/api/batches/bulk-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          batchIds: Array.from(selectedIds),
          statusId: statusOption.id,
          status: statusOption.systemCode,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to update batches.");
      }

      // Update local state
      setBatches((prev) =>
        prev.map((batch) => {
          if (selectedIds.has(batch.id)) {
            return {
              ...batch,
              status: statusOption.systemCode,
              statusId: statusOption.id,
              behavior: statusOption.behavior,
              updatedAt: new Date().toISOString(),
            };
          }
          return batch;
        })
      );

      toast({
        title: `Updated ${selectedIds.size} batch${selectedIds.size === 1 ? "" : "es"}`,
        description: `Status set to "${statusOption.displayLabel}".`,
      });
      clearSelection();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message ?? String(error),
      });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Single batch status update
  const handleSingleStatusUpdate = async (batchId: string, statusOption: ProductionStatusOption) => {
    try {
      const response = await fetch("/api/batches/bulk-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          batchIds: [batchId],
          statusId: statusOption.id,
          status: statusOption.systemCode,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to update batch.");
      }

      setBatches((prev) =>
        prev.map((batch) =>
          batch.id === batchId
            ? { 
                ...batch, 
                status: statusOption.systemCode,
                statusId: statusOption.id,
                behavior: statusOption.behavior,
                updatedAt: new Date().toISOString() 
              }
            : batch
        )
      );

      toast({ title: "Status updated" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message ?? String(error),
      });
    }
  };

  // Scanner functions
  const resolveBatchFromInput = (raw: string) => {
    const cleaned = raw.trim();
    if (!cleaned) return { batch: null, reason: "empty" as const };

    const parsed = parseScanCode(cleaned);
    const normalized = cleaned.toLowerCase().replace(/^#/, "");

    if (parsed?.by === "id") {
      const match = batches.find((batch) => toText(batch.id) === parsed.value.toLowerCase());
      if (match) return { batch: match, reason: null };
    }

    if (parsed?.by === "batchNumber") {
      const candidates = candidateBatchNumbers(parsed.value).map((v) => v.toLowerCase());
      const matches = batches.filter((batch) => candidates.includes(toText(batch.batchNumber)));
      if (matches.length === 1) return { batch: matches[0], reason: null };
      if (matches.length > 1) return { batch: null, reason: "ambiguous" as const, matches: matches.length };
    }

    const fuzzyMatches = batches.filter((batch) =>
      [toText(batch.batchNumber), toText(batch.plantVariety), toText(batch.location)].some((f) =>
        f.includes(normalized)
      )
    );
    if (fuzzyMatches.length === 1) return { batch: fuzzyMatches[0], reason: null };
    if (fuzzyMatches.length > 1) return { batch: null, reason: "ambiguous" as const, matches: fuzzyMatches.length };

    return { batch: null, reason: "not_found" as const };
  };

  const handleScanSubmit = async (event?: FormEvent, overrideBatch?: SaleableBatchRow) => {
    if (event) event.preventDefault();
    
    const targetBatch = overrideBatch ?? selectedScanBatch;
    
    if (!targetBatch) {
      // Try to find a single match from what's typed
      if (scanMatches.length === 1) {
        setSelectedScanBatch(scanMatches[0]);
        handleScanSubmit(undefined, scanMatches[0]);
        return;
      } else if (scanMatches.length > 1) {
        toast({
          variant: "destructive",
          title: "Multiple batches match",
          description: "Please select a batch from the dropdown.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "No batch selected",
          description: "Please select a batch from the dropdown.",
        });
      }
      return;
    }

    // Find the target status (first available status or user-selected)
    const targetStatusId = defaultScanStatus || defaultAvailableStatus;
    const targetStatus = productionStatusOptions.find(s => s.id === targetStatusId);
    
    if (!targetStatus) {
      toast({ variant: "destructive", title: "No target status configured" });
      return;
    }

    setIsScanning(true);
    setShowScanDropdown(false);
    
    try {
      const response = await fetch("/api/batches/bulk-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          batchIds: [targetBatch.id],
          statusId: targetStatus.id,
          status: targetStatus.systemCode,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Update failed.");

      setBatches((prev) =>
        prev.map((batch) =>
          batch.id === targetBatch.id
            ? { 
                ...batch, 
                status: targetStatus.systemCode,
                statusId: targetStatus.id,
                behavior: targetStatus.behavior,
                updatedAt: new Date().toISOString() 
              }
            : batch
        )
      );

      toast({
        title: `Marked as ${targetStatus.displayLabel}`,
        description: `Batch #${targetBatch.batchNumber} updated.`,
      });
      
      // Clear selection after successful update
      setSelectedScanBatch(null);
      setScanValue("");
      setSearch(targetBatch.batchNumber);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update failed", description: error.message });
    } finally {
      setIsScanning(false);
    }
  };

  const handleScanDetected = (text: string) => {
    if (!text?.trim()) return;
    setIsScanOpen(false);
    
    // Try to find the batch by the scanned code
    const matchResult = resolveBatchFromInput(text.trim());
    if (matchResult.batch) {
      setSelectedScanBatch(matchResult.batch);
      setScanValue(`#${matchResult.batch.batchNumber} - ${matchResult.batch.plantVariety}`);
      // Auto-submit after scanning
      handleScanSubmit(undefined, matchResult.batch);
    } else {
      setScanValue(text.trim());
      toast({
        variant: "destructive",
        title: "Batch not found",
        description: `No batch matches scanned code "${text.trim()}"`,
      });
    }
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowScanDropdown(false);
    if (showScanDropdown) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showScanDropdown]);

  // Photo upload
  const handlePhotoUpload = async (batchId: string, file: File) => {
    setUploadingId(batchId);
    try {
      const supabase = supabaseClient();
      const fileExt = file.name.split(".").pop();
      const fileName = `${batchId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("batch-photos").upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("batch-photos").getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("batches")
        .update({ sales_photo_url: publicUrl, updated_at: new Date().toISOString() })
        .eq("id", batchId);

      if (updateError) throw updateError;

      setBatches((prev) =>
        prev.map((b) => (b.id === batchId ? { ...b, salesPhotoUrl: publicUrl } : b))
      );

      toast({ title: "Photo uploaded", description: "Sales photo saved." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Upload failed", description: error.message });
    } finally {
      setUploadingId(null);
      setPhotoTargetId(null);
    }
  };

  // Downloads
  const downloadCSV = () => {
    const headers = ["Batch", "Variety", "Size", "Status", "Behavior", "Units", "Location", "Updated"];
    const rows = filteredBatches.map((b) => [
      b.batchNumber,
      b.plantVariety ?? "",
      b.size ?? "",
      b.status ?? "",
      getBehaviorStyle(b.behavior).label,
      b.quantity ?? 0,
      b.location ?? "",
      formatDate(b.updatedAt),
    ]);

    const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `batches-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearch("");
    setBehaviorFilter("all");
    setStatusFilter("all");
    setVarietyFilter("all");
    setLocationFilter("all");
  };

  const hasActiveFilters = search || behaviorFilter !== "all" || statusFilter !== "all" || varietyFilter !== "all" || locationFilter !== "all";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Batch Availability</h1>
          <p className="text-muted-foreground mt-1">
            Manage batch production status. Scan batches or use bulk actions to update status.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/production/saleable/wizard">
              <Camera className="h-4 w-4 mr-2" />
              Wizard
            </Link>
          </Button>
          <Button variant="outline" onClick={downloadCSV} className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link href="/settings/dropdowns">
              <Settings2 className="h-4 w-4 mr-2" />
              Configure Statuses
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick Scan Card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <QrCode className="h-5 w-5" />
            Quick Scan
          </CardTitle>
          <CardDescription>
            Scan or search for a batch to update its status or add photos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleScanSubmit} className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1 relative">
              <div className="relative">
                <Input
                  placeholder="Batch number, variety, or location..."
                  value={scanValue}
                  onChange={(e) => {
                    setScanValue(e.target.value);
                    setShowScanDropdown(true);
                  }}
                  onFocus={() => setShowScanDropdown(true)}
                  className="bg-white pr-10"
                  autoComplete="off"
                />
                {/* Scanner button inside input */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                  onClick={() => setIsScanOpen(true)}
                  title="Scan barcode/QR code"
                >
                  <QrCode className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
              {/* Autocomplete dropdown */}
              {showScanDropdown && scanValue.trim() && scanMatches.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                  {scanMatches.slice(0, 10).map((batch) => (
                    <button
                      key={batch.id}
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-muted flex items-center justify-between"
                      onClick={() => {
                        setSelectedScanBatch(batch);
                        setScanValue(`#${batch.batchNumber} - ${batch.plantVariety}`);
                        setShowScanDropdown(false);
                      }}
                    >
                      <div>
                        <span className="font-medium">#{batch.batchNumber}</span>
                        <span className="text-muted-foreground ml-2">{batch.plantVariety}</span>
                        <span className="text-xs text-muted-foreground ml-2">({batch.size})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{batch.quantity} units</span>
                        <Badge className={`${getBehaviorStyle(batch.behavior).bg} ${getBehaviorStyle(batch.behavior).text} text-xs`}>
                          {batch.status}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showScanDropdown && scanValue.trim() && scanMatches.length === 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg p-3 text-center text-muted-foreground">
                  No batches match "{scanValue}"
                </div>
              )}
            </div>
            <Select value={defaultScanStatus || defaultAvailableStatus} onValueChange={setDefaultScanStatus}>
              <SelectTrigger className="w-[200px] bg-white">
                <SelectValue placeholder="Target status" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusesByBehavior).map(([behavior, statuses]) => (
                  statuses.length > 0 && (
                    <div key={behavior}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                        {getBehaviorStyle(behavior).label}
                      </div>
                      {statuses.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.displayLabel}
                        </SelectItem>
                      ))}
                    </div>
                  )
                ))}
              </SelectContent>
            </Select>
            {/* Photo upload button */}
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                if (selectedScanBatch) {
                  setPhotoTargetId(selectedScanBatch.id);
                  quickPhotoInputRef.current?.click();
                } else {
                  toast({ variant: "destructive", title: "Select a batch first", description: "Search and select a batch before adding a photo." });
                }
              }}
              disabled={uploadingId !== null}
              title="Upload photo for selected batch"
            >
              {uploadingId === selectedScanBatch?.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </Button>
            <Button type="submit" disabled={isScanning || !selectedScanBatch}>
              {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Status"}
            </Button>
          </form>
          {selectedScanBatch && (
            <div className="mt-3 p-3 bg-white rounded-md border flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedScanBatch.salesPhotoUrl ? (
                  <img 
                    src={selectedScanBatch.salesPhotoUrl} 
                    alt="Batch photo" 
                    className="h-12 w-12 rounded object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <div>
                    <span className="font-bold">#{selectedScanBatch.batchNumber}</span>
                    <span className="text-muted-foreground ml-2">{selectedScanBatch.plantVariety} - {selectedScanBatch.size}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedScanBatch.quantity} units • {selectedScanBatch.location}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => {
                setSelectedScanBatch(null);
                setScanValue("");
              }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Hidden file input for quick photo upload - supports camera and gallery */}
      <input
        ref={quickPhotoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && photoTargetId) {
            handlePhotoUpload(photoTargetId, file);
          }
          e.target.value = "";
        }}
      />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <StatCard label="Total Batches" value={stats.total} icon={<Leaf className="h-4 w-4" />} />
        <StatCard label="Total Units" value={stats.totalUnits.toLocaleString()} />
        <StatCard label="Available" value={stats.available} icon={<ShoppingCart className="h-4 w-4 text-green-600" />} color="text-green-600" />
        <StatCard label="Growing" value={stats.growing} icon={<Leaf className="h-4 w-4 text-blue-600" />} color="text-blue-600" />
        <StatCard label="With Photos" value={stats.withPhotos} icon={<ImageIcon className="h-4 w-4 text-purple-600" />} />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            {/* Search */}
            <div className="relative md:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full w-10 text-muted-foreground hover:text-foreground hover:bg-transparent"
                onClick={() => setIsScanOpen(true)}
                title="Scan QR code"
              >
                <QrCode className="h-4 w-4" />
              </Button>
            </div>

            {/* Behavior Filter */}
            <Select value={behaviorFilter} onValueChange={setBehaviorFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Behavior" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Behaviors</SelectItem>
                <SelectItem value="available">Available (for sale)</SelectItem>
                <SelectItem value="growing">Growing</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {productionStatusOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.displayLabel}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Variety Filter */}
            <Select value={varietyFilter} onValueChange={setVarietyFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Variety" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Varieties</SelectItem>
                {varieties.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Location Filter */}
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      {someSelected && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="py-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
              <span className="font-medium">{selectedIds.size} batch{selectedIds.size === 1 ? "" : "es"} selected</span>
              <Button variant="ghost" size="sm" onClick={clearSelection}>Clear</Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Bulk Status Update */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isBulkUpdating}>
                    <Leaf className="h-4 w-4 mr-1" />
                    Set Status
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {Object.entries(statusesByBehavior).map(([behavior, statuses]) => (
                    statuses.length > 0 && (
                      <div key={behavior}>
                        <DropdownMenuLabel className="text-xs uppercase text-muted-foreground">
                          {getBehaviorStyle(behavior).label}
                        </DropdownMenuLabel>
                        {statuses.map((s) => (
                          <DropdownMenuItem key={s.id} onClick={() => handleBulkStatusUpdate(s)}>
                            {s.displayLabel}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                      </div>
                    )
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Showing {filteredBatches.length} of {batches.length} batches</span>
      </div>

      {/* Batch Table */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Variety / Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="hidden md:table-cell">Location</TableHead>
                <TableHead>Photo</TableHead>
                <TableHead className="hidden md:table-cell">Updated</TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {filteredBatches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  No batches match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredBatches.map((batch) => {
                const behaviorStyle = getBehaviorStyle(batch.behavior);
                return (
                  <TableRow key={batch.id} className={selectedIds.has(batch.id) ? "bg-blue-50/50" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(batch.id)}
                        onCheckedChange={() => toggleSelect(batch.id)}
                        aria-label={`Select batch ${batch.batchNumber}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">#{batch.batchNumber}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{batch.plantVariety ?? "Unknown"}</span>
                        <span className="text-xs text-muted-foreground">{batch.size ?? "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Select
                          value={batch.statusId ?? ""}
                          onValueChange={(v) => {
                            const statusOpt = productionStatusOptions.find(s => s.id === v);
                            if (statusOpt) handleSingleStatusUpdate(batch.id, statusOpt);
                          }}
                        >
                          <SelectTrigger className="h-8 w-[150px]">
                            <SelectValue>{batch.status ?? "—"}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(statusesByBehavior).map(([behavior, statuses]) => (
                              statuses.length > 0 && (
                                <div key={behavior}>
                                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">
                                    {getBehaviorStyle(behavior).label}
                                  </div>
                                  {statuses.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>{s.displayLabel}</SelectItem>
                                  ))}
                                </div>
                              )
                            ))}
                          </SelectContent>
                        </Select>
                        <Badge className={`${behaviorStyle.bg} ${behaviorStyle.text} text-[10px] w-fit`}>
                          {behaviorStyle.label}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{(batch.quantity ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{batch.location ?? "—"}</TableCell>
                    <TableCell>
                      <Button
                        variant={batch.salesPhotoUrl ? "ghost" : "outline"}
                        size="sm"
                        className="h-8 px-2"
                        disabled={uploadingId === batch.id}
                        onClick={() => {
                          setPhotoTargetId(batch.id);
                          photoInputRef.current?.click();
                        }}
                      >
                        {uploadingId === batch.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : batch.salesPhotoUrl ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <ImageIcon className="h-4 w-4" /> ✓
                          </span>
                        ) : (
                          <Camera className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{formatDate(batch.updatedAt)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
          </Table>
        </div>
      </div>

      {/* Hidden file input for photo upload */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && photoTargetId) handlePhotoUpload(photoTargetId, file);
          e.target.value = "";
        }}
      />

      {/* Scanner Dialog */}
      <ScannerDialog open={isScanOpen} onOpenChange={setIsScanOpen} onDetected={handleScanDetected} />
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon?: React.ReactNode; color?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          {icon}
        </div>
        <p className={`text-2xl font-bold mt-1 ${color ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
