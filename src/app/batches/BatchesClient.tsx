
'use client';

import * as React from 'react';
import { useState, useMemo, useEffect, useCallback, useRef } from "react";

import {
  Search,
  Filter,
  ArrowLeft,
  Download,
  Upload,
} from 'lucide-react';
import type { Batch } from '@/lib/types';
import type { NurseryLocation, PlantSize } from "@/lib/types";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BatchDetailDialog } from "@/components/batch-detail-dialog";
import { TransplantForm, TransplantFormData } from "@/components/transplant-form";
import MobileBatchCard from "@/components/mobile-batch-card";

import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { collection, onSnapshot, getDocs } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { BatchForm } from "@/components/batch-form";

// helpers near top of BatchesPage (inside file, outside component is fine)
const toMillis = (v: any): number => {
  if (!v) return 0;
  if (typeof v?.toDate === "function") return v.toDate().getTime(); // Firestore Timestamp
  const d = new Date(typeof v === "string" ? v : v);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};
const batchDateScore = (b: any) =>
  toMillis(b.updatedAt) || toMillis(b.plantingDate) || toMillis(b.createdAt);

function tsToIso(v: any): string | undefined {
  if (!v) return undefined;
  if (typeof v?.toDate === 'function') return v.toDate().toISOString();
  if (v.seconds != null || v._seconds != null) {
    const sec = v.seconds ?? v._seconds ?? 0;
    const ns = v.nanoseconds ?? v._nanoseconds ?? 0;
    return new Date(sec * 1000 + Math.floor(ns / 1e6)).toISOString();
  }
  if (typeof v === 'string') return v;
  return undefined;
}

function normalizeBatch(d: any): any {
  const x = d.data() || {};
  return {
    id: d.id,
    ...x,
    plantingDate: tsToIso(x.plantingDate) ?? x.plantingDate,
    createdAt: tsToIso(x.createdAt) ?? x.createdAt,
    updatedAt: tsToIso(x.updatedAt) ?? x.updatedAt,
    logHistory: Array.isArray(x.logHistory)
      ? x.logHistory.map((log: any) => ({ ...log, date: tsToIso(log?.date) ?? log?.date }))
      : [],
  };
}

// --- Batch quick-open via search (Enter) ---
function normalizeBatchQuery(q: string): string {
  console.log("normalizeBatchQuery: Input:", q); // LOG ADDED
  // trim + remove common prefixes: "batch ", "#", "b:", "b-"
  const normalized = (q || "")
    .trim()
    .replace(/^(batch\s*#?|b[:\-]?)\s*/i, ""); // keep leading zeros
  console.log("normalizeBatchQuery: Output:", normalized); // LOG ADDED
  return normalized;
}

function findBatchByNumberOrId(batches: Batch[], query: string): Batch | undefined {
  const q = normalizeBatchQuery(query);
  if (!q) return undefined;
  
  // exact batchNumber match first (string compare to preserve leading zeros)
  const byNumber = batches.find(b => {
    const batchNumStr = String(b.batchNumber);
    console.log("findBatchByNumberOrId: Comparing normalized query '"+q+"' with batch number '"+batchNumStr+"'"); // LOG ADDED
    return batchNumStr === q;
  });
  if (byNumber) return byNumber;
  
  // fallback: exact id
  return batches.find(b => {
    const batchIdStr = String(b.id);
    console.log("findBatchByNumberOrId: Comparing normalized query '"+q+"' with batch ID '"+batchIdStr+"'"); // LOG ADDED
    return batchIdStr === q;
  });
}


export default function BatchesClient({ initialBatches }: { initialBatches: Batch[] }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [batches, setBatches] = useState<Batch[]>(initialBatches);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<{
    plantFamily: string;
    status: string;
    category: string;
  }>({ plantFamily: 'all', status: 'all', category: 'all' });

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isTransplantDialogOpen, setIsTransplantDialogOpen] = useState(false);
  const [batchToTransplant, setBatchToTransplant] = useState<Batch | null>(null);
  const [nurseryLocations, setNurseryLocations] = useState<NurseryLocation[]>([]);
  const [plantSizes, setPlantSizes] = useState<PlantSize[]>([]);

  // State for Batch Detail and Edit Dialogs
  const [isBatchDetailDialogOpen, setIsBatchDetailDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [batchToEdit, setBatchToEdit] = useState<Batch | null>(null);

  const loadBatches = useCallback(() => {
    if (!user) return () => {};
    const unsub = onSnapshot(
      collection(db, "batches"),
      (snap) => {
        const items = snap.docs.map((d) => normalizeBatch(d));
        items.sort((a, b) => batchDateScore(b) - batchDateScore(a));
        setBatches(items);
        setIsDataLoading(false);
      },
      (err) => {
        console.error("batches snapshot error:", err);
        setIsDataLoading(false);
      }
    );
    return unsub;
  }, [user]);

  useEffect(() => {
    const unsub = loadBatches();
    return typeof unsub === "function" ? unsub : undefined;
  }, [loadBatches]);


  const plantFamilies = useMemo(() => ['all', ...Array.from(new Set(batches.map((b) => b.plantFamily)))], [batches]);
  const categories = useMemo(() => ['all', ...Array.from(new Set(batches.map((b) => b.category)))], [batches]);
  const statuses = useMemo(() => ['all', 'Propagation', 'Plugs/Liners', 'Potted', 'Ready for Sale', 'Looking Good', 'Archived'], []);

  const filteredBatches = useMemo(() => {
    return batches
      .filter((batch) =>
        `${batch.plantFamily} ${batch.plantVariety} ${batch.category} ${batch.supplier || ''} ${batch.batchNumber}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .filter(
        (batch) =>
          filters.plantFamily === 'all' || batch.plantFamily === filters.plantFamily
      )
      .filter(
        (batch) =>
          filters.category === 'all' || batch.category === filters.category
      )
      .filter((batch) => {
        if (filters.status === 'all') return true;
        return batch.status === filters.status;
      });
  }, [batches, searchQuery, filters]);

  // Load locations and sizes (using "sizes" to match your Firestore rules)
  useEffect(() => {
    const loadMetaData = async () => {
      try {
        const locationsSnap = await getDocs(collection(db, "locations"));
        setNurseryLocations(
          locationsSnap.docs.map(
            (doc) => ({ id: doc.id, ...(doc.data() as any) } as NurseryLocation)
          )
        );
        const sizesSnap = await getDocs(collection(db, "sizes"));
        setPlantSizes(
          sizesSnap.docs.map(
            (doc) => ({ id: doc.id, ...(doc.data() as any) } as PlantSize)
          )
        );
      } catch (error: any) {
        console.error("Failed to load metadata:", error);
        toast({
          variant: "destructive",
          title: "Error loading data",
          description: error.message,
        });
      }
    };
    loadMetaData();
  }, [toast]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    if (typeof date === 'string') { // It's an ISO string
      return format(new Date(date), 'PPP');
    }
    return 'Invalid Date';
  };

  const getStatusVariant = (status: Batch['status']): "default" | "secondary" | "destructive" | "outline" | "accent" | "info" => {
    switch (status) {
      case 'Ready for Sale':
      case 'Looking Good':
        return 'accent';
      case 'Propagation':
      case 'Plugs/Liners':
        return 'info';
      case 'Potted':
        return 'default';
      case 'Archived':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const handleTransplant = (batch: Batch) => {
    setBatchToTransplant(batch);
    setIsTransplantDialogOpen(true);
  };

  const handleViewDetails = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsBatchDetailDialogOpen(true);
  };

  const handleSearchKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key !== "Enter") return;
    const hit = findBatchByNumberOrId(batches, searchQuery);
    if (hit) {
      e.preventDefault();
      handleViewDetails(hit); // your existing function that opens the dialog
    } else {
      toast({
        variant: "outline",
        title: "No matching batch",
        description: `Couldn't find batch #${normalizeBatchQuery(searchQuery)}.`,
      });
    }
  };

  const handleEditBatch = (batch: Batch) => {
    setBatchToEdit(batch);
    setIsBatchDetailDialogOpen(false); // Close detail dialog
    setIsEditDialogOpen(true); // Open edit dialog
  };

  const handleDeleteBatch = async (batch: Batch) => {
    const ok = confirm(`Delete batch #${batch.batchNumber}? This cannot be undone.`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/batches/${batch.id}`, { method: "DELETE" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        let msg = "Delete failed";
        try {
          const j = JSON.parse(txt);
          msg = j?.error || msg;
        } catch {
          if (txt) msg = txt;
        }
        throw new Error(msg);
      }
      toast({ title: "Deleted", description: `Batch #${batch.batchNumber} removed.` });
      setIsBatchDetailDialogOpen(false);
      setSelectedBatch(null);
      await loadBatches();
    } catch (e: any) {
      console.error("Delete API error:", e);
      toast({ variant: "destructive", title: "Delete failed", description: e.message });
    }
  };


  const handleTransplantSubmit = async (data: TransplantFormData) => {
    if (!batchToTransplant) return;
    try {
      const res = await fetch(`/api/batches/${batchToTransplant.id}/transplant`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quantity: data.quantity,
          location: data.location,
          size: data.size,
          status: data.status,
          supplier: data.supplier || undefined,
          plantingDate: data.plantingDate || undefined, // ISO string
          logRemainingAsLoss: !!data.logRemainingAsLoss,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Transplant failed");
      }
      const { batchNumber } = await res.json(); // { id, batchNumber }
      toast({
        title: "Transplant Successful",
        description: `Created new batch #${batchNumber}`,
      });
      setIsTransplantDialogOpen(false);
      setBatchToTransplant(null);
      loadBatches(); // Refresh the batch list
    } catch (error: any) {
      console.error("Transplant API error:", error);
      toast({ variant: "destructive", title: "Transplant Failed", description: error.message });
    }
  };

  const csvHeaders = [
    "category",
    "plantFamily",
    "plantVariety",
    "plantingDate",   // ISO
    "initialQuantity",
    "quantity",
    "status",
    "location",
    "size",
    "supplier",
  ];
  
  const csvEscape = (val: any) => {
    if (val == null) return "";
    const s = String(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  
  const downloadCsv = () => {
    const rows = [csvHeaders.join(",")];
    for (const b of batches) {
      const row = [
        b.category,
        b.plantFamily,
        b.plantVariety,
        b.plantingDate,
        b.initialQuantity ?? "",
        b.quantity ?? "",
        b.status ?? "",
        b.location ?? "",
        b.size ?? "",
        b.supplier ?? "",
      ].map(csvEscape);
      rows.push(row.join(","));
    }
    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "batches.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // very small CSV parser with quoted-field support
  const parseCsvText = (text: string): Array<Record<string, string>> => {
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean);
    if (!lines.length) return [];
    const header = splitCsvLine(lines[0]);
    const out: Array<Record<string, string>> = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i]);
      if (!cols.length) continue;
      const rec: Record<string, string> = {};
      header.forEach((h, idx) => (rec[h] = cols[idx] ?? ""));
      out.push(rec);
    }
    return out;
  };
  
  function splitCsvLine(line: string): string[] {
    const res: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          res.push(cur);
          cur = "";
        } else {
          cur += ch;
        }
      }
    }
    res.push(cur);
    return res;
  }
  
  // basic validation + mapping to /api/batches
  const normalizeStatus = (s: string) => {
    const x = (s || "").trim();
    const allowed = [
      "Propagation",
      "Plugs/Liners",
      "Potted",
      "Ready for Sale",
      "Looking Good",
      "Archived",
    ];
    const hit = allowed.find(a => a.toLowerCase() === x.toLowerCase());
    return hit ?? "Potted";
  };
  
  const mapRowToCreatePayload = (row: Record<string, string>) => {
    const toInt = (v: string) => {
      const n = parseInt(v ?? "", 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    };
    const iso =
      row.plantingDate && !Number.isNaN(Date.parse(row.plantingDate))
        ? new Date(row.plantingDate).toISOString()
        : new Date().toISOString();
  
    return {
      category: row.category?.trim() || "Perennial",
      plantFamily: row.plantFamily?.trim() || "",
      plantVariety: row.plantVariety?.trim() || "",
      plantingDate: iso,
      initialQuantity: toInt(row.initialQuantity),
      quantity: row.quantity ? toInt(row.quantity) : undefined, // server defaults to initialQuantity if missing
      status: normalizeStatus(row.status || ""),
      location: row.location?.trim() || "",
      size: row.size?.trim() || "",
      supplier: row.supplier?.trim() || undefined,
    };
  };
  
  // create a de-dupe key: if your CSV has batchNumber, we skip those entirely
  // otherwise dedupe by a tuple of fields that describe the batch
  const makeDedupKey = (x: any) =>
    [
      (x.plantFamily || "").toLowerCase(),
      (x.plantVariety || "").toLowerCase(),
      // round planting date to day
      (typeof x.plantingDate === "string"
        ? x.plantingDate.slice(0, 10)
        : new Date(x.plantingDate).toISOString().slice(0, 10)),
      (x.size || "").toLowerCase(),
      (x.location || "").toLowerCase(),
    ].join("|");
  
  const handleCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCsvText(text);
      if (!rows.length) {
        toast({ variant: "destructive", title: "CSV empty", description: "No rows found." });
        return;
      }
  
      // if CSV contains batchNumber, skip those rows (server generates numbers)
      const filtered = rows.filter(r => !r.batchNumber);
  
      // Build a de-dupe set from current batches + incoming rows we accept
      const existingKeys = new Set(batches.map(makeDedupKey));
      let created = 0, skipped = 0, failed = 0;
  
      for (const row of filtered) {
        const payload = mapRowToCreatePayload(row);
        const key = makeDedupKey(payload);
        if (existingKeys.has(key)) {
          skipped++;
          continue;
        }
        try {
          const res = await fetch("/api/batches", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            created++;
            existingKeys.add(key);
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }
  
      toast({
        title: "Import complete",
        description: `Added ${created}, skipped ${skipped}, failed ${failed}.`,
      });
      // Refresh batches after import
      loadBatches();
    } catch (err: any) {
      console.error("CSV import error:", err);
      toast({ variant: "destructive", title: "Import failed", description: err?.message ?? String(err) });
    } finally {
      // reset input so the same file can be chosen again later
      e.currentTarget.value = "";
    }
  };

  const handleTransplantCancel = () => {
    setIsTransplantDialogOpen(false);
    setBatchToTransplant(null);
  };

  const handleEditCancel = () => {
    setIsEditDialogOpen(false);
    setBatchToEdit(null);
  };

  if (authLoading || !user) {
     return (
        <div className="flex min-h-screen w-full flex-col p-6 items-center justify-center">
            <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-3 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
                <h1 className="mb-1 font-headline text-2xl sm:text-4xl truncate">Manage Batch Data</h1>
                <p className="text-muted-foreground">View, search, and manage all batch records.</p>
            </div>
            <Button asChild variant="outline">
                <Link href="/settings">
                    <ArrowLeft />
                    Back to Data Management
                </Link>
            </Button>
        </div>

        <Card className="[content-visibility:auto]"> {/* Add content-visibility for potential performance */}
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <CardTitle>All Batches</CardTitle>
                        <CardDescription>A complete history of all batches recorded in the system.</CardDescription>
                    </div>
                     <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-2">
                      <Button variant="outline" onClick={downloadCsv} className="w-full sm:w-auto">
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                      </Button>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={handleCsvFile}
                      />
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full sm:w-auto">
                        <Upload className="mr-2 h-4 w-4" />
                        Import CSV
                      </Button>
                    </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center justify-between pt-4"> {/* Adjusted class */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search by number, category, family, variety..."
                          className="pl-10 w-full"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={handleSearchKeyDown}
                        />
                    </div>
                    <div className="flex gap-2">
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="shrink-0 w-full sm:w-auto">
                            <Filter className="mr-2" />
                            Filter
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56">
                            <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuRadioGroup value={filters.status} onValueChange={(value) => setFilters(f => ({ ...f, status: value }))}>
                            {statuses.map(status => (
                                <DropdownMenuRadioItem key={status} value={status}>{status === 'all' ? 'All Statuses' : status}</DropdownMenuRadioItem>
                            ))}
                            </DropdownMenuRadioGroup>

                            <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuRadioGroup value={filters.category} onValueChange={(value) => setFilters(f => ({ ...f, category: value }))}>
                            {categories.map(cat => (
                                <DropdownMenuRadioItem key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</DropdownMenuRadioItem>
                            ))}
                            </DropdownMenuRadioGroup>
                            
                            <DropdownMenuLabel>Filter by Plant Family</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuRadioGroup value={filters.plantFamily} onValueChange={(value) => setFilters(f => ({ ...f, plantFamily: value }))}>
                            {plantFamilies.map(fam => (
                                <DropdownMenuRadioItem key={fam} value={fam}>{fam === 'all' ? 'All Families' : fam}</DropdownMenuRadioItem>
                            ))}
                            </DropdownMenuRadioGroup>

                        </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {isDataLoading ? (
                    <div className="space-y-2">
                        {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                ) : (
                    <div className="w-full overflow-x-auto">
                      <Table>
                          <TableHeader>
                          <TableRow>
                              <TableHead>Batch #</TableHead>
                              <TableHead>Variety</TableHead>
                              <TableHead>Family</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Location</TableHead>
                              <TableHead>Size</TableHead>
                              <TableHead className="text-right">Current Qty</TableHead>
                              <TableHead className="text-right">Initial Qty</TableHead>
                              <TableHead>Created</TableHead>
                          </TableRow>
                          </TableHeader>
                          <TableBody>
                          {filteredBatches.map((batch) => (
                              <TableRow key={batch.id} onClick={() => handleViewDetails(batch)} className="cursor-pointer">
                                  <TableCell className="font-medium">{batch.batchNumber}</TableCell>
                                  <TableCell>{batch.plantVariety}</TableCell>
                                  <TableCell>{batch.plantFamily}</TableCell>
                                  <TableCell>
                                      <Badge variant={getStatusVariant(batch.status)}>{batch.status}</Badge>
                                  </TableCell>
                                  <TableCell>{batch.location}</TableCell>
                                  <TableCell>{batch.size}</TableCell>
                                  <TableCell className="text-right font-semibold">{batch.quantity.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">{batch.initialQuantity.toLocaleString()}</TableCell>
                                  <TableCell>{formatDate(batch.createdAt)}</TableCell>
                              </TableRow>
                          ))}
                          </TableBody>
                      </Table>
                    </div>
                )}
                 {filteredBatches.length === 0 && !isDataLoading && (
                    <div className="flex h-[20vh] flex-col items-center justify-center rounded-lg text-center">
                        <p className="text-lg font-medium text-muted-foreground">
                        No batches found.
                        </p>
                        <p className="text-sm text-muted-foreground">
                        Try adjusting your search or filters.
                        </p>
                    </div>
                )}
            </CardContent>
             <CardContent className="md:hidden">
                {/* Mobile: stacked cards */}
                <div className="space-y-3 [content-visibility:auto]"> {/* Added content-visibility */}
                  {filteredBatches.map((b) => (
                    <MobileBatchCard
                      key={b.id}
                      batch={b}
                      onView={handleViewDetails}
                      onEdit={handleEditBatch}
                      onDelete={handleDeleteBatch}
                      onTransplant={handleTransplant}
                    />
                  ))}
                  {filteredBatches.length === 0 && !isDataLoading && (
                    <div className="flex h-[20vh] flex-col items-center justify-center rounded-lg text-center">
                      <p className="text-lg font-medium text-muted-foreground">No batches found.</p>
                      <p className="text-sm text-muted-foreground">Try adjusting your search or filters.</p>
                    </div>
                  )}
                </div>
              </CardContent>

        </Card>

      {/* Batch Detail Dialog */}
      <BatchDetailDialog
        open={isBatchDetailDialogOpen}
        onOpenChange={setIsBatchDetailDialogOpen}
        batch={selectedBatch}
        onEdit={handleEditBatch}
        onTransplant={handleTransplant}
        onLogAction={() => console.log("Log action for batch:", selectedBatch?.id)} // Placeholder
        onGenerateProtocol={() => console.log("Generate protocol for batch:", selectedBatch?.id)} // Placeholder
        onDelete={handleDeleteBatch}
        onCareRecommendations={() => console.log("Care recommendations for batch:", selectedBatch?.id)}
      />

      {/* Transplant Dialog */}
      <Dialog open={isTransplantDialogOpen} onOpenChange={setIsTransplantDialogOpen}>
        {batchToTransplant && (
          <TransplantForm
            batch={batchToTransplant}
            nurseryLocations={nurseryLocations}
            plantSizes={plantSizes}
            onSubmit={handleTransplantSubmit}
            onCancel={handleTransplantCancel}
          />
        )}
      </Dialog>

      {/* Edit Batch Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        {batchToEdit && (
          <BatchForm
            batch={batchToEdit}
            onSubmitSuccess={async () => {
              setIsEditDialogOpen(false);
              setBatchToEdit(null);
              await loadBatches(); // Refresh list after edit
              toast({ title: "Saved", description: `Batch #${batchToEdit.batchNumber} updated.` }); // Assuming batchToEdit still holds the number
            }}
            onCancel={handleEditCancel}
            onArchive={() => { /* Optional: handle archive */ }} // Placeholder
            varieties={[]}
            nurseryLocations={nurseryLocations}
            plantSizes={plantSizes}
            suppliers={[]}
            onCreateNewVariety={(name: string) => { console.log("Create new variety:", name); }}
          />
        )}
      </Dialog>
    </div>
  );
}
