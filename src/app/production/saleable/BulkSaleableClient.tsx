"use client";

import { useMemo, useState, useRef, type FormEvent } from "react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Loader2 } from "lucide-react";
import { supabaseClient } from "@/lib/supabase/client";
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
import { Badge } from "@/components/ui/badge";

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
};

export default function BulkSaleableClient({ initialBatches, statusOptions }: Props) {
  const { toast } = useToast();
  const [batches, setBatches] = useState(initialBatches);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>(statusOptions);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string>(statusOptions[0] ?? "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [scanValue, setScanValue] = useState("");
  const [lastScannedId, setLastScannedId] = useState<string | null>(null);
  const [lastScannedNumber, setLastScannedNumber] = useState<string | null>(null);
  
  // Hidden file inputs ref
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const quickPhotoInputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase().replace(/^#/, ""); // Remove leading # if user types it
    const toText = (value: string | number | null | undefined) =>
      (value ?? "").toString().toLowerCase();

    return batches.filter((batch) => {
      const normalizedStatus = batch.status === "Ready for Sale" ? "Ready" : batch.status ?? "";
      const matchesStatus =
        statusFilter.length === 0 || statusFilter.includes(normalizedStatus);
      if (!matchesStatus) return false;
      if (!query) return true;
      return (
        toText(batch.batchNumber).includes(query) ||
        toText(batch.plantVariety).includes(query) ||
        toText(batch.location).includes(query)
      );
    });
  }, [batches, search, statusFilter]);

  const toggleBatch = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelected((prev) => {
      const allIds = filtered.map((batch) => batch.id);
      const hasAll = allIds.every((id) => prev.has(id));
      if (hasAll) {
        const next = new Set(prev);
        allIds.forEach((id) => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      allIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const selectedCount = selected.size;

  const handleScanSubmit = (event?: FormEvent) => {
    if (event) event.preventDefault();
    const cleaned = scanValue.trim().toLowerCase().replace(/^#/, "");
    if (!cleaned) return;

    const match = batches.find(
      (batch) => (batch.batchNumber ?? "").toString().toLowerCase() === cleaned
    );
    if (!match) {
      toast({
        variant: "destructive",
        title: "Batch not found",
        description: `No batch matches #${scanValue}.`,
      });
      return;
    }

    toggleBatch(match.id);
    setSearch(cleaned);
    setLastScannedId(match.id);
    setLastScannedNumber(match.batchNumber);
    toast({
      title: "Batch selected",
      description: `#${match.batchNumber} is ready for status or photo updates.`,
    });
    setScanValue("");
  };

  const handlePhotoUpload = async (batchId: string, file: File) => {
    setUploadingId(batchId);
    try {
      const supabase = supabaseClient();
      const fileExt = file.name.split('.').pop();
      const fileName = `${batchId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('batch-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('batch-photos')
        .getPublicUrl(filePath);

      // Update batch record
      const { error: updateError } = await supabase
        .from('batches')
        .update({ 
          sales_photo_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', batchId);

      if (updateError) throw updateError;

      setBatches(prev => prev.map(b => 
        b.id === batchId 
          ? { ...b, salesPhotoUrl: publicUrl }
          : b
      ));

      toast({
        title: "Photo uploaded",
        description: "Sales photo updated successfully."
      });

    } catch (error: any) {
      console.error("Upload failed:", error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message || "Could not upload photo"
      });
    } finally {
      setUploadingId(null);
    }
  };

  const handleSubmit = async () => {
    if (!status) {
      toast({
        variant: "destructive",
        title: "Status required",
        description: "Choose the status you want to apply.",
      });
      return;
    }
    if (selectedCount === 0) {
      toast({
        variant: "destructive",
        title: "Select batches first",
        description: "Pick at least one batch to update.",
      });
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/batches/bulk-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          batchIds: Array.from(selected),
          status,
          note: note.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Bulk update failed.");
      }
      toast({
        title: "Status updated",
        description: `Updated ${data.updated ?? selectedCount} batches.`,
      });

      setBatches((prev) =>
        prev.map((batch) =>
          selected.has(batch.id)
            ? {
                ...batch,
                status,
                updatedAt: new Date().toISOString(),
              }
            : batch
        )
      );
      setSelected(new Set());
      setNote("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Bulk update failed",
        description: error.message ?? String(error),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickPhoto = (file: File) => {
    if (!lastScannedId) {
      toast({
        variant: "destructive",
        title: "Scan a batch first",
        description: "Scan or select a batch before adding a quick photo.",
      });
      return;
    }
    handlePhotoUpload(lastScannedId, file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Bulk saleable update</h1>
        <p className="text-sm text-muted-foreground">
          Select batches and apply a new status with optional notes in one step. Scan batch numbers,
          filter by saleable vs. looking good, and drop photos without leaving this screen.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {statusOptions.map((option) => {
                  const active = statusFilter.includes(option);
                  return (
                    <Button
                      key={option}
                      size="sm"
                      variant={active ? "default" : "outline"}
                      onClick={() =>
                        setStatusFilter((prev) =>
                          prev.includes(option) ? prev.filter((s) => s !== option) : [...prev, option]
                        )
                      }
                    >
                      {option}
                    </Button>
                  );
                })}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setStatusFilter(statusOptions)}
                  disabled={statusFilter.length === statusOptions.length}
                >
                  Reset
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleAllFiltered}
                disabled={filtered.length === 0}
              >
                {filtered.every((row) => selected.has(row.id))
                  ? "Clear filtered selection"
                  : "Select filtered"}
              </Button>
            </div>

            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
              <Input
                placeholder="Search batch, variety, location…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full lg:w-72"
              />
              <form onSubmit={handleScanSubmit} className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  placeholder="Scan or type batch # and press Enter"
                  value={scanValue}
                  onChange={(event) => setScanValue(event.target.value)}
                  className="flex-1"
                  autoComplete="off"
                  inputMode="numeric"
                />
                <Button type="submit" variant="secondary">
                  Scan &amp; select
                </Button>
              </form>
            </div>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12" />
                  <TableHead>Batch</TableHead>
                  <TableHead>Variety / Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="w-16">Photo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No batches match the search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(batch.id)}
                          onCheckedChange={() => toggleBatch(batch.id)}
                          aria-label={`Select batch ${batch.batchNumber}`}
                        />
                      </TableCell>
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
                        <div className="flex items-center justify-center">
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            ref={el => {
                              if (el) fileInputRefs.current.set(batch.id, el);
                              else fileInputRefs.current.delete(batch.id);
                            }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handlePhotoUpload(batch.id, file);
                              // Reset input so same file can be selected again if needed
                              e.target.value = '';
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={uploadingId === batch.id}
                            onClick={() => fileInputRefs.current.get(batch.id)?.click()}
                            title="Upload sales photo"
                          >
                            {uploadingId === batch.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : batch.salesPhotoUrl ? (
                              <div className="relative h-8 w-8 overflow-hidden rounded-md border">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img 
                                  src={batch.salesPhotoUrl} 
                                  alt="Sales" 
                                  className="h-full w-full object-cover" 
                                />
                              </div>
                            ) : (
                              <Camera className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium">Selected batches</p>
            <p className="text-2xl font-semibold">{selectedCount.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Choose at least one to enable the update.</p>
          </div>

          <div className="rounded-md border bg-muted/40 p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Last scanned</p>
            {lastScannedId ? (
              <div className="mt-1 space-y-1">
                <p className="text-sm font-medium">#{lastScannedNumber}</p>
                <p className="text-xs text-muted-foreground">
                  Ready to set status or upload a quick photo.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Scan a batch to pin it here.</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">New status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((option) => (
                <Button
                  key={option}
                  size="sm"
                  variant={status === option ? "secondary" : "outline"}
                  onClick={() => setStatus(option)}
                >
                  Set {option}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Grower note (optional)</label>
            <Textarea
              placeholder="Any details to include with this update?"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Notes are shared with plant health and sales teams.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Quick photo (last scanned)</label>
            <p className="text-xs text-muted-foreground">
              Capture or drop a photo right after scanning. Applies to the pinned batch above.
            </p>
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
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!lastScannedId || uploadingId === lastScannedId}
                onClick={() => quickPhotoInputRef.current?.click()}
              >
                {uploadingId === lastScannedId ? "Uploading…" : "Add photo"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!lastScannedId}
                onClick={() => {
                  setLastScannedId(null);
                  setLastScannedNumber(null);
                }}
              >
                Clear pinned batch
              </Button>
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={submitting || selectedCount === 0}>
            {submitting ? "Updating…" : "Apply status"}
          </Button>
        </div>
      </div>
    </div>
  );
}
