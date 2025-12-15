"use client";

import * as React from "react";
import { ReferenceDataContext } from "@/contexts/ReferenceDataContext";
import { ProductionAPI, type MultiTransplantInput } from "@/lib/production/client";
import { fetchJson } from "@/lib/http/fetchJson";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Trash2 } from "lucide-react";
import { MaterialConsumptionPreview } from "@/components/materials/MaterialConsumptionPreview";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type Status = "pending" | "uploading" | "success" | "error";

type ParentBatch = {
  id: string;
  batch_number: string;
  variety_name: string | null;
  size_name: string | null;
  location_name: string | null;
  quantity: number | null;
};

type ParentRow = {
  id: string;
  parentBatchId?: string;
  parentBatch?: ParentBatch;
  units: number;
  notes?: string;
  archiveWhenEmpty: boolean;
  errors: string[];
  status: Status;
  message?: string;
};

export default function MultiParentTransplantBuilder() {
  const { data: referenceData, loading, error, reload } = React.useContext(ReferenceDataContext);
  const { toast } = useToast();

  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [child, setChild] = React.useState({
    varietyId: "",
    sizeId: "",
    locationId: "",
    packs: 1,
    unitsPerPack: 6,
    plantedAt: today,
    notes: "",
  });
  const [rows, setRows] = React.useState<ParentRow[]>([]);
  const [busy, setBusy] = React.useState<"submitting" | null>(null);
  const [searchResults, setSearchResults] = React.useState<ParentBatch[]>([]);
  const [searchLoading, setSearchLoading] = React.useState(false);

  const requiredUnits = React.useMemo(() => {
    if (!child.packs || !child.unitsPerPack) return 0;
    return child.packs * child.unitsPerPack;
  }, [child.packs, child.unitsPerPack]);

  const contributedUnits = React.useMemo(() => rows.reduce((acc, row) => acc + (row.units || 0), 0), [rows]);

  // Material consumption preview data
  const consumptionBatches = React.useMemo(() => {
    if (!child.sizeId || requiredUnits <= 0) return [];
    const selectedSize = referenceData?.sizes?.find((s) => s.id === child.sizeId);
    if (!selectedSize) return [];
    return [{
      batchId: 'new-multi-transplant',
      sizeId: child.sizeId,
      sizeName: selectedSize.name,
      quantity: requiredUnits,
    }];
  }, [child.sizeId, requiredUnits, referenceData?.sizes]);

  const ready =
    Boolean(child.varietyId && child.sizeId && child.locationId) &&
    requiredUnits > 0 &&
    contributedUnits === requiredUnits &&
    rows.length > 0 &&
    rows.every((row) => row.errors.length === 0) &&
    busy !== "submitting";

  React.useEffect(() => {
    if (!rows.length) {
      addRow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = React.useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetchJson<{ items: ParentBatch[] }>(
        `/api/production/batches/search?q=${encodeURIComponent(query)}&status=Growing&pageSize=20`
      );
      setSearchResults(res.items ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        id: crypto.randomUUID?.() ?? `row-${Date.now()}`,
        units: 0,
        archiveWhenEmpty: false,
        errors: ["Select parent", "Units required"],
        status: "pending",
      },
    ]);
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((row) => row.id !== id));
  }

  function updateRow(id: string, patch: Partial<ParentRow>) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...patch };
        return { ...next, errors: validateRow(next) };
      })
    );
  }

  function validateRow(row: ParentRow) {
    const issues: string[] = [];
    if (!row.parentBatchId) issues.push("Select parent batch");
    if (!Number.isFinite(row.units) || row.units <= 0) issues.push("Units required");
    if (row.parentBatch?.quantity != null && row.units > row.parentBatch.quantity) issues.push("Insufficient units");
    return issues;
  }

  async function handleSubmit() {
    if (!ready || !referenceData) return;
    setBusy("submitting");
    try {
      const payload: MultiTransplantInput = {
        child: {
          plant_variety_id: child.varietyId as any,
          size_id: child.sizeId as any,
          location_id: child.locationId as any,
          packs: child.packs,
          units_per_pack: child.unitsPerPack,
          planted_at: child.plantedAt || undefined,
          notes: child.notes || undefined,
        },
        parents: rows.map((row) => ({
          parent_batch_id: row.parentBatchId as any,
          units: row.units,
          notes: row.notes || undefined,
          archive_parent_if_empty: row.archiveWhenEmpty,
        })),
      };
      const res = await ProductionAPI.multiTransplant(payload);
      toast({
        title: "Multi-parent transplant created",
        description: `Batch ${res.child_batch?.batch_number ?? ""} assembled successfully.`,
      });
      setRows([]);
      addRow();
    } catch (err) {
      toast({
        title: "Failed to create transplant",
        description: err instanceof Error ? err.message : "Check the inputs and try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  if (loading && !referenceData) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-muted-foreground">
        Loading reference data…
      </div>
    );
  }

  if (!referenceData) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Reference data unavailable</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3">
          <span>{error ?? "Unable to load varieties, sizes, or locations."}</span>
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
        <CardHeader>
          <CardTitle>Target product</CardTitle>
          <CardDescription>Define the batch you’re creating from multiple parent batches.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <Label>Product variety</Label>
            <Select value={child.varietyId} onValueChange={(value) => setChild((prev) => ({ ...prev, varietyId: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select variety" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {referenceData.varieties?.map((variety) => (
                  <SelectItem key={variety.id} value={variety.id!}>
                    {variety.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Finished size</Label>
            <Select value={child.sizeId} onValueChange={(value) => setChild((prev) => ({ ...prev, sizeId: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {referenceData.sizes?.map((size) => (
                  <SelectItem key={size.id} value={size.id!}>
                    {size.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Target location</Label>
            <Select
              value={child.locationId}
              onValueChange={(value) => setChild((prev) => ({ ...prev, locationId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {referenceData.locations?.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id!}>
                    {loc.nursery_site ? `${loc.nursery_site} · ` : ""}
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Transplant date</Label>
            <Input
              type="date"
              value={child.plantedAt ?? ""}
              onChange={(event) => setChild((prev) => ({ ...prev, plantedAt: event.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <Label>Packs to build</Label>
            <Input
              type="number"
              min={1}
              value={child.packs}
              onChange={(event) => setChild((prev) => ({ ...prev, packs: Number(event.target.value) || 0 }))}
            />
          </div>

          <div className="space-y-1">
            <Label>Units per pack</Label>
            <Input
              type="number"
              min={1}
              value={child.unitsPerPack}
              onChange={(event) =>
                setChild((prev) => ({ ...prev, unitsPerPack: Number(event.target.value) || 0 }))
              }
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <Label>Notes</Label>
            <Input
              placeholder="Optional notes"
              value={child.notes}
              onChange={(event) => setChild((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </div>

          <div className="flex flex-col justify-center rounded-lg border bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">Required units</p>
            <p className="text-2xl font-semibold">{requiredUnits.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">
              {child.packs.toLocaleString()} packs × {child.unitsPerPack.toLocaleString()} units
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Material consumption preview */}
      {consumptionBatches.length > 0 && (
        <MaterialConsumptionPreview batches={consumptionBatches} />
      )}

      <Card className="border-primary/30 overflow-hidden">
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Parent contributions</CardTitle>
              <CardDescription>
                {contributedUnits.toLocaleString()} of {requiredUnits.toLocaleString()} units allocated
              </CardDescription>
            </div>
            <Button type="button" onClick={addRow}>
              <Plus className="mr-2 h-4 w-4" /> Add parent row
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table className="min-w-[900px] text-sm">
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[40px]">#</TableHead>
                  <TableHead className="min-w-[240px]">Parent batch</TableHead>
                  <TableHead className="w-[160px] text-right">Units</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-[120px] text-center">Archive empty</TableHead>
                  <TableHead className="w-[160px]">Status</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={row.id} className={row.errors.length ? "bg-destructive/5" : undefined}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{index + 1}</TableCell>
                    <TableCell>
                      <ParentBatchPicker
                        row={row}
                        onSelect={(batch) => updateRow(row.id, { parentBatch: batch, parentBatchId: batch.id })}
                        onClear={() => updateRow(row.id, { parentBatch: undefined, parentBatchId: undefined })}
                        onSearch={handleSearch}
                        searchResults={searchResults}
                        searchLoading={searchLoading}
                      />
                      {row.parentBatch && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {row.parentBatch.variety_name ?? "—"} • {row.parentBatch.size_name ?? "Size —"} •{" "}
                          {row.parentBatch.location_name ?? "Location —"} •{" "}
                          {(row.parentBatch.quantity ?? 0).toLocaleString()} units available
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={row.units || ""}
                        onChange={(event) => updateRow(row.id, { units: Number(event.target.value) || 0 })}
                        className="text-right"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Optional note"
                        value={row.notes ?? ""}
                        onChange={(event) => updateRow(row.id, { notes: event.target.value || undefined })}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={row.archiveWhenEmpty}
                        onCheckedChange={(value) => updateRow(row.id, { archiveWhenEmpty: Boolean(value) })}
                      />
                    </TableCell>
                    <TableCell>
                      {row.errors.length ? (
                        <Badge variant="destructive">{row.errors[0]}</Badge>
                      ) : (
                        <Badge variant="outline">Ready</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeRow(row.id)} disabled={rows.length === 1}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={handleSubmit} disabled={!ready}>
              {busy === "submitting" ? "Creating…" : "Create transplant"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Contributions must exactly match the target units ({requiredUnits.toLocaleString()}).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ParentBatchPicker({
  row,
  onSelect,
  onSearch,
  searchResults,
  searchLoading,
}: {
  row: ParentRow;
  onSelect: (batch: ParentBatch) => void;
  onSearch: (query: string) => void;
  searchResults: ParentBatch[];
  searchLoading: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onSearch(value), 250);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-start font-normal"
        >
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          {row.parentBatch ? (
            <span className="truncate">
              {row.parentBatch.batch_number}
              <span className="ml-2 text-muted-foreground text-xs">
                ({row.parentBatch.variety_name ?? "?"})
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Search batch…</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search batches…" value={query} onValueChange={handleInputChange} />
          <CommandList>
            {searchLoading ? (
              <div className="py-4 text-center text-sm text-muted-foreground">Searching…</div>
            ) : searchResults.length === 0 ? (
              <CommandEmpty>
                {query.length < 2 ? "Type at least 2 characters" : "No batches found"}
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {searchResults.map((batch) => (
                  <CommandItem
                    key={batch.id}
                    value={batch.id}
                    onSelect={() => {
                      onSelect(batch);
                      setOpen(false);
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{batch.batch_number}</span>
                      <span className="text-xs text-muted-foreground">
                        {batch.variety_name ?? "—"} • {batch.quantity?.toLocaleString() ?? "0"} units
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

