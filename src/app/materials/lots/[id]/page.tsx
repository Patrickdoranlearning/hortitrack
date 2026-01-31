'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  MapPin,
  Calendar,
  Printer,
  Edit,
  Trash2,
  AlertTriangle,
  History,
  ArrowRightLeft,
  Minus,
  Plus,
  QrCode,
} from 'lucide-react';
import { PageFrame } from '@/ui/templates';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { MaterialLotWithMaterial, MaterialLotTransaction, MaterialLotStatus } from '@/lib/types/material-lots';

const STATUS_COLORS: Record<MaterialLotStatus, string> = {
  available: 'bg-green-100 text-green-800',
  depleted: 'bg-gray-100 text-gray-800',
  quarantine: 'bg-yellow-100 text-yellow-800',
  damaged: 'bg-red-100 text-red-800',
  expired: 'bg-orange-100 text-orange-800',
};

const TRANSACTION_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  receive: { label: 'Received', color: 'text-green-600' },
  consume: { label: 'Consumed', color: 'text-blue-600' },
  adjust: { label: 'Adjusted', color: 'text-orange-600' },
  transfer: { label: 'Transferred', color: 'text-purple-600' },
  scrap: { label: 'Scrapped', color: 'text-red-600' },
  split: { label: 'Split', color: 'text-cyan-600' },
  merge: { label: 'Merged', color: 'text-indigo-600' },
  return: { label: 'Returned', color: 'text-gray-600' },
};

export default function LotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const lotId = params.id as string;

  const [lot, setLot] = useState<MaterialLotWithMaterial | null>(null);
  const [transactions, setTransactions] = useState<MaterialLotTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    async function fetchLot() {
      setLoading(true);
      try {
        const res = await fetch(`/api/materials/lots/${lotId}?includeTransactions=true`);
        if (!res.ok) throw new Error('Failed to fetch lot');

        const data = await res.json();
        setLot(data.lot);
        setTransactions(data.transactions || []);
      } catch (error) {
        console.error('Error fetching lot:', error);
      } finally {
        setLoading(false);
      }
    }

    if (lotId) {
      fetchLot();
    }
  }, [lotId]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const handleAdjust = async () => {
    if (!adjustQuantity || !adjustReason) return;

    setAdjusting(true);
    try {
      const res = await fetch(`/api/materials/lots/${lotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adjust',
          quantity: parseFloat(adjustQuantity),
          reason: adjustReason,
          notes: adjustNotes || undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to adjust lot');

      const data = await res.json();
      setLot(data.lot);
      setAdjustDialogOpen(false);
      setAdjustQuantity('');
      setAdjustReason('');
      setAdjustNotes('');

      // Refresh transactions
      const txnRes = await fetch(`/api/materials/lots/${lotId}?includeTransactions=true`);
      if (txnRes.ok) {
        const txnData = await txnRes.json();
        setTransactions(txnData.transactions || []);
      }
    } catch (error) {
      console.error('Error adjusting lot:', error);
    } finally {
      setAdjusting(false);
    }
  };

  if (loading) {
    return (
      <PageFrame moduleKey="materials">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </PageFrame>
    );
  }

  if (!lot) {
    return (
      <PageFrame moduleKey="materials">
        <div className="text-center py-20">
          <p className="text-muted-foreground">Lot not found</p>
          <Button asChild className="mt-4">
            <Link href="/materials/lots">Back to Lots</Link>
          </Button>
        </div>
      </PageFrame>
    );
  }

  const quantityPercentage = Math.round((lot.currentQuantity / lot.initialQuantity) * 100);

  return (
    <PageFrame moduleKey="materials">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/materials/lots">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold font-mono">{lot.lotNumber}</h1>
              <p className="text-muted-foreground">{lot.material?.name}</p>
            </div>
            <Badge className={STATUS_COLORS[lot.status]}>{lot.status}</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Printer className="h-4 w-4 mr-2" />
              Print Label
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAdjustDialogOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Adjust
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Main Info */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Lot Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Quantity */}
              <div>
                <Label className="text-sm text-muted-foreground">Quantity</Label>
                <div className="mt-1 flex items-center gap-4">
                  <div className="text-3xl font-bold">
                    {lot.currentQuantity}
                    <span className="text-lg font-normal text-muted-foreground">
                      {' '}/ {lot.initialQuantity} {lot.uom}
                    </span>
                  </div>
                  <div className="flex-1 max-w-xs">
                    <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${quantityPercentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{quantityPercentage}% remaining</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Material</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{lot.material?.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{lot.material?.partNumber}</p>
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground">Category</Label>
                  <div className="mt-1">{lot.material?.category?.name || '-'}</div>
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground">Unit Type</Label>
                  <div className="mt-1 capitalize">{lot.unitType}</div>
                  {lot.unitsPerPackage && (
                    <p className="text-sm text-muted-foreground">
                      {lot.unitsPerPackage} {lot.uom} per {lot.unitType}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground">Location</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {lot.location?.name || 'Not assigned'}
                  </div>
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground">Received</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {formatDate(lot.receivedAt)}
                  </div>
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground">Expiry</Label>
                  <div className="mt-1">
                    {lot.expiryDate ? (
                      <span className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {formatDate(lot.expiryDate)}
                      </span>
                    ) : (
                      '-'
                    )}
                  </div>
                </div>
              </div>

              {(lot.supplier || lot.supplierLotNumber) && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    {lot.supplier && (
                      <div>
                        <Label className="text-sm text-muted-foreground">Supplier</Label>
                        <div className="mt-1">{lot.supplier.name}</div>
                      </div>
                    )}
                    {lot.supplierLotNumber && (
                      <div>
                        <Label className="text-sm text-muted-foreground">Supplier Lot #</Label>
                        <div className="mt-1 font-mono">{lot.supplierLotNumber}</div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {lot.notes && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-sm text-muted-foreground">Notes</Label>
                    <p className="mt-1">{lot.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Barcode Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Barcode
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="bg-white p-4 rounded-lg border mb-4">
                  <div className="text-xs text-muted-foreground mb-2">DataMatrix Code</div>
                  <div className="font-mono text-sm break-all">{lot.lotBarcode}</div>
                </div>
                <Button variant="outline" className="w-full">
                  <Printer className="h-4 w-4 mr-2" />
                  Print Label
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Transaction History
            </CardTitle>
            <CardDescription>All movements and adjustments for this lot</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No transactions recorded</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn) => {
                    const typeInfo = TRANSACTION_TYPE_LABELS[txn.transactionType] || {
                      label: txn.transactionType,
                      color: 'text-gray-600',
                    };
                    return (
                      <TableRow key={txn.id}>
                        <TableCell>{formatDateTime(txn.createdAt)}</TableCell>
                        <TableCell>
                          <span className={`font-medium ${typeInfo.color}`}>
                            {typeInfo.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              txn.quantity > 0
                                ? 'text-green-600'
                                : txn.quantity < 0
                                ? 'text-red-600'
                                : ''
                            }
                          >
                            {txn.quantity > 0 ? '+' : ''}
                            {txn.quantity} {txn.uom}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {txn.quantityAfter} {txn.uom}
                        </TableCell>
                        <TableCell>
                          {txn.batch ? (
                            <Link
                              href={`/production/batches/${txn.batch.id}`}
                              className="text-primary hover:underline"
                            >
                              {txn.batch.batchNumber}
                            </Link>
                          ) : txn.reference ? (
                            txn.reference
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{txn.notes || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Adjust Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Quantity</DialogTitle>
            <DialogDescription>
              Enter a positive number to add or negative to subtract from the current quantity of{' '}
              {lot.currentQuantity} {lot.uom}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Adjustment Amount</Label>
              <div className="flex items-center gap-2 mt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setAdjustQuantity((prev) => String(-Math.abs(parseFloat(prev) || 0)))
                  }
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(e.target.value)}
                  placeholder="e.g., -10 or +50"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setAdjustQuantity((prev) => String(Math.abs(parseFloat(prev) || 0)))
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label>Reason</Label>
              <Input
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g., Damaged, Stock count correction"
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                placeholder="Additional details..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdjust}
              disabled={!adjustQuantity || !adjustReason || adjusting}
            >
              {adjusting ? 'Adjusting...' : 'Adjust'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageFrame>
  );
}
