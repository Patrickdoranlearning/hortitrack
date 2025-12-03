"use client";

import * as React from "react";
import { ReferenceDataContext } from "@/contexts/ReferenceDataContext";
import { ProductionAPI, type TransplantInput, type UUID } from "@/lib/production/client";
import { fetchJson, HttpError } from "@/lib/http/fetchJson";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, RefreshCw, FileSpreadsheet, AlertCircle, CheckCircle2, Copy, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  line?: number;
  parentBatchNumber: string;
  parentBatchId?: string;
  parentBatch?: ParentBatch;
  sizeName: string;
  locationName: string;
  containers: number;
  plantedAt?: string;
  notes?: string;
  sizeId?: string;
  locationId?: string;
  archiveParentIfEmpty: boolean;
  errors: string[];
  status: UploadStatus;
  message?: string;
};

const templateHeaders = ["parent_batch", "size", "location", "containers", "plantedAt", "notes", "archive_parent"] as const;

type Props = {
  onComplete?: () => void;
};

export default function BulkTransplantUpload({ onComplete }: Props) {
  const { data: referenceData, loading, error, reload } = React.useContext(ReferenceDataContext);
  const { toast } = useToast();
  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [rows, setRows] = React.useState<TransplantRow[]>([]);
  const [busy, setBusy] = React.useState<"parsing" | "uploading" | null>(null);
  const [defaults, setDefaults] = React.useState<{
    locationId?: string;
    sizeId?: string;
    plantedAt?: string;
    archiveParentIfEmpty: boolean;
  }>({ plantedAt: today, archiveParentIfEmpty: true });

  // Batch search state
  const [batchSearchResults, setBatchSearchResults] = React.useState<ParentBatch[]>([]);
  const [batchSearchLoading, setBatchSearchLoading] = React.useState(false);

  const sizeMap = React.useMemo(() => {
    const byName = new Map<string, { id: string; name: string; cell_multiple?: number }>();
    const byId = new Map<string, { name: string; cell_multiple?: number }>();
    referenceData?.sizes?.forEach((item) => {
      if (!item?.id || !item?.name) return;
      const key = normalize(item.name);
      byName.set(key, { id: item.id, name: item.name, cell_multiple: item.cell_multiple ?? undefined });
      byId.set(item.id, { name: item.name, cell_multiple: item.cell_multiple ?? undefined });
    });
    return { byName, byId };
  }, [referenceData]);

  const locationMap = React.useMemo(() => {
    const byName = new Map<string, { id: string; name: string }>();
    const byId = new Map<string, string>();
    referenceData?.locations?.forEach((item) => {
      if (!item?.id || !item?.name) return;
      const key = normalize(item.name);
      byName.set(key, { id: item.id, name: item.name });
      byId.set(item.id, item.name);
    });
    return { byName, byId };
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
    } catch (err) {
      console.error("[BulkTransplant] batch search error", err);
      setBatchSearchResults([]);
    } finally {
      setBatchSearchLoading(false);
    }
  }, []);

  const lookupBatchByNumber = React.useCallback(async (batchNumber: string): Promise<ParentBatch | null> => {
    if (!batchNumber) return null;
    try {
      const res = await fetchJson<{ items: ParentBatch[] }>(
        `/api/production/batches/search?q=${encodeURIComponent(batchNumber)}&pageSize=50`
      );
      const match = res.items?.find((b) => 
        b.batch_number.toLowerCase() === batchNumber.toLowerCase()
      );
      return match ?? null;
    } catch (err) {
      console.error("[BulkTransplant] batch lookup error", err);
      return null;
    }
  }, []);

  const updateRow = React.useCallback((id: string, patch: Partial<TransplantRow>) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...patch };
        return { ...next, errors: validateRow(next) };
      })
    );
  }, []);

  const removeRow = React.useCallback((id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  }, []);

  const addManualRow = React.useCallback(() => {
    const newRow: TransplantRow = {
      id: crypto.randomUUID?.() ?? `row-${Date.now()}`,
      parentBatchNumber: "",
      parentBatchId: undefined,
      parentBatch: undefined,
      sizeName: defaults.sizeId ? sizeMap.byId.get(defaults.sizeId)?.name ?? "" : "",
      locationName: defaults.locationId ? locationMap.byId.get(defaults.locationId) ?? "" : "",
      containers: 0,
      plantedAt: defaults.plantedAt,
      notes: "",
      sizeId: defaults.sizeId,
      locationId: defaults.locationId,
      archiveParentIfEmpty: defaults.archiveParentIfEmpty,
      errors: ["Missing parent batch", "Invalid containers"],
      status: "pending",
    };
    setRows((prev) => [...prev, newRow]);
  }, [defaults, sizeMap.byId, locationMap.byId]);

  const copyLastRow = React.useCallback(() => {
    if (!rows.length) {
      addManualRow();
      return;
    }
    const last = rows[rows.length - 1];
    const clone: TransplantRow = {
      ...last,
      id: crypto.randomUUID?.() ?? `row-${Date.now()}`,
      parentBatchNumber: "",
      parentBatchId: undefined,
      parentBatch: undefined,
      status: "pending",
      message: undefined,
      errors: ["Missing parent batch"],
    };
    setRows((prev) => [...prev, clone]);
  }, [rows, addManualRow]);

  const applyDefaultsToEmpty = React.useCallback(() => {
    setRows((prev) =>
      prev.map((row) => {
        const patch: Partial<TransplantRow> = {};
        if (!row.locationId && defaults.locationId) {
          patch.locationId = defaults.locationId;
          patch.locationName = locationMap.byId.get(defaults.locationId) ?? "";
        }
        if (!row.sizeId && defaults.sizeId) {
          patch.sizeId = defaults.sizeId;
          patch.sizeName = sizeMap.byId.get(defaults.sizeId)?.name ?? "";
        }
        if (!row.plantedAt && defaults.plantedAt) {
          patch.plantedAt = defaults.plantedAt;
        }
        if (!Object.keys(patch).length) return row;
        const next = { ...row, ...patch };
        return { ...next, errors: validateRow(next) };
      })
    );
  }, [defaults, locationMap.byId, sizeMap.byId]);

  async function handleFile(files: FileList | null) {
    if (!files?.length) return;
    const file = files[0];
    try {
      setBusy("parsing");
      const text = await file.text();
      const parsedRows = await parseTransplantCsv(text, {
        findSize: (name) => sizeMap.byName.get(normalize(name ?? ""))?.id ?? null,
        findLocation: (name) => locationMap.byName.get(normalize(name ?? ""))?.id ?? null,
        lookupBatch: lookupBatchByNumber,
      });
      setRows(parsedRows);
      if (!parsedRows.length) {
        toast({
          variant: "destructive",
          title: "No rows found",
          description: "The CSV file was empty or missing data rows.",
        });
      }
    } catch (err: any) {
      console.error("[BulkTransplantUpload] parse error", err);
      toast({
        variant: "destructive",
        title: "Failed to parse CSV",
        description: err?.message ?? "Please check the file and try again.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleUpload() {
    if (!readyCount) return;
    setBusy("uploading");
    let created = 0;
    let failed = 0;

    for (const row of rows) {
      if (row.errors.length || row.status === "success") continue;
      updateRow(row.id, { status: "uploading", message: undefined });
      try {
        const payload: TransplantInput = {
          parent_batch_id: row.parentBatchId as UUID,
          size_id: row.sizeId as UUID,
          location_id: row.locationId as UUID,
          containers: row.containers,
          planted_at: row.plantedAt || undefined,
          notes: row.notes || undefined,
          archive_parent_if_empty: row.archiveParentIfEmpty,
        };
        await ProductionAPI.transplant(payload);
        created += 1;
        updateRow(row.id, { status: "success", message: "Created" });
      } catch (err: any) {
        failed += 1;
        const description =
          err?.message ??
          err?.response?.data?.error ??
          "Failed to create transplant";
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

  const downloadTemplate = () => {
    const sample = [
      templateHeaders.join(","),
      'PROP-2025-0001,3L Pot,Tunnel 2,50,2025-03-15,"Moving to larger pots",true',
      'PROP-2025-0042,1L Pot,Field A,120,,',
    ].join("\n");
    const blob = new Blob([sample], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "transplant_bulk_template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resetRows = () => setRows([]);

  if (loading && !referenceData) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
        Loading reference data…
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
      {rows.length === 0 ? (
        <Card className="border-primary/30">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg">Review & edit rows</CardTitle>
                <CardDescription>
                  {readyCount} ready • {successCount} created • {errorCount} failed
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={addManualRow}>
                  Add blank row
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={copyLastRow} disabled>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy last
                </Button>
              </div>
            </div>
            <DefaultsPanel
              defaults={defaults}
              referenceData={referenceData}
              setDefaults={setDefaults}
              applyDefaultsToEmpty={applyDefaultsToEmpty}
            />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-2xl border bg-background text-sm shadow-sm">
              <div className="grid grid-cols-[48px_minmax(0,1.2fr)_repeat(3,minmax(0,1fr))_120px_140px] items-center gap-3 border-b px-6 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>#</span>
                <span>Parent batch</span>
                <span>Size</span>
                <span>Location</span>
                <span>Containers</span>
                <span>Date</span>
                <span className="text-right">Actions</span>
              </div>
              <div className="px-6 py-10 text-center text-muted-foreground">
                <p className="text-sm font-medium">No rows yet</p>
                <p className="text-xs mt-1">Upload a CSV or start logging transplants below.</p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  <Button size="sm" onClick={addManualRow}>Add blank row</Button>
                  <Button size="sm" variant="outline" disabled>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy last
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-primary/30 overflow-hidden">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg">Review & edit rows</CardTitle>
                <CardDescription>
                  {readyCount} ready • {successCount} created • {errorCount} failed
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={addManualRow}>
                  Add blank row
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={copyLastRow} disabled={!rows.length}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy last
                </Button>
              </div>
            </div>
            <DefaultsPanel
              defaults={defaults}
              referenceData={referenceData}
              setDefaults={setDefaults}
              applyDefaultsToEmpty={applyDefaultsToEmpty}
            />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="rounded-2xl border bg-card overflow-x-auto shadow-sm">
              <Table className="min-w-[960px] text-sm">
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[40px]">#</TableHead>
                    <TableHead className="min-w-[260px]">Parent Batch</TableHead>
                    <TableHead className="w-[140px] text-right">Containers</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[90px] text-center">Archive</TableHead>
                    <TableHead className="w-[140px]">Status</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TransplantTableRow
                      key={row.id}
                      row={row}
                      index={index}
                      referenceData={referenceData}
                      sizeMap={sizeMap}
                      locationMap={locationMap}
                      onUpdate={updateRow}
                      onRemove={removeRow}
                      onSearchBatches={searchBatches}
                      batchSearchResults={batchSearchResults}
                      batchSearchLoading={batchSearchLoading}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={handleUpload} disabled={!readyCount || busy === "uploading"}>
                {busy === "uploading" ? "Uploading…" : "Start upload"}
              </Button>
              <p className="text-xs text-muted-foreground">Rows with validation errors are skipped automatically.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Bulk transplant via CSV
          </CardTitle>
          <CardDescription>
            Download the template, fill it in Excel, Numbers, or Google Sheets, then upload or edit rows inline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Download template
            </Button>
            <label className="inline-flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/60 cursor-pointer">
              <Upload className="h-4 w-4" />
              {busy === "parsing" ? "Parsing…" : "Choose CSV"}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => handleFile(event.target.files)}
                disabled={busy === "parsing" || busy === "uploading"}
              />
            </label>
            {rows.length > 0 && (
              <Button type="button" variant="ghost" onClick={resetRows}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Clear table
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Required columns: <code>parent_batch</code>, <code>size</code>, <code>location</code>, <code>containers</code>. Optional: <code>plantedAt</code> (YYYY-MM-DD), <code>notes</code>, <code>archive_parent</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

type ReferenceDataType = {
  varieties: Array<{ id?: string; name?: string }>;
  sizes: Array<{ id?: string; name?: string; cell_multiple?: number | null }>;
  locations: Array<{ id?: string; name?: string; nursery_site?: string | null }>;
  suppliers: Array<{ id?: string; name?: string }>;
};

function DefaultsPanel({
  defaults,
  referenceData,
  setDefaults,
  applyDefaultsToEmpty,
}: {
  defaults: {
    locationId?: string;
    sizeId?: string;
    plantedAt?: string;
    archiveParentIfEmpty: boolean;
  };
  referenceData: ReferenceDataType;
  setDefaults: React.Dispatch<
    React.SetStateAction<{
      locationId?: string;
      sizeId?: string;
      plantedAt?: string;
      archiveParentIfEmpty: boolean;
    }>
  >;
  applyDefaultsToEmpty: () => void;
}) {
  return (
    <div className="rounded-2xl border bg-muted/30 p-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            New location
          </Label>
          <Select
            value={defaults.locationId ?? "none"}
            onValueChange={(value) =>
              setDefaults((prev) => ({ ...prev, locationId: value === "none" ? undefined : value }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No default</SelectItem>
              {referenceData.locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id!}>
                  {loc.nursery_site ? `${loc.nursery_site} · ` : ""}
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            New size
          </Label>
          <Select
            value={defaults.sizeId ?? "none"}
            onValueChange={(value) =>
              setDefaults((prev) => ({ ...prev, sizeId: value === "none" ? undefined : value }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No default</SelectItem>
              {referenceData.sizes.map((size) => (
                <SelectItem key={size.id} value={size.id!}>
                  {size.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Transplant date
          </Label>
          <Input
            type="date"
            value={defaults.plantedAt ?? ""}
            onChange={(event) =>
              setDefaults((prev) => ({ ...prev, plantedAt: event.target.value || undefined }))
            }
          />
        </div>

        <div className="flex flex-col justify-between gap-2 rounded-xl border border-dashed border-primary/40 p-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="default-archive"
              checked={defaults.archiveParentIfEmpty}
              onCheckedChange={(v) =>
                setDefaults((prev) => ({ ...prev, archiveParentIfEmpty: Boolean(v) }))
              }
            />
            <Label htmlFor="default-archive" className="text-sm font-medium">
              Archive parent when empty
            </Label>
          </div>
          <Button size="sm" variant="outline" className="w-full" onClick={applyDefaultsToEmpty}>
            Apply defaults to empty rows
          </Button>
        </div>
      </div>
    </div>
  );
}

// Separate row component to handle batch search state per row
function TransplantTableRow({
  row,
  index,
  referenceData,
  sizeMap,
  locationMap,
  onUpdate,
  onRemove,
  onSearchBatches,
  batchSearchResults,
  batchSearchLoading,
}: {
  row: TransplantRow;
  index: number;
  referenceData: ReferenceDataType;
  sizeMap: { byName: Map<string, { id: string; name: string }>; byId: Map<string, { name: string; cell_multiple?: number }> };
  locationMap: { byName: Map<string, { id: string; name: string }>; byId: Map<string, string> };
  onUpdate: (id: string, patch: Partial<TransplantRow>) => void;
  onRemove: (id: string) => void;
  onSearchBatches: (query: string) => void;
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
      parentBatchNumber: batch.batch_number,
      parentBatch: batch,
    });
    setBatchOpen(false);
    setSearchQuery("");
  }, [row.id, onUpdate]);

  const selectedSize = sizeMap.byId.get(row.sizeId ?? "");
  const cellMultiple = selectedSize?.cell_multiple ?? 1;
  const computedUnits = row.containers > 0 ? row.containers * cellMultiple : 0;
  const parentAvailable = row.parentBatch?.quantity ?? 0;
  const insufficient = row.parentBatchId && computedUnits > parentAvailable;

  return (
    <TableRow className={row.status === "error" || insufficient ? "bg-destructive/5" : undefined}>
      <TableCell className="font-mono text-xs text-muted-foreground">{index + 1}</TableCell>
      <TableCell>
        <div className="space-y-2">
          <Popover open={batchOpen} onOpenChange={setBatchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={batchOpen}
                className="w-full justify-start font-normal"
              >
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                {row.parentBatch ? (
                  <span className="truncate">
                    {row.parentBatch.batch_number}
                    <span className="ml-2 text-muted-foreground text-xs">
                      ({row.parentBatch.variety_name ?? "?"} • {parentAvailable} units)
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Search batch…</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Search by batch number or variety…"
                  value={searchQuery}
                  onValueChange={handleBatchSearch}
                />
                <CommandList>
                  {batchSearchLoading ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      Searching…
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
                              {batch.variety_name ?? "—"} • {batch.quantity?.toLocaleString() ?? 0} units
                              {batch.location_name ? ` • ${batch.location_name}` : ""}
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
          <p className="text-xs text-muted-foreground">
            {row.sizeName || "Size—"} · {row.locationName || "Location—"} · {row.plantedAt || "Date—"}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <Input
            type="number"
            min={1}
            value={row.containers || ""}
            onChange={(event) =>
              onUpdate(row.id, { containers: Number(event.target.value) || 0 })
            }
            className="text-right"
          />
          {row.sizeId && row.containers > 0 && (
            <p className="text-xs text-muted-foreground text-right">
              = {computedUnits.toLocaleString()} units
            </p>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Input
          placeholder="Notes"
          value={row.notes ?? ""}
          onChange={(event) => onUpdate(row.id, { notes: event.target.value || undefined })}
        />
      </TableCell>
      <TableCell className="text-center">
        <Checkbox
          checked={row.archiveParentIfEmpty}
          onCheckedChange={(v) => onUpdate(row.id, { archiveParentIfEmpty: Boolean(v) })}
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
        Insufficient stock
      </Badge>
    );
  }

  if (row.errors.length && row.status === "pending") {
    return (
      <Badge variant="destructive" className="text-xs">
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
          Uploading…
        </Badge>
      );
    case "success":
      return (
        <Badge variant="default" className="text-xs flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" /> Done
        </Badge>
      );
    case "error":
      return (
        <Badge variant="destructive" className="text-xs flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {row.message ? truncate(row.message, 32) : "Failed"}
        </Badge>
      );
    default:
      return null;
  }
}

function normalize(value: string) {
  return value?.trim().toLowerCase() ?? "";
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

type LookupHelpers = {
  findSize: (name: string) => string | null;
  findLocation: (name: string) => string | null;
  lookupBatch: (batchNumber: string) => Promise<ParentBatch | null>;
};

async function parseTransplantCsv(text: string, helpers: LookupHelpers): Promise<TransplantRow[]> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const headers = parseLine(lines[0]).map((h) => h.trim());
  const normalizedHeaders = headers.map((h) => normalize(h));

  const requiredHeaders = ["parent_batch", "size", "location", "containers"];
  const missing = requiredHeaders.filter((required) => !normalizedHeaders.includes(required.replace("_", "")));
  // be flexible with header names
  const hasParentBatch = normalizedHeaders.some(h => 
    h === "parent_batch" || h === "parentbatch" || h === "parent" || h === "batch"
  );
  if (!hasParentBatch) {
    throw new Error(`Missing required column: parent_batch`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const parsed: TransplantRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const values = parseLine(line);
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[normalize(header)] = values[index]?.trim() ?? "";
    });

    const parentBatchNumber = record["parent_batch"] || record["parentbatch"] || record["parent"] || record["batch"] || "";
    const sizeName = record["size"] || record["container"] || "";
    const locationName = record["location"] || record["locationname"] || "";
    const containersRaw = record["containers"] || record["quantity"] || "";
    const plantedAt = record["plantedat"] || record["planted_at"] || record["date"] || "";
    const notes = record["notes"] || record["comments"] || "";
    const archiveParentRaw = record["archive_parent"] || record["archiveparent"] || record["archive"] || "true";

    const rowId = crypto.randomUUID?.() ?? `row-${i}-${Date.now()}`;
    const sizeId = sizeName ? helpers.findSize(sizeName) : null;
    const locationId = locationName ? helpers.findLocation(locationName) : null;
    const parentBatch = parentBatchNumber ? await helpers.lookupBatch(parentBatchNumber) : null;
    const containers = Number(containersRaw.replaceAll(",", ""));
    const archiveParentIfEmpty = archiveParentRaw.toLowerCase() !== "false" && archiveParentRaw !== "0";

    const parsedRow: TransplantRow = {
      id: rowId,
      line: i + 1,
      parentBatchNumber: parentBatchNumber || "—",
      parentBatchId: parentBatch?.id ?? undefined,
      parentBatch: parentBatch ?? undefined,
      sizeName: sizeName || "—",
      locationName: locationName || "—",
      containers: Number.isFinite(containers) ? Math.floor(containers) : 0,
      plantedAt: plantedAt || today,
      notes: notes || "",
      sizeId: sizeId ?? undefined,
      locationId: locationId ?? undefined,
      archiveParentIfEmpty,
      errors: [],
      status: "pending",
    };

    parsedRow.errors = validateRow(parsedRow);
    parsed.push(parsedRow);
  }

  return parsed;
}

function parseLine(line: string): string[] {
  const pattern = /("([^"]|"")*"|[^",]+|)(?=,|$)/g;
  const matches = line.match(pattern);
  if (!matches) return [];
  return matches.map((value) => value.replace(/^"|"$/g, "").replace(/""/g, '"').trim());
}

function validateRow(row: TransplantRow): string[] {
  const issues: string[] = [];
  if (!row.parentBatchId) issues.push("Missing parent batch");
  if (!row.sizeId) issues.push("Missing size");
  if (!row.locationId) issues.push("Missing location");
  if (!Number.isFinite(row.containers) || row.containers <= 0) issues.push("Invalid containers");
  if (row.plantedAt && !/^\d{4}-\d{2}-\d{2}$/.test(row.plantedAt)) issues.push("Bad date");
  return issues;
}

