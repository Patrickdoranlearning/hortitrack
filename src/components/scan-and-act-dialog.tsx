'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { doc, getDoc, getDocs, query, where, collection } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import DataMatrixScanner from '@/components/DataMatrixScanner';
import { format } from 'date-fns';
import { Camera, ImagePlus, NotebookPen, ScanLine, Move, Scissors, Trash2, Sprout } from 'lucide-react';

type Batch = {
  id: string;
  batchNumber: number;
  plantVariety: string;
  plantFamily: string;
  category: string;
  size: string;
  location: string;
  status: string;
  quantity: number;
  initialQuantity: number;
  supplier?: string;
  createdAt?: string | number | Date;
  plantingDate?: string | number | Date;
  updatedAt?: string | number | Date;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** optional: called when a batch action changes data so you can refresh lists */
  onChanged?: () => void;
};

/** Normalize possible payloads: id, number, or URL query param like ?batch=123 */
function parseScan(text: string) {
  const t = text.trim();

  // Try URL with ?batch=... or ?id=...
  try {
    const url = new URL(t);
    const byBatch = url.searchParams.get('batch');
    const byId = url.searchParams.get('id');
    if (byBatch) return { batchNumber: Number(byBatch) };
    if (byId) return { id: byId };
  } catch { /* not a URL */ }

  // pure number? -> probably a batchNumber
  if (/^\d+$/.test(t)) return { batchNumber: Number(t) };

  // looks like a Firestore doc id
  if (/^[A-Za-z0-9_-]{10,}$/.test(t)) return { id: t };

  // fallback: return raw
  return { raw: t };
}

async function resolveBatch(info: ReturnType<typeof parseScan>): Promise<Batch | null> {
  if ('id' in info && info.id) {
    const d = await getDoc(doc(db, 'batches', info.id));
    if (d.exists()) return { id: d.id, ...(d.data() as any) } as Batch;
  }
  if ('batchNumber' in info && Number.isFinite(info.batchNumber)) {
    const snap = await getDocs(
      query(collection(db, 'batches'), where('batchNumber', '==', info.batchNumber))
    );
    const hit = snap.docs[0];
    if (hit) return { id: hit.id, ...(hit.data() as any) } as Batch;
  }
  return null;
}

export default function ScanAndActDialog({ open, onOpenChange, onChanged }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(false);

  // When the scanner returns text -> resolve batch -> open sheet
  const handleScanResult = useCallback(async (text: string) => {
    setLoading(true);
    try {
      const info = parseScan(text);
      const b = await resolveBatch(info);
      setBatch(b);
      setSheetOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const closeAll = useCallback(() => {
    setBatch(null);
    setSheetOpen(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const date = useMemo(() => {
    if (!batch?.createdAt) return '';
    const d = typeof batch.createdAt === 'string' ? new Date(batch.createdAt) : new Date(batch.createdAt);
    return isNaN(d.getTime()) ? '' : format(d, 'PPP');
  }, [batch]);

  // ---- Quick actions -------------------------------------------------------

  async function postLog(action: string, extra?: Record<string, any>) {
    if (!batch) return;
    // Adjust to match your API route if needed
    await fetch(`/api/batches/${batch.id}/log`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: action, ...extra }),
    });
    onChanged?.();
  }

  async function handleMove() {
    if (!batch) return;
    const location = prompt('Move to location:', batch.location || '');
    if (!location) return;
    await fetch(`/api/batches/${batch.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ location }),
    });
    await postLog('Move', { note: `Moved to ${location}` });
    alert('Batch moved.');
    onChanged?.();
  }

  async function handleTransplant() {
    if (!batch) return;
    // Open your transplant dialog instead if you have it; here is a quick inline
    const qty = Number(prompt('New batch quantity:', '0') || '0');
    const size = prompt('Size (e.g. 1L, tray):', '') || '';
    const location = prompt('Location:', batch.location || '') || '';
    const status = prompt('Status:', batch.status || 'Potted') || 'Potted';

    const res = await fetch(`/api/batches/${batch.id}/transplant`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quantity: qty, size, location, status }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || 'Transplant failed');
    }
    const j = await res.json().catch(() => ({}));
    alert(`Transplanted → new batch #${j?.batchNumber ?? 'created'}`);
    onChanged?.();
  }

  // Photo milestone
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleSelectPhoto(file: File) {
    if (!batch) return;
    const path = `batches/${batch.id}/milestones/${Date.now()}-${file.name}`;
    const sref = ref(storage, path);
    await uploadBytes(sref, file);
    const url = await getDownloadURL(sref);
    // record as a log entry
    await postLog('Photo', { photoUrl: url });
    alert('Photo logged.');
  }

  // UI
  return (
    <>
      {/* Dialog wrapper you open from a button in your UI */}
      {open && !sheetOpen && (
        <div className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <ScanLine className="opacity-60" />
            <div className="font-medium">Scan a batch code</div>
          </div>

          <DataMatrixScanner
            autoStart
            onResult={handleScanResult}
            onError={(e) => console.error(e)}
          />

          {loading && <p className="mt-2 text-sm text-muted-foreground">Resolving…</p>}
        </div>
      )}

      {/* Bottom sheet with summary + actions */}
      <Sheet open={sheetOpen} onOpenChange={(v) => (v ? setSheetOpen(true) : closeAll())}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-auto px-4 pb-4">
          <SheetHeader>
            <SheetTitle>
              {batch ? `Batch #${batch.batchNumber}` : 'No match found'}
            </SheetTitle>
            {batch ? (
              <SheetDescription>
                {batch.plantVariety} • {batch.plantFamily} • {batch.category}
              </SheetDescription>
            ) : (
              <SheetDescription>Try rescanning or enter the code manually.</SheetDescription>
            )}
          </SheetHeader>

          {batch ? (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded border p-2">
                  <div className="text-muted-foreground">Status</div>
                  <div className="mt-1"><Badge variant="outline">{batch.status}</Badge></div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-muted-foreground">Location</div>
                  <div className="mt-1">{batch.location || '—'}</div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-muted-foreground">Size</div>
                  <div className="mt-1">{batch.size || '—'}</div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-muted-foreground">Qty (current / initial)</div>
                  <div className="mt-1 font-medium">
                    {batch.quantity?.toLocaleString?.() ?? batch.quantity} / {batch.initialQuantity?.toLocaleString?.() ?? batch.initialQuantity}
                  </div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-muted-foreground">Supplier</div>
                  <div className="mt-1">{batch.supplier || '—'}</div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-muted-foreground">Created</div>
                  <div className="mt-1">{date || '—'}</div>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Quick actions (mobile-friendly grid) */}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="justify-start" onClick={() => postLog('Spaced')}>
                  <Sprout className="mr-2 h-4 w-4" /> Spaced
                </Button>
                <Button variant="outline" className="justify-start" onClick={handleMove}>
                  <Move className="mr-2 h-4 w-4" /> Move
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => postLog('Trimmed')}>
                  <Scissors className="mr-2 h-4 w-4" /> Trimmed
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => postLog('Weed')}>
                  <NotebookPen className="mr-2 h-4 w-4" /> Weed
                </Button>
                <Button variant="destructive" className="justify-start" onClick={() => postLog('Dumped')}>
                  <Trash2 className="mr-2 h-4 w-4" /> Dumped
                </Button>
                <Button variant="default" className="justify-start" onClick={handleTransplant}>
                  <Sprout className="mr-2 h-4 w-4" /> Transplant
                </Button>

                {/* Add Photo */}
                <input
                  ref={(r) => (fileInputRef.current = r)}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      await handleSelectPhoto(file);
                    } catch (err) {
                      console.error(err);
                      alert('Photo upload failed.');
                    } finally {
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="mr-2 h-4 w-4" /> Add Photo
                </Button>

                {/* View details */}
                <Button
                  variant="secondary"
                  className="justify-start"
                  onClick={() => {
                    // route to batch details if you have a page; else open your BatchDetailDialog
                    window.location.href = `/batches/${batch.id}`;
                  }}
                >
                  <Camera className="mr-2 h-4 w-4" /> View Details
                </Button>
              </div>

              <div className="mt-4 flex gap-2">
                <Button variant="outline" onClick={() => setSheetOpen(false)}>
                  Rescan
                </Button>
                <Button variant="ghost" onClick={closeAll}>
                  Done
                </Button>
              </div>
            </>
          ) : (
            <div className="mt-4">
              <Button onClick={() => setSheetOpen(false)}>Rescan</Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
