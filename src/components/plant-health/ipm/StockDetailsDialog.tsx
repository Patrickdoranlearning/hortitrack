'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/lib/toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Package,
  FlaskConical,
  MoreHorizontal,
  Trash2,
  History,
  AlertTriangle,
  Loader2,
  Plus,
  Printer,
} from 'lucide-react';
import {
  listBottles,
  disposeBottle,
  getMovementsForBottle,
  type IpmBottle,
  type IpmStockMovement,
  type IpmStockSummary,
} from '@/app/actions/ipm-stock';
import type { IpmProduct } from '@/app/actions/ipm';
import { AddStockDialog } from './AddStockDialog';

type StockDetailsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: IpmProduct;
  stockSummary?: IpmStockSummary;
  onRefresh?: () => void;
};

export function StockDetailsDialog({
  open,
  onOpenChange,
  product,
  stockSummary,
  onRefresh,
}: StockDetailsDialogProps) {
  const [bottles, setBottles] = useState<IpmBottle[]>([]);
  const [loading, setLoading] = useState(false);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [disposeDialogOpen, setDisposeDialogOpen] = useState(false);
  const [bottleToDispose, setBottleToDispose] = useState<IpmBottle | null>(null);
  const [historyBottle, setHistoryBottle] = useState<IpmBottle | null>(null);
  const [movements, setMovements] = useState<IpmStockMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  const fetchBottles = useCallback(async () => {
    setLoading(true);
    const result = await listBottles({ productId: product.id });
    if (result.success && result.data) {
      setBottles(result.data);
    }
    setLoading(false);
  }, [product.id]);

  useEffect(() => {
    if (open) {
      fetchBottles();
    }
  }, [open, fetchBottles]);

  const handleDispose = async () => {
    if (!bottleToDispose) return;
    const result = await disposeBottle(bottleToDispose.id, 'Disposed via stock management');
    if (result.success) {
      toast.success('Bottle disposed');
      fetchBottles();
      onRefresh?.();
    } else {
      toast.error(result.error || 'Failed to dispose bottle');
    }
    setBottleToDispose(null);
    setDisposeDialogOpen(false);
  };

  const confirmDispose = (bottle: IpmBottle) => {
    setBottleToDispose(bottle);
    setDisposeDialogOpen(true);
  };

  const showHistory = async (bottle: IpmBottle) => {
    setHistoryBottle(bottle);
    setLoadingMovements(true);
    const result = await getMovementsForBottle(bottle.id);
    if (result.success && result.data) {
      setMovements(result.data);
    }
    setLoadingMovements(false);
  };

  const handleAddStockSuccess = () => {
    fetchBottles();
    onRefresh?.();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sealed':
        return <Badge variant="secondary">Sealed</Badge>;
      case 'open':
        return <Badge variant="default">Open</Badge>;
      case 'empty':
        return <Badge variant="outline">Empty</Badge>;
      case 'disposed':
        return <Badge variant="destructive">Disposed</Badge>;
      case 'expired':
        return <Badge variant="destructive">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const activeBottles = bottles.filter(b => b.status === 'sealed' || b.status === 'open');
  const historicBottles = bottles.filter(b => b.status === 'empty' || b.status === 'disposed' || b.status === 'expired');

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {product.name} - Stock
            </DialogTitle>
            <DialogDescription>
              Manage individual bottles and view usage history
            </DialogDescription>
          </DialogHeader>

          {/* Stock Summary */}
          {stockSummary && (
            <div className="grid grid-cols-3 gap-4 py-2">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{stockSummary.bottlesInStock}</p>
                <p className="text-xs text-muted-foreground">Bottles in Stock</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">
                  {(stockSummary.totalRemainingMl / 1000).toFixed(1)}L
                </p>
                <p className="text-xs text-muted-foreground">Total Volume</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">
                  {(stockSummary.usageLast30DaysMl / 1000).toFixed(1)}L
                </p>
                <p className="text-xs text-muted-foreground">Used (30 days)</p>
              </div>
            </div>
          )}

          {/* Low Stock Warning */}
          {stockSummary?.isLowStock && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">
                Low stock! Only {stockSummary.bottlesInStock} bottle(s) remaining.
              </span>
            </div>
          )}

          {/* Tabs */}
          <Tabs defaultValue="active" className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="active">
                  Active ({activeBottles.length})
                </TabsTrigger>
                <TabsTrigger value="history">
                  History ({historicBottles.length})
                </TabsTrigger>
              </TabsList>
              <Button size="sm" onClick={() => setAddStockOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Stock
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto mt-4">
              <TabsContent value="active" className="mt-0">
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    <p className="mt-2">Loading bottles...</p>
                  </div>
                ) : activeBottles.length === 0 ? (
                  <div className="text-center py-8">
                    <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground/50" />
                    <p className="mt-4 text-muted-foreground">No bottles in stock</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setAddStockOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Stock
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Remaining</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeBottles.map((bottle) => {
                        const percentRemaining = Math.round(
                          (bottle.remainingMl / bottle.volumeMl) * 100
                        );
                        return (
                          <TableRow key={bottle.id}>
                            <TableCell>
                              <span className="font-mono font-semibold">
                                {bottle.bottleCode}
                              </span>
                            </TableCell>
                            <TableCell>{getStatusBadge(bottle.status)}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                  <span>{bottle.remainingMl}ml</span>
                                  <span className="text-muted-foreground">
                                    {percentRemaining}%
                                  </span>
                                </div>
                                <Progress value={percentRemaining} className="h-1" />
                              </div>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => showHistory(bottle)}>
                                    <History className="mr-2 h-4 w-4" />
                                    View History
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => confirmDispose(bottle)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Dispose
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-0">
                {historicBottles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No historic bottles yet
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Volume</TableHead>
                        <TableHead>Opened</TableHead>
                        <TableHead>Finished</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historicBottles.map((bottle) => (
                        <TableRow key={bottle.id}>
                          <TableCell>
                            <span className="font-mono text-muted-foreground">
                              {bottle.bottleCode}
                            </span>
                          </TableCell>
                          <TableCell>{getStatusBadge(bottle.status)}</TableCell>
                          <TableCell>{bottle.volumeMl}ml</TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {bottle.openedAt
                                ? new Date(bottle.openedAt).toLocaleDateString()
                                : '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {bottle.emptiedAt
                                ? new Date(bottle.emptiedAt).toLocaleDateString()
                                : '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => showHistory(bottle)}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Add Stock Dialog */}
      <AddStockDialog
        open={addStockOpen}
        onOpenChange={setAddStockOpen}
        product={product}
        onSuccess={handleAddStockSuccess}
      />

      {/* Dispose Confirmation */}
      <AlertDialog open={disposeDialogOpen} onOpenChange={setDisposeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dispose Bottle</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to dispose bottle "{bottleToDispose?.bottleCode}"?
              {bottleToDispose && bottleToDispose.remainingMl > 0 && (
                <span className="block mt-2 text-amber-600">
                  Warning: This bottle still has {bottleToDispose.remainingMl}ml remaining.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDispose}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Dispose
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* History Dialog */}
      <Dialog open={!!historyBottle} onOpenChange={() => setHistoryBottle(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              Usage History: {historyBottle?.bottleCode}
            </DialogTitle>
          </DialogHeader>
          {loadingMovements ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No movements recorded
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {movements.map((movement) => (
                <div
                  key={movement.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium capitalize">
                      {movement.movementType}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(movement.recordedAt).toLocaleString()}
                    </p>
                    {movement.location && (
                      <p className="text-xs text-muted-foreground">
                        @ {movement.location.name}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {movement.quantityMl > 0 ? '+' : ''}
                      {movement.quantityMl}ml
                    </p>
                    <p className="text-xs text-muted-foreground">
                      → {movement.remainingAfterMl}ml left
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

