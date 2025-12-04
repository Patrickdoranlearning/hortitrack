"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabaseClient } from "@/lib/supabase/client";
import ScannerDialog from "@/components/scan-and-act-dialog";
import { candidateBatchNumbers } from "@/lib/scan/parse";
import { parseScanCode } from "@/lib/scan/parse.client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Camera, Loader2, QrCode } from "lucide-react";

type SaleableBatchRow = {
  id: string;
  batchNumber: string;
  status: string | null;
  quantity: number;
  plantVariety: string | null;
  size: string | null;
  location: string | null;
  plantedAt: string | null;
  updatedAt: string | null;
  growerPhotoUrl: string | null;
  salesPhotoUrl: string | null;
};

type Props = {
  initialBatches: SaleableBatchRow[];
  statusOptions: string[];
  defaultStatuses: string[];
};

function formatDate(value: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

export default function SaleableBatchesClient({
  initialBatches,
  statusOptions,
  defaultStatuses,
}: Props) {
  const { toast } = useToast();
  const [batches, setBatches] = useState(initialBatches);
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(defaultStatuses);
  const [scanValue, setScanValue] = useState("");
  const [markLookingGood, setMarkLookingGood] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [lastScannedId, setLastScannedId] = useState<string | null>(null);
  const [lastScannedNumber, setLastScannedNumber] = useState<string | null>(null);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const quickPhotoInputRef = useRef<HTMLInputElement | null>(null);

  const toText = (value: string | number | null | undefined) =>
    (value ?? "").toString().toLowerCase();

  const filteredBatches = useMemo(() => {
    const query = search.trim().toLowerCase();
    return batches.filter((batch) => {
      const normalizedStatus = batch.status === "Ready for Sale" ? "Ready" : batch.status ?? "";
      const matchesStatus =
        selectedStatuses.length === 0 || selectedStatuses.includes(normalizedStatus);
      if (!matchesStatus) return false;

      if (!query) return true;
      return (
        toText(batch.batchNumber).includes(query) ||
        toText(batch.plantVariety).includes(query) ||
        toText(batch.location).includes(query)
      );
    });
  }, [batches, search, selectedStatuses]);

  const resolveBatchFromInput = (raw: string) => {
    const cleaned = raw.trim();
    if (!cleaned) return { batch: null as SaleableBatchRow | null, reason: "empty" as const };

    const parsed = parseScanCode(cleaned);
    const normalized = cleaned.toLowerCase().replace(/^#/, "");

    const matchesQuery = (batch: SaleableBatchRow) =>
      [toText(batch.batchNumber), toText(batch.plantVariety), toText(batch.location)].some((field) =>
        field.includes(normalized)
      );

    if (parsed?.by === "id") {
      const match = batches.find((batch) => toText(batch.id) === parsed.value.toLowerCase());
      if (match) return { batch: match, reason: null as const, query: normalized };
    }

    if (parsed?.by === "batchNumber") {
      const candidates = candidateBatchNumbers(parsed.value).map((v) => v.toLowerCase());
      const candidateMatches = batches.filter((batch) => candidates.includes(toText(batch.batchNumber)));
      if (candidateMatches.length === 1) {
        return { batch: candidateMatches[0], reason: null as const, query: candidates[0] ?? normalized };
      }
      if (candidateMatches.length > 1) {
        return { batch: null, reason: "ambiguous" as const, matches: candidateMatches.length, query: normalized };
      }
    }

    const fuzzyMatches = batches.filter(matchesQuery);
    if (fuzzyMatches.length === 1) return { batch: fuzzyMatches[0], reason: null as const, query: normalized };
    if (fuzzyMatches.length > 1) {
      return { batch: null, reason: "ambiguous" as const, matches: fuzzyMatches.length, query: normalized };
    }

    return { batch: null as SaleableBatchRow | null, reason: "not_found" as const, query: normalized };
  };

  const saleableCount = filteredBatches.length;
  const totalUnits = filteredBatches.reduce((sum, batch) => sum + (batch.quantity ?? 0), 0);
  const readyCount = filteredBatches.filter((b) => b.status === "Ready").length;
  const lookingGoodCount = filteredBatches.filter((b) => b.status === "Looking Good").length;

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) => {
      if (prev.includes(status)) {
        return prev.filter((s) => s !== status);
      }
      return [...prev, status];
    });
  };

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const escapeCsv = (value: string | number | null | undefined) => {
    const str = value ?? "";
    if (typeof str === "number") return str.toString();
    const needsQuotes = /[",\n]/.test(str);
    const cleaned = str.replace(/"/g, '""');
    return needsQuotes ? `"${cleaned}"` : cleaned;
  };

  const handleDownloadAvailability = () => {
    const headers = ["Batch", "Variety", "Size", "Status", "Units", "Location", "Updated"];
    const rows = filteredBatches.map((batch) => [
      batch.batchNumber,
      batch.plantVariety ?? "Unknown variety",
      batch.size ?? "Size unknown",
      batch.status ?? "—",
      batch.quantity ?? 0,
      batch.location ?? "—",
      formatDate(batch.updatedAt),
    ]);

    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    downloadFile(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      `availability-${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  const handleDownloadLookingGood = () => {
    const cards = filteredBatches
      .map((batch) => {
        const photo = batch.salesPhotoUrl ?? batch.growerPhotoUrl;
        return `
          <div class="card">
            <div class="meta">
              <div class="title">#${batch.batchNumber}</div>
              <div class="sub">${batch.plantVariety ?? "Unknown variety"} • ${batch.size ?? "Size unknown"}</div>
              <div class="pill">${batch.status ?? "—"}</div>
              <div class="muted">${batch.location ?? "—"} • ${formatDate(batch.updatedAt)}</div>
            </div>
            ${
              photo
                ? `<img src="${photo}" alt="Photo for ${batch.batchNumber}" />`
                : `<div class="placeholder">No photo available</div>`
            }
          </div>
        `;
      })
      .join("\n");

    const html = `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Looking Good List</title>
        <style>
          body { font-family: Inter, system-ui, -apple-system, sans-serif; margin: 0; padding: 24px; background: #f7f7f7; }
          h1 { margin: 0 0 8px; }
          .subtitle { color: #475467; margin: 0 0 24px; }
          .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
          .card { background: #fff; border: 1px solid #e4e7ec; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04); display: flex; flex-direction: column; }
          .card img { width: 100%; height: 220px; object-fit: cover; }
          .placeholder { height: 220px; display: flex; align-items: center; justify-content: center; color: #98a2b3; background: #f2f4f7; }
          .meta { padding: 16px; display: flex; flex-direction: column; gap: 6px; }
          .title { font-weight: 600; }
          .sub { color: #475467; }
          .muted { color: #98a2b3; font-size: 13px; }
          .pill { align-self: flex-start; padding: 4px 10px; border-radius: 999px; background: #eef2ff; color: #3730a3; font-size: 12px; font-weight: 600; }
        </style>
      </head>
      <body>
        <h1>Looking Good List</h1>
        <p class="subtitle">Generated ${new Date().toLocaleString()}</p>
        <div class="grid">
          ${cards}
        </div>
      </body>
    </html>`;

    downloadFile(
      new Blob([html], { type: "text/html;charset=utf-8" }),
      `looking-good-${new Date().toISOString().slice(0, 10)}.html`
    );
  };

  const handleScanSubmit = async (event?: FormEvent, overrideValue?: string) => {
    if (event) event.preventDefault();
    const inputValue = (overrideValue ?? scanValue).trim();
    if (!inputValue) return;

    const matchResult = resolveBatchFromInput(inputValue);
    const match = matchResult.batch;

    if (!match) {
      setSearch(matchResult.query ?? inputValue.toLowerCase());
      setScanValue("");
      toast({
        variant: "destructive",
        title: matchResult.reason === "ambiguous" ? "Multiple batches match" : "Batch not found",
        description:
          matchResult.reason === "ambiguous"
            ? `Narrow your search; ${matchResult.matches ?? 0} batches match that code or text.`
            : `No batch matches ${inputValue}.`,
      });
      return;
    }

    setIsScanning(true);
    const targetStatus = markLookingGood ? "Looking Good" : "Ready";

    try {
      const response = await fetch("/api/batches/bulk-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          batchIds: [match.id],
          status: targetStatus,
          flags: markLookingGood ? ["looking_good"] : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to update batch.");
      }

      setBatches((prev) =>
        prev.map((batch) =>
          batch.id === match.id
            ? { ...batch, status: targetStatus, updatedAt: new Date().toISOString() }
            : batch
        )
      );
      setLastScannedId(match.id);
      setLastScannedNumber(match.batchNumber);
      setSearch(matchResult.query ?? toText(match.batchNumber));

      toast({
        title: `Marked ${targetStatus}`,
        description: `Batch #${match.batchNumber} is now ${targetStatus}.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message ?? String(error),
      });
    } finally {
      setIsScanning(false);
      setScanValue("");
    }
  };

  const handleScanDetected = (text: string) => {
    const value = text?.trim();
    if (!value) return;
    setIsScanOpen(false);
    setScanValue(value);
    // Use the decoded value directly so we process DataMatrix/QR payloads immediately.
    handleScanSubmit(undefined, value);
  };

  const handlePhotoUpload = async (batchId: string, file: File) => {
    setUploadingId(batchId);
    try {
      const supabase = supabaseClient();
      const fileExt = file.name.split(".").pop();
      const fileName = `${batchId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from("batch-photos").upload(filePath, file);
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("batch-photos").getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("batches")
        .update({
          sales_photo_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", batchId);

      if (updateError) throw updateError;

      setBatches((prev) =>
        prev.map((b) => (b.id === batchId ? { ...b, salesPhotoUrl: publicUrl } : b))
      );

      toast({
        title: "Photo uploaded",
        description: "Sales photo saved for this batch.",
      });
    } catch (error: any) {
      console.error("Upload failed:", error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message || "Could not upload photo.",
      });
    } finally {
      setUploadingId(null);
    }
  };

  const handleQuickPhoto = (file: File) => {
    if (!lastScannedId) {
      toast({
        variant: "destructive",
        title: "Scan a batch first",
        description: "Scan a batch before adding a photo.",
      });
      return;
    }
    handlePhotoUpload(lastScannedId, file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Saleable &amp; looking good</h1>
          <p className="text-sm text-muted-foreground">
            Scan batches to mark them sale-ready, optionally flag them as looking good, and export shareable lists.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleDownloadAvailability}>
            Download availability list
          </Button>
          <Button variant="secondary" onClick={handleDownloadLookingGood}>
            Download looking good list
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle>Scan &amp; mark saleable</CardTitle>
            <p className="text-sm text-muted-foreground">
              Scan a batch number to set it to saleable instantly. Toggle “Looking Good” to set that status too.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="mark-looking-good"
              checked={markLookingGood}
              onCheckedChange={(value) => setMarkLookingGood(Boolean(value))}
            />
            <label htmlFor="mark-looking-good" className="text-sm">
              Also mark “Looking Good”
            </label>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleScanSubmit} className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex w-full items-center gap-2">
              <Input
                placeholder="Scan or type batch #, variety, or location"
                value={scanValue}
                onChange={(event) => {
                  const next = event.target.value;
                  setScanValue(next);
                  setSearch(next);
                }}
                className="flex-1"
                autoComplete="off"
                inputMode="text"
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={() => setIsScanOpen(true)}
                title="Open camera scanner (Data Matrix / QR)"
              >
                <QrCode className="h-4 w-4" />
                <span className="sr-only">Open scanner</span>
              </Button>
            </div>
            <Button type="submit" disabled={isScanning}>
              {isScanning ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Updating…
                </span>
              ) : (
                "Scan & mark saleable"
              )}
            </Button>
          </form>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Last scanned</p>
              {lastScannedId ? (
                <div className="mt-1 space-y-1">
                  <p className="text-sm font-medium">#{lastScannedNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    Ready for a quick photo or another scan.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Scan a batch to pin it here.</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={quickPhotoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                capture="environment"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleQuickPhoto(file);
                  event.target.value = "";
                }}
              />
              <Button
                variant="outline"
                disabled={!lastScannedId || uploadingId === lastScannedId}
                onClick={() => quickPhotoInputRef.current?.click()}
              >
                {uploadingId === lastScannedId ? "Uploading…" : "Add photo"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!lastScannedId}
                onClick={() => {
                  setLastScannedId(null);
                  setLastScannedNumber(null);
                }}
              >
                Clear last scan
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
            <div>
              <CardTitle>Filters</CardTitle>
              <p className="text-sm text-muted-foreground">Search and focus on specific statuses.</p>
            </div>
            <Input
              placeholder="Search batch, variety, or location…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full lg:w-[280px]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((status) => {
              const active = selectedStatuses.includes(status);
              return (
                <Button
                  key={status}
                  type="button"
                  variant={active ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleStatus(status)}
                >
                  {status}
                </Button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Batches in view" value={saleableCount.toLocaleString()} />
          <StatCard label="Units in view" value={totalUnits.toLocaleString()} />
          <StatCard label="Ready" value={readyCount.toLocaleString()} />
          <StatCard label="Looking Good" value={lookingGoodCount.toLocaleString()} />
          <StatCard
            label="With photos"
            value={filteredBatches.filter((b) => !!(b.salesPhotoUrl || b.growerPhotoUrl)).length.toLocaleString()}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle>Availability &amp; looking good lists</CardTitle>
            <p className="text-sm text-muted-foreground">
              Export the filtered view. Availability lists exclude photos; looking good lists include photo previews.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadAvailability}>
              Download availability (.csv)
            </Button>
            <Button size="sm" variant="secondary" onClick={handleDownloadLookingGood}>
              Download looking good (.html)
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredBatches.length} of {batches.length} batches.
        </p>
        <p className="text-sm text-muted-foreground">
          Scan a batch above to set status without leaving this page.
        </p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Batch</TableHead>
              <TableHead>Variety / Size</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Units</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Photos</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBatches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No batches match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredBatches.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell className="font-medium">
                    #{batch.batchNumber || batch.id.slice(0, 6)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{batch.plantVariety ?? "Unknown variety"}</span>
                      <span className="text-xs text-muted-foreground">
                        {batch.size ?? "Size unknown"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{batch.status ?? "—"}</Badge>
                  </TableCell>
                  <TableCell>{(batch.quantity ?? 0).toLocaleString()}</TableCell>
                  <TableCell>{batch.location ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2 text-xs">
                      <Badge variant={batch.growerPhotoUrl ? "default" : "outline"}>
                        Grower {batch.growerPhotoUrl ? "✓" : "—"}
                      </Badge>
                      <Button
                        variant={batch.salesPhotoUrl ? "ghost" : "outline"}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={uploadingId === batch.id}
                        onClick={() => {
                          setLastScannedId(batch.id);
                          setLastScannedNumber(batch.batchNumber);
                          quickPhotoInputRef.current?.click();
                        }}
                        title={batch.salesPhotoUrl ? "Replace sales photo" : "Add sales photo"}
                      >
                        {uploadingId === batch.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : batch.salesPhotoUrl ? (
                          "Sales ✓"
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Camera className="h-3 w-3" /> Sales
                          </span>
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(batch.updatedAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <ScannerDialog open={isScanOpen} onOpenChange={setIsScanOpen} onDetected={handleScanDetected} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

