"use client";

import * as React from "react";
import { ReferenceDataContext } from "@/contexts/ReferenceDataContext";
import { transplantBatchAction } from "@/app/actions/transplant";
import { fetchJson } from "@/lib/http/fetchJson";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Plus, Trash2, Search, CheckCircle2, AlertCircle, Loader2, ScanLine, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SelectWithCreate } from "@/components/ui/select-with-create";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MaterialConsumptionPreview } from "@/components/materials/MaterialConsumptionPreview";
import dynamic from "next/dynamic";

const ScannerClient = dynamic(() => import("@/components/Scanner/ScannerClient"), {
  ssr: false,
  loading: () => <div className="flex h-64 items-center justify-center text-muted-foreground">Loading scanner...</div>,
});

type UploadStatus = "pending" | "uploading" | "success" | "error";

type ParentBatch = {
  id: string;
  batch_number: string;
  quantity: number | null;
  variety_name: string | null;
  size_name: string | null;
  location_name: string | null;
  phase: string | null;
  status: string | null;
};

type TransplantRow = {
  id: string;
  parentBatchId?: string;
  parentBatch?: ParentBatch;
  units: number;
  sizeId?: string;
  locationId?: string;
  errors: string[];
  status: UploadStatus;
  message?: string;
};

type WizardStep = "setup" | "rows" | "review";

type Props = {
  onComplete?: () => void;
};

export default function BulkTransplantWizard({ onComplete }: Props) {
  const { data: referenceData, loading, error, reload } = React.useContext(ReferenceDataContext);
  const { toast } = useToast();
  
  // Auto-refresh reference data when user returns from creating a new entity in another tab
  useRefreshOnFocus(reload);
  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Wizard state
  const [step, setStep] = React.useState<WizardStep>("setup");

  // Setup step state (defaults)
  const [defaults, setDefaults] = React.useState<{
    locationId?: string;
    sizeId?: string;
    plantedAt?: string;
    archiveParentIfEmpty: boolean;
  }>({ plantedAt: today, archiveParentIfEmpty: true });

  // Rows state
  const [rows, setRows] = React.useState<TransplantRow[]>([]);
  const [busy, setBusy] = React.useState<"uploading" | null>(null);

  // Batch search state
  const [batchSearchResults, setBatchSearchResults] = React.useState<ParentBatch[]>([]);
  const [batchSearchLoading, setBatchSearchLoading] = React.useState(false);

  // Scanner state - lifted up from row component
  const [scannerOpen, setScannerOpen] = React.useState(false);
  const [scanningRowId, setScanningRowId] = React.useState<string | null>(null);

  const sizeMap = React.useMemo(() => {
    const byId = new Map<string, { name: string; cell_multiple?: number }>();
    referenceData?.sizes?.forEach((item) => {
      if (!item?.id || !item?.name) return;
      byId.set(item.id, { name: item.name, cell_multiple: item.cell_multiple ?? undefined });
    });
    return byId;
  }, [referenceData]);

  const locationMap = React.useMemo(() => {
    const byId = new Map<string, string>();
    referenceData?.locations?.forEach((item) => {
      if (!item?.id || !item?.name) return;
      byId.set(item.id, item.name);
    });
    return byId;
  }, [referenceData]);

  React.useEffect(() => {
    setDefaults((prev) => ({
      plantedAt: prev.plantedAt ?? today,
      locationId: prev.locationId ?? referenceData?.locations?.[0]?.id,
      sizeId: prev.sizeId ?? referenceData?.sizes?.[0]?.id,
      archiveParentIfEmpty: prev.archiveParentIfEmpty ?? true,
    }));
  }, [referenceData, today]);

  const readyCount = React.useMemo(
    () => rows.filter((row) => !row.errors.length && row.status === "pending").length,
    [rows]
  );
  const successCount = rows.filter((row) => row.status === "success").length;
  const errorCount = rows.filter((row) => row.status === "error").length;
  const totalUnits = rows.reduce((sum, row) => sum + (row.units || 0), 0);

  // Material consumption preview data for all rows
  const consumptionBatches = React.useMemo(() => {
    if (!defaults.sizeId) return [];
    const sizeInfo = sizeMap.get(defaults.sizeId);
    if (!sizeInfo) return [];

    // Aggregate units by target size (all rows use the same default size)
    const validRows = rows.filter((row) => row.units > 0 && row.status === "pending");
    if (validRows.length === 0) return [];

    const aggregatedUnits = validRows.reduce((sum, row) => sum + row.units, 0);
    return [{
      batchId: 'bulk-transplant',
      sizeId: defaults.sizeId,
      sizeName: sizeInfo.name,
      quantity: aggregatedUnits,
    }];
  }, [rows, defaults.sizeId, sizeMap]);

  const searchBatches = React.useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setBatchSearchResults([]);
      return;
    }
    setBatchSearchLoading(true);
    try {
      const res = await fetchJson<{ items: ParentBatch[] }>(
        `/api/production/batches/search?q=${encodeURIComponent(query)}&status=Growing&pageSize=20`
      );
      setBatchSearchResults(res.items ?? []);
    } catch {
      setBatchSearchResults([]);
    } finally {
      setBatchSearchLoading(false);
    }
  }, []);

  const validateRow = React.useCallback((row: TransplantRow): string[] => {
    const issues: string[] = [];
    if (!row.parentBatchId) issues.push("Select batch");
    if (!row.sizeId) issues.push("Missing size");
    if (!row.locationId) issues.push("Missing location");
    if (!Number.isFinite(row.units) || row.units <= 0) issues.push("Invalid units");

    // Check if units exceed parent availability
    if (row.parentBatch && row.units > (row.parentBatch.quantity ?? 0)) {
      issues.push("Exceeds available");
    }

    return issues;
  }, []);

  const updateRow = React.useCallback((id: string, patch: Partial<TransplantRow>) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...patch };
        return { ...next, errors: validateRow(next) };
      })
    );
  }, [validateRow]);

  const removeRow = React.useCallback((id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  }, []);

  const openScanner = React.useCallback((rowId: string) => {
    setScanningRowId(rowId);
    setScannerOpen(true);
  }, []);

  const handleScanResult = React.useCallback(async (scannedText: string) => {
    setScannerOpen(false);
    if (!scanningRowId) return;

    // Search for batch by scanned batch number
    try {
      const res = await fetchJson<{ items: ParentBatch[] }>(
        `/api/production/batches/search?q=${encodeURIComponent(scannedText)}&status=Growing&pageSize=5`
      );
      const items = res.items ?? [];
      // Prefer exact match
      const exactMatch = items.find((b) => b.batch_number === scannedText);
      if (exactMatch) {
        updateRow(scanningRowId, {
          parentBatchId: exactMatch.id,
          parentBatch: exactMatch,
        });
      } else if (items.length === 1) {
        updateRow(scanningRowId, {
          parentBatchId: items[0].id,
          parentBatch: items[0],
        });
      } else if (items.length > 1) {
        // Update search results to let user pick
        setBatchSearchResults(items);
        toast({
          title: "Multiple matches found",
          description: `Found ${items.length} batches matching "${scannedText}". Please select one from the dropdown.`,
        });
      } else {
        toast({
          title: "No batch found",
          description: `No growing batch found matching "${scannedText}"`,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Scan failed",
        description: "Error searching for batch",
        variant: "destructive",
      });
    }
    setScanningRowId(null);
  }, [scanningRowId, updateRow, toast]);

  const addRow = React.useCallback(() => {
    const newRow: TransplantRow = {
      id: crypto.randomUUID?.() ?? `row-${Date.now()}`,
      parentBatchId: undefined,
      parentBatch: undefined,
      units: 0,
      sizeId: defaults.sizeId,
      locationId: defaults.locationId,
      errors: [],
      status: "pending",
    };
    // Run validation on the new row
    newRow.errors = validateRow(newRow);
    setRows((prev) => [...prev, newRow]);
  }, [defaults.sizeId, defaults.locationId, validateRow]);

  const handleNext = React.useCallback(() => {
    if (step === "setup") {
      // Add first row when moving to rows step
      if (rows.length === 0) {
        addRow();
      }
      setStep("rows");
    } else if (step === "rows") {
      setStep("review");
    }
  }, [step, rows.length, addRow]);

  const handleBack = React.useCallback(() => {
    if (step === "rows") {
      setStep("setup");
    } else if (step === "review") {
      setStep("rows");
    }
  }, [step]);

  async function handleUpload() {
    if (!readyCount) return;
    setBusy("uploading");
    let created = 0;
    let failed = 0;

    // Calculate containers from units based on size cell_multiple
    for (const row of rows) {
      if (row.errors.length || row.status === "success") continue;

      // Additional validation before upload
      if (!row.parentBatchId || !row.sizeId || !row.locationId || row.units <= 0) {
        failed += 1;
        updateRow(row.id, { status: "error", message: "Missing required fields" });
        continue;
      }

      updateRow(row.id, { status: "uploading", message: undefined });
      try {
        // Pass units directly - the RPC function will use units when provided
        const result = await transplantBatchAction({
          parent_batch_id: row.parentBatchId,
          size_id: row.sizeId,
          location_id: row.locationId,
          containers: 1, // Dummy value, units takes precedence
          units: row.units, // Direct unit count
          planted_at: defaults.plantedAt || undefined,
          archive_parent_if_empty: defaults.archiveParentIfEmpty,
        });

        if (!result.success) {
          throw new Error(result.error);
        }

        created += 1;
        updateRow(row.id, { status: "success", message: `Created ${result.data.childBatch.batchNumber}` });
      } catch (err) {
        failed += 1;
        const description = err instanceof Error ? err.message : "Failed to create transplant";
        updateRow(row.id, {
          status: "error",
          message: description,
        });
      }
    }

    toast({
      title: "Bulk transplant finished",
      description: `${created} batch${created === 1 ? "" : "es"} created${
        failed ? `, ${failed} failed.` : "."
      }`,
      variant: failed ? "destructive" : "default",
    });

    setBusy(null);
    if (created > 0) {
      onComplete?.();
    }
  }

  if (loading && !referenceData) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
        Loading reference data...
      </div>
    );
  }

  if (!referenceData) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Reference data unavailable</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3">
          <span>{error ?? "We couldn't load sizes or locations."}</span>
          <Button size="sm" variant="outline" onClick={reload}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2">
        {(["setup", "rows", "review"] as const).map((s, idx) => (
          <React.Fragment key={s}>
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                step === s
                  ? "bg-primary text-primary-foreground"
                  : idx < ["setup", "rows", "review"].indexOf(step)
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {idx + 1}
            </div>
            {idx < 2 && (
              <div
                className={cn(
                  "h-0.5 w-12",
                  idx < ["setup", "rows", "review"].indexOf(step) ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </React.Fragment>
        ))}
      </div>
      <div className="text-center text-sm text-muted-foreground">
        {step === "setup" && "Step 1: Set defaults"}
        {step === "rows" && "Step 2: Add transplant rows"}
        {step === "review" && "Step 3: Review & submit"}
      </div>

      {/* Step 1: Setup */}
      {step === "setup" && (
        <Card>
          <CardHeader>
            <CardTitle>Default Settings</CardTitle>
            <CardDescription>
              Set the default size, location, and date for all transplant rows.
              You can override these per row.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Target Size</Label>
                <SelectWithCreate
                  options={referenceData.sizes.map((size) => ({
                    value: size.id!,
                    label: size.name + (size.cell_multiple && size.cell_multiple > 1 ? ` (${size.cell_multiple} cells)` : ""),
                  }))}
                  value={defaults.sizeId ?? ""}
                  onValueChange={(value) =>
                    setDefaults((prev) => ({ ...prev, sizeId: value }))
                  }
                  createHref="/sizes"
                  placeholder="Select size"
                  createLabel="Add new size"
                />
              </div>

              <div className="space-y-2">
                <Label>Target Location</Label>
                <SelectWithCreate
                  options={referenceData.locations.map((loc) => ({
                    value: loc.id!,
                    label: (loc.nursery_site ? `${loc.nursery_site} · ` : "") + loc.name,
                  }))}
                  value={defaults.locationId ?? ""}
                  onValueChange={(value) =>
                    setDefaults((prev) => ({ ...prev, locationId: value }))
                  }
                  createHref="/locations"
                  placeholder="Select location"
                  createLabel="Add new location"
                />
              </div>

              <div className="space-y-2">
                <Label>Transplant Date</Label>
                <Input
                  type="date"
                  value={defaults.plantedAt ?? ""}
                  onChange={(event) =>
                    setDefaults((prev) => ({ ...prev, plantedAt: event.target.value || undefined }))
                  }
                />
              </div>

              <div className="flex items-center gap-3 pt-6">
                <Checkbox
                  id="archive-parent"
                  checked={defaults.archiveParentIfEmpty}
                  onCheckedChange={(v) =>
                    setDefaults((prev) => ({ ...prev, archiveParentIfEmpty: Boolean(v) }))
                  }
                />
                <Label htmlFor="archive-parent" className="text-sm">
                  Archive parent batch when quantity reaches zero
                </Label>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleNext} disabled={!defaults.sizeId || !defaults.locationId}>
                Next: Add Rows
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Rows */}
      {step === "rows" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Transplant Rows</CardTitle>
                <CardDescription>
                  Add rows for each parent batch you want to transplant from.
                  Enter units (plants) to transplant.
                </CardDescription>
              </div>
              <Button onClick={addRow} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Row
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary bar */}
            <div className="flex items-center gap-4 rounded-lg bg-muted/50 px-4 py-2 text-sm">
              <span>
                <strong>{rows.length}</strong> rows
              </span>
              <span className="text-muted-foreground">|</span>
              <span>
                <strong>{totalUnits.toLocaleString()}</strong> total units
              </span>
              <span className="text-muted-foreground">|</span>
              <span className="text-muted-foreground">
                Size: {sizeMap.get(defaults.sizeId ?? "")?.name ?? "—"}
              </span>
              <span className="text-muted-foreground">|</span>
              <span className="text-muted-foreground">
                Location: {locationMap.get(defaults.locationId ?? "") ?? "—"}
              </span>
            </div>

            {/* Rows table */}
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead className="min-w-[300px]">Source Batch</TableHead>
                    <TableHead className="w-[140px] text-right">Available</TableHead>
                    <TableHead className="w-[140px]">Units</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No rows yet. Click "Add Row" to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row, index) => (
                      <TransplantRowEditor
                        key={row.id}
                        row={row}
                        index={index}
                        onUpdate={updateRow}
                        onRemove={removeRow}
                        onSearchBatches={searchBatches}
                        onOpenScanner={openScanner}
                        batchSearchResults={batchSearchResults}
                        batchSearchLoading={batchSearchLoading}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleNext} disabled={rows.length === 0 || readyCount === 0}>
                Next: Review
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review */}
      {step === "review" && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Submit</CardTitle>
            <CardDescription>
              Review your transplant rows before submitting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary */}
            <div className="grid gap-4 rounded-lg bg-muted/30 p-4 md:grid-cols-4">
              <div>
                <div className="text-sm text-muted-foreground">Ready to process</div>
                <div className="text-2xl font-bold">{readyCount}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total units</div>
                <div className="text-2xl font-bold">{totalUnits.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Target size</div>
                <div className="text-lg font-medium">{sizeMap.get(defaults.sizeId ?? "")?.name ?? "—"}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Target location</div>
                <div className="text-lg font-medium">{locationMap.get(defaults.locationId ?? "") ?? "—"}</div>
              </div>
            </div>

            {/* Status badges */}
            <div className="flex gap-3">
              {readyCount > 0 && (
                <Badge variant="outline" className="text-sm">
                  {readyCount} ready
                </Badge>
              )}
              {successCount > 0 && (
                <Badge variant="default" className="text-sm">
                  {successCount} created
                </Badge>
              )}
              {errorCount > 0 && (
                <Badge variant="destructive" className="text-sm">
                  {errorCount} failed
                </Badge>
              )}
            </div>

            {/* Rows preview */}
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source Batch</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {row.parentBatch?.batch_number ?? "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.parentBatch?.variety_name ?? "Unknown variety"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {row.units.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <StatusBadge row={row} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Material consumption preview */}
            {consumptionBatches.length > 0 && (
              <MaterialConsumptionPreview batches={consumptionBatches} />
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack} disabled={busy === "uploading"}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!readyCount || busy === "uploading"}
              >
                {busy === "uploading" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Create {readyCount} Batch{readyCount !== 1 ? "es" : ""}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scanner Dialog - lifted to wizard level for proper chunk loading */}
      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5" />
              Scan Batch Barcode
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <ScannerClient onDecoded={handleScanResult} />
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setScannerOpen(false)}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TransplantRowEditor({
  row,
  index,
  onUpdate,
  onRemove,
  onSearchBatches,
  onOpenScanner,
  batchSearchResults,
  batchSearchLoading,
}: {
  row: TransplantRow;
  index: number;
  onUpdate: (id: string, patch: Partial<TransplantRow>) => void;
  onRemove: (id: string) => void;
  onSearchBatches: (query: string) => void;
  onOpenScanner: (rowId: string) => void;
  batchSearchResults: ParentBatch[];
  batchSearchLoading: boolean;
}) {
  const [batchOpen, setBatchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleBatchSearch = React.useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      onSearchBatches(value);
    }, 300);
  }, [onSearchBatches]);

  const selectBatch = React.useCallback((batch: ParentBatch) => {
    onUpdate(row.id, {
      parentBatchId: batch.id,
      parentBatch: batch,
    });
    setBatchOpen(false);
    setSearchQuery("");
  }, [row.id, onUpdate]);

  const parentAvailable = row.parentBatch?.quantity ?? 0;
  const insufficient = row.parentBatchId && row.units > parentAvailable;

  return (
    <TableRow className={insufficient ? "bg-destructive/5" : undefined}>
      <TableCell className="font-mono text-xs text-muted-foreground">{index + 1}</TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Popover open={batchOpen} onOpenChange={setBatchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={batchOpen}
                className="flex-1 justify-start font-normal"
              >
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                {row.parentBatch ? (
                  <span className="truncate">
                    <span className="font-medium">{row.parentBatch.batch_number}</span>
                    <span className="ml-2 text-muted-foreground text-xs">
                      {row.parentBatch.variety_name ?? "?"}
                      {row.parentBatch.size_name ? ` · ${row.parentBatch.size_name}` : ""}
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Search batch...</span>
                )}
              </Button>
            </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search by batch number or variety..."
                value={searchQuery}
                onValueChange={handleBatchSearch}
              />
              <CommandList>
                {batchSearchLoading ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Searching...
                  </div>
                ) : batchSearchResults.length === 0 ? (
                  <CommandEmpty>
                    {searchQuery.length < 2
                      ? "Type at least 2 characters to search"
                      : "No batches found"}
                  </CommandEmpty>
                ) : (
                  <CommandGroup>
                    {batchSearchResults.map((batch) => (
                      <CommandItem
                        key={batch.id}
                        value={batch.id}
                        onSelect={() => selectBatch(batch)}
                        className="cursor-pointer"
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="font-medium">{batch.batch_number}</div>
                          <div className="text-xs text-muted-foreground">
                            {batch.variety_name ?? "—"}
                            {batch.size_name ? ` · ${batch.size_name}` : ""}
                            {" · "}{batch.quantity?.toLocaleString() ?? 0} units
                            {batch.location_name ? ` · ${batch.location_name}` : ""}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onOpenScanner(row.id)}
            title="Scan barcode"
          >
            <ScanLine className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
      <TableCell className="text-right">
        {row.parentBatch ? (
          <span className={cn("font-medium", insufficient && "text-destructive")}>
            {parentAvailable.toLocaleString()}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={1}
          max={parentAvailable || undefined}
          value={row.units || ""}
          onChange={(event) =>
            onUpdate(row.id, { units: Number(event.target.value) || 0 })
          }
          className={cn("text-right", insufficient && "border-destructive")}
          placeholder="Units"
        />
      </TableCell>
      <TableCell>
        <StatusBadge row={row} insufficient={insufficient} />
      </TableCell>
      <TableCell>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(row.id)}
          disabled={row.status === "uploading"}
        >
          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function StatusBadge({ row, insufficient }: { row: TransplantRow; insufficient?: boolean }) {
  if (insufficient) {
    return (
      <Badge variant="destructive" className="text-xs">
        Exceeds stock
      </Badge>
    );
  }

  if (row.errors.length && row.status === "pending") {
    return (
      <Badge variant="outline" className="text-xs text-muted-foreground">
        {row.errors[0]}
      </Badge>
    );
  }

  switch (row.status) {
    case "pending":
      return <Badge variant="outline" className="text-xs">Ready</Badge>;
    case "uploading":
      return (
        <Badge variant="secondary" className="text-xs">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          Creating...
        </Badge>
      );
    case "success":
      return (
        <Badge variant="default" className="text-xs flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {row.message ?? "Done"}
        </Badge>
      );
    case "error":
      return (
        <Badge variant="destructive" className="text-xs flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {row.message ? truncate(row.message, 24) : "Failed"}
        </Badge>
      );
    default:
      return null;
  }
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}...`;
}
