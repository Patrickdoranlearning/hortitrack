"use client";

import * as React from "react";
import { ReferenceDataContext } from "@/contexts/ReferenceDataContext";
import { ProductionAPI } from "@/lib/production/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, RefreshCw, FileSpreadsheet, AlertCircle, CheckCircle2, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SelectWithCreate } from "@/components/ui/select-with-create";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";

type UploadStatus = "pending" | "uploading" | "success" | "error";

type UploadRow = {
  id: string;
  line?: number;
  varietyName: string;
  sizeName: string;
  locationName: string;
  containers: number;
  plantedAt?: string;
  notes?: string;
  varietyId?: string;
  sizeId?: string;
  locationId?: string;
  errors: string[];
  status: UploadStatus;
  message?: string;
};

const templateHeaders = ["variety", "size", "location", "containers", "plantedAt", "notes"] as const;

type Props = {
  onComplete?: () => void;
};

export default function BulkPropagationUpload({ onComplete }: Props) {
  const { data: referenceData, loading, error, reload } = React.useContext(ReferenceDataContext);
  const { toast } = useToast();
  
  // Auto-refresh reference data when user returns from creating a new entity in another tab
  useRefreshOnFocus(reload);
  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [rows, setRows] = React.useState<UploadRow[]>([]);
  const [busy, setBusy] = React.useState<"parsing" | "uploading" | null>(null);
  const [defaults, setDefaults] = React.useState<{
    locationId?: string;
    sizeId?: string;
    plantedAt?: string;
  }>({ plantedAt: today });

  const varietyMap = React.useMemo(() => {
    const byName = new Map<string, { id: string; name: string }>();
    const byId = new Map<string, string>();
    referenceData?.varieties?.forEach((item) => {
      if (!item?.id || !item?.name) return;
      const key = normalize(item.name);
      byName.set(key, { id: item.id, name: item.name });
      byId.set(item.id, item.name);
    });
    return { byName, byId };
  }, [referenceData]);

  const sizeMap = React.useMemo(() => {
    const byName = new Map<string, { id: string; name: string }>();
    const byId = new Map<string, string>();
    const byIdFull = new Map<string, any>();
    referenceData?.sizes?.forEach((item) => {
      if (!item?.id || !item?.name) return;
      const key = normalize(item.name);
      byName.set(key, { id: item.id, name: item.name });
      byId.set(item.id, item.name);
      byIdFull.set(item.id, item);
    });
    return { byName, byId, byIdFull };
  }, [referenceData]);

  const sortedSizes = React.useMemo(() => {
    const s = [...(referenceData?.sizes ?? [])];
    return s.sort((a, b) => {
      const isAProp = a.container_type === "prop_tray";
      const isBProp = b.container_type === "prop_tray";
      if (isAProp && !isBProp) return -1;
      if (!isAProp && isBProp) return 1;

      const isAPlug = a.container_type === "plug_tray";
      const isBPlug = b.container_type === "plug_tray";
      if (isAPlug && !isBPlug) return -1;
      if (!isAPlug && isBPlug) return 1;

      return a.name.localeCompare(b.name);
    });
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
    }));
  }, [referenceData, today]);

  const readyCount = React.useMemo(
    () => rows.filter((row) => !row.errors.length && row.status === "pending").length,
    [rows]
  );
  const successCount = rows.filter((row) => row.status === "success").length;
  const errorCount = rows.filter((row) => row.status === "error").length;

  const updateRow = React.useCallback((id: string, patch: Partial<UploadRow>) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...patch };
        return { ...next, errors: validateRow(next) };
      })
    );
  }, []);

  const addManualRow = React.useCallback(() => {
    const newRow: UploadRow = {
      id: crypto.randomUUID?.() ?? `row-${Date.now()}`,
      varietyName: "",
      sizeName: defaults.sizeId ? sizeMap.byId.get(defaults.sizeId) ?? "" : "",
      locationName: defaults.locationId ? locationMap.byId.get(defaults.locationId) ?? "" : "",
      containers: 0,
      plantedAt: defaults.plantedAt,
      notes: "",
      varietyId: undefined,
      sizeId: defaults.sizeId,
      locationId: defaults.locationId,
      errors: ["Missing variety", "Invalid containers"],
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
    const clone: UploadRow = {
      ...last,
      id: crypto.randomUUID?.() ?? `row-${Date.now()}`,
      status: "pending",
      message: undefined,
      errors: validateRow(last),
    };
    setRows((prev) => [...prev, clone]);
  }, [rows, addManualRow]);

  const applyDefaultsToEmpty = React.useCallback(() => {
    setRows((prev) =>
      prev.map((row) => {
        const patch: Partial<UploadRow> = {};
        if (!row.locationId && defaults.locationId) {
          patch.locationId = defaults.locationId;
          patch.locationName = locationMap.byId.get(defaults.locationId) ?? "";
        }
        if (!row.sizeId && defaults.sizeId) {
          patch.sizeId = defaults.sizeId;
          patch.sizeName = sizeMap.byId.get(defaults.sizeId) ?? "";
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
      const parsedRows = parsePropagationCsv(text, {
        findVariety: (name) => varietyMap.byName.get(normalize(name ?? ""))?.id ?? null,
        findSize: (name) => sizeMap.byName.get(normalize(name ?? ""))?.id ?? null,
        findLocation: (name) => locationMap.byName.get(normalize(name ?? ""))?.id ?? null,
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
      console.error("[BulkPropagationUpload] parse error", err);
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
        await ProductionAPI.propagate({
          plant_variety_id: row.varietyId!,
          size_id: row.sizeId!,
          location_id: row.locationId!,
          containers: row.containers,
          planted_at: row.plantedAt || undefined,
          notes: row.notes || undefined,
        });
        created += 1;
        updateRow(row.id, { status: "success", message: "Created" });
      } catch (err: any) {
        failed += 1;
        const description =
          err?.message ??
          err?.response?.data?.error ??
          "Failed to create batch";
        updateRow(row.id, {
          status: "error",
          message: description,
        });
      }
    }

    toast({
      title: "Bulk propagation finished",
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
      'Kramers Red 273,1 Litre,Tunnel 1,40,2025-03-01,"Bottom heat for 48h"',
      'Erica Carnea,Trio Pot,Field A,120,,',
    ].join("\n");
    const blob = new Blob([sample], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "propagation_bulk_template.csv";
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
          <span>{error ?? "We couldn’t load varieties, sizes, or locations."}</span>
          <Button size="sm" variant="outline" onClick={reload}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Bulk propagate via CSV
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
            Required columns: <code>variety</code>, <code>size</code>, <code>location</code>, <code>containers</code>. Optional: <code>plantedAt</code> (YYYY-MM-DD) and <code>notes</code>.
          </p>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card className="border-primary/30">
          <CardHeader className="space-y-2">
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
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
              <SelectWithCreate
                className="w-48"
                options={referenceData.locations.map((loc) => ({
                  value: loc.id!,
                  label: (loc.nursery_site ? `${loc.nursery_site} · ` : "") + loc.name,
                }))}
                value={defaults.locationId ?? "none"}
                onValueChange={(value) =>
                  setDefaults((prev) => ({ ...prev, locationId: value === "none" ? undefined : value }))
                }
                createHref="/locations"
                placeholder="Default location"
                createLabel="Add new location"
                emptyLabel="No default location"
                emptyValue="none"
              />

              <SelectWithCreate
                className="w-48"
                options={sortedSizes.map((size) => ({
                  value: size.id!,
                  label: size.name,
                  badge: size.container_type === "prop_tray" ? (
                    <Badge variant="outline" className="ml-2 bg-primary/5 text-[10px] uppercase tracking-wider py-0 px-1 border-primary/20 text-primary">
                      Prop
                    </Badge>
                  ) : undefined,
                }))}
                value={defaults.sizeId ?? "none"}
                onValueChange={(value) =>
                  setDefaults((prev) => ({ ...prev, sizeId: value === "none" ? undefined : value }))
                }
                createHref="/sizes"
                placeholder="Default size"
                createLabel="Add new size"
                emptyLabel="No default size"
                emptyValue="none"
              />

              <Input
                type="date"
                className="w-48"
                value={defaults.plantedAt ?? ""}
                onChange={(event) =>
                  setDefaults((prev) => ({ ...prev, plantedAt: event.target.value || undefined }))
                }
              />
              <Button type="button" size="sm" variant="outline" onClick={applyDefaultsToEmpty}>
                Apply defaults to empty rows
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <p>No rows yet. Upload a CSV or add rows manually.</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={addManualRow}>
                  Add blank row
                </Button>
                <Button size="sm" variant="outline" disabled>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy last
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-primary/30 overflow-hidden">
          <CardHeader className="space-y-2">
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
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
              <SelectWithCreate
                className="w-48"
                options={referenceData.locations.map((loc) => ({
                  value: loc.id!,
                  label: (loc.nursery_site ? `${loc.nursery_site} · ` : "") + loc.name,
                }))}
                value={defaults.locationId ?? "none"}
                onValueChange={(value) =>
                  setDefaults((prev) => ({ ...prev, locationId: value === "none" ? undefined : value }))
                }
                createHref="/locations"
                placeholder="Default location"
                createLabel="Add new location"
                emptyLabel="No default location"
                emptyValue="none"
              />

              <SelectWithCreate
                className="w-48"
                options={sortedSizes.map((size) => ({
                  value: size.id!,
                  label: size.name,
                  badge: size.container_type === "prop_tray" ? (
                    <Badge variant="outline" className="ml-2 bg-primary/5 text-[10px] uppercase tracking-wider py-0 px-1 border-primary/20 text-primary">
                      Prop
                    </Badge>
                  ) : undefined,
                }))}
                value={defaults.sizeId ?? "none"}
                onValueChange={(value) =>
                  setDefaults((prev) => ({ ...prev, sizeId: value === "none" ? undefined : value }))
                }
                createHref="/sizes"
                placeholder="Default size"
                createLabel="Add new size"
                emptyLabel="No default size"
                emptyValue="none"
              />

              <Input
                type="date"
                className="w-48"
                value={defaults.plantedAt ?? ""}
                onChange={(event) =>
                  setDefaults((prev) => ({ ...prev, plantedAt: event.target.value || undefined }))
                }
              />
              <Button type="button" size="sm" variant="outline" onClick={applyDefaultsToEmpty}>
                Apply defaults to empty rows
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="rounded-lg border bg-card overflow-x-auto">
              <Table className="min-w-[1000px] text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">#</TableHead>
                    <TableHead>Variety</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="w-[150px] text-right">Containers</TableHead>
                    <TableHead className="w-[150px]">Planted date</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={row.id} className={row.status === "error" ? "bg-destructive/5" : undefined}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="max-w-[220px]">
                        <SelectWithCreate
                          options={referenceData.varieties.map((variety) => ({
                            value: variety.id!,
                            label: variety.name,
                          }))}
                          value={row.varietyId ?? "none"}
                          onValueChange={(value) => {
                            if (value === "none") {
                              updateRow(row.id, { varietyId: undefined, varietyName: "" });
                              return;
                            }
                            updateRow(row.id, { varietyId: value, varietyName: varietyMap.byId.get(value) ?? "" });
                          }}
                          createHref="/varieties"
                          placeholder="Pick variety"
                          createLabel="Add new variety"
                          emptyLabel="—"
                          emptyValue="none"
                        />
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <SelectWithCreate
                          options={sortedSizes.map((size) => ({
                            value: size.id!,
                            label: size.name,
                            badge: size.container_type === "prop_tray" ? (
                              <Badge variant="outline" className="ml-2 bg-primary/5 text-[10px] uppercase tracking-wider py-0 px-1 border-primary/20 text-primary">
                                Prop
                              </Badge>
                            ) : undefined,
                          }))}
                          value={row.sizeId ?? "none"}
                          onValueChange={(value) => {
                            if (value === "none") {
                              updateRow(row.id, { sizeId: undefined, sizeName: "" });
                              return;
                            }
                            updateRow(row.id, { sizeId: value, sizeName: sizeMap.byId.get(value) ?? "" });
                          }}
                          createHref="/sizes"
                          placeholder="Pick size"
                          createLabel="Add new size"
                          emptyLabel="—"
                          emptyValue="none"
                        />
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <SelectWithCreate
                          options={referenceData.locations.map((loc) => ({
                            value: loc.id!,
                            label: (loc.nursery_site ? `${loc.nursery_site} · ` : "") + loc.name,
                          }))}
                          value={row.locationId ?? "none"}
                          onValueChange={(value) => {
                            if (value === "none") {
                              updateRow(row.id, { locationId: undefined, locationName: "" });
                              return;
                            }
                            updateRow(row.id, { locationId: value, locationName: locationMap.byId.get(value) ?? "" });
                          }}
                          createHref="/locations"
                          placeholder="Pick location"
                          createLabel="Add new location"
                          emptyLabel="—"
                          emptyValue="none"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 items-end">
                          <Input
                            type="number"
                            min={1}
                            value={row.containers || ""}
                            onChange={(event) =>
                              updateRow(row.id, { containers: Number(event.target.value) || 0 })
                            }
                            className="text-right"
                          />
                          {row.containers > 0 && row.sizeId && (
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              Total: {(row.containers * (sizeMap.byIdFull.get(row.sizeId)?.cell_multiple ?? 1)).toLocaleString()} plants
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={row.plantedAt ?? ""}
                          onChange={(event) =>
                            updateRow(row.id, { plantedAt: event.target.value || undefined })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Notes"
                          value={row.notes ?? ""}
                          onChange={(event) => updateRow(row.id, { notes: event.target.value || undefined })}
                        />
                      </TableCell>
                      <TableCell>
                        <StatusBadge row={row} />
                      </TableCell>
                    </TableRow>
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
    </div>
  );
}

function StatusBadge({ row }: { row: UploadRow }) {
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
  findVariety: (name: string) => string | null;
  findSize: (name: string) => string | null;
  findLocation: (name: string) => string | null;
};

function parsePropagationCsv(text: string, helpers: LookupHelpers): UploadRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const headers = parseLine(lines[0]).map((h) => h.trim());
  const normalizedHeaders = headers.map((h) => normalize(h));

  const requiredHeaders = ["variety", "size", "location", "containers"];
  const missing = requiredHeaders.filter((required) => !normalizedHeaders.includes(required));
  if (missing.length) {
    throw new Error(`Missing required columns: ${missing.join(", ")}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const parsed: UploadRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const values = parseLine(line);
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[normalize(header)] = values[index]?.trim() ?? "";
    });

    const varietyName = record["variety"] || record["varietyname"] || "";
    const sizeName = record["size"] || record["container"] || "";
    const locationName = record["location"] || record["locationname"] || "";
    const containersRaw = record["containers"] || record["quantity"] || "";
    const plantedAt = record["plantedat"] || record["planted_at"] || "";
    const notes = record["notes"] || record["comments"] || "";

    const rowId = crypto.randomUUID?.() ?? `row-${i}-${Date.now()}`;
    const varietyId = varietyName ? helpers.findVariety(varietyName) : null;
    const sizeId = sizeName ? helpers.findSize(sizeName) : null;
    const locationId = locationName ? helpers.findLocation(locationName) : null;

    const containers = Number(containersRaw.replaceAll(",", ""));

    const parsedRow: UploadRow = {
      id: rowId,
      line: i + 1,
      varietyName: varietyName || "—",
      sizeName: sizeName || "—",
      locationName: locationName || "—",
      containers: Number.isFinite(containers) ? Math.floor(containers) : 0,
      plantedAt: plantedAt || today,
      notes: notes || "",
      varietyId: varietyId ?? undefined,
      sizeId: sizeId ?? undefined,
      locationId: locationId ?? undefined,
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

function validateRow(row: UploadRow): string[] {
  const issues: string[] = [];
  if (!row.varietyId) issues.push("Missing variety");
  if (!row.sizeId) issues.push("Missing size");
  if (!row.locationId) issues.push("Missing location");
  if (!Number.isFinite(row.containers) || row.containers <= 0) issues.push("Invalid containers");
  if (row.plantedAt && !/^\d{4}-\d{2}-\d{2}$/.test(row.plantedAt)) issues.push("Bad date");
  return issues;
}

