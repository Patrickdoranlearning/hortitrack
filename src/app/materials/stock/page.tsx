'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import {
  Package,
  Search,
  RefreshCw,
  AlertTriangle,
  TrendingDown,
  ArrowRightLeft,
  Plus,
  Minus,
  ClipboardList,
  History,
  Filter,
} from 'lucide-react';
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { fetchJson } from '@/lib/http/fetchJson';
import type { MaterialCategory } from '@/lib/types/materials';

type StockSummary = {
  materialId: string;
  materialName: string;
  partNumber: string;
  categoryName: string;
  baseUom: string;
  totalOnHand: number;
  totalReserved: number;
  totalAvailable: number;
  reorderPoint: number | null;
  isLowStock: boolean;
};

type StockResponse = {
  stock: StockSummary[];
};

type CategoriesResponse = {
  categories: MaterialCategory[];
};

type AdjustmentMode = 'adjust' | 'count' | 'transfer' | null;

export default function StockDashboardPage() {
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');

  // Dialog state
  const [adjustmentMode, setAdjustmentMode] = useState<AdjustmentMode>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<StockSummary | null>(null);
  const [adjustmentQty, setAdjustmentQty] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentNotes, setAdjustmentNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch categories
  const { data: categoriesData } = useSWR<CategoriesResponse>(
    '/api/materials/categories',
    (url) => fetchJson(url)
  );

  // Fetch stock summary
  const {
    data: stockData,
    mutate: mutateStock,
    isValidating,
  } = useSWR<StockResponse>('/api/materials/stock', (url) => fetchJson(url), {
    revalidateOnFocus: false,
  });

  const categories = categoriesData?.categories ?? [];
  const stockItems = stockData?.stock ?? [];

  // Get unique category names from stock items
  const stockCategories = useMemo(() => {
    const cats = new Set<string>();
    stockItems.forEach((item) => cats.add(item.categoryName));
    return Array.from(cats).sort();
  }, [stockItems]);

  // Filter stock items
  const filteredStock = useMemo(() => {
    return stockItems.filter((item) => {
      // Search filter
      if (
        search &&
        !item.materialName.toLowerCase().includes(search.toLowerCase()) &&
        !item.partNumber.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }

      // Category filter
      if (categoryFilter !== 'all' && item.categoryName !== categoryFilter) {
        return false;
      }

      // Stock level filter
      if (stockFilter === 'low' && !item.isLowStock) {
        return false;
      }
      if (stockFilter === 'out' && item.totalOnHand > 0) {
        return false;
      }

      return true;
    });
  }, [stockItems, search, categoryFilter, stockFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = stockItems.length;
    const lowStock = stockItems.filter((i) => i.isLowStock).length;
    const outOfStock = stockItems.filter((i) => i.totalOnHand <= 0).length;
    const reserved = stockItems.reduce((sum, i) => sum + i.totalReserved, 0);
    return { total, lowStock, outOfStock, reserved };
  }, [stockItems]);

  const getCategoryColor = (categoryName: string) => {
    const cat = categories.find((c) => c.name === categoryName);
    if (!cat) return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';

    switch (cat.parentGroup) {
      case 'Containers':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Growing Media':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Labels/Tags':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'Chemicals':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const openAdjustmentDialog = (material: StockSummary, mode: AdjustmentMode) => {
    setSelectedMaterial(material);
    setAdjustmentMode(mode);
    setAdjustmentQty(mode === 'count' ? material.totalOnHand : 0);
    setAdjustmentReason('');
    setAdjustmentNotes('');
  };

  const handleAdjustment = async () => {
    if (!selectedMaterial || !adjustmentMode) return;

    setIsSubmitting(true);
    try {
      if (adjustmentMode === 'transfer') {
        // Transfer would need additional location fields - simplified for now
        toast({
          title: 'Transfer feature',
          description: 'Location-based transfers will be available in a future update.',
        });
        setAdjustmentMode(null);
        return;
      }

      await fetchJson(`/api/materials/${selectedMaterial.materialId}/stock/adjust`, {
        method: 'POST',
        body: JSON.stringify({
          quantity: adjustmentQty,
          reason: adjustmentReason || (adjustmentMode === 'count' ? 'Physical count' : 'Manual adjustment'),
          notes: adjustmentNotes || undefined,
          isCount: adjustmentMode === 'count',
        }),
      });

      toast({
        title: adjustmentMode === 'count' ? 'Count recorded' : 'Stock adjusted',
        description: `${selectedMaterial.partNumber} updated successfully.`,
      });

      setAdjustmentMode(null);
      setSelectedMaterial(null);
      mutateStock();
    } catch (error) {
      toast({
        title: 'Failed to update stock',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageFrame moduleKey="materials">
      <div className="space-y-6">
        <ModulePageHeader
          title="Stock Levels"
          description="Monitor stock levels, record counts, and make adjustments."
          actionsSlot={
            <Button
              variant="outline"
              size="icon"
              onClick={() => mutateStock()}
              disabled={isValidating}
            >
              <RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} />
            </Button>
          }
        />

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Materials
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold">{stats.total}</span>
              </div>
            </CardContent>
          </Card>

          <Card className={stats.lowStock > 0 ? 'border-amber-500' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Low Stock Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-amber-500" />
                <span className="text-2xl font-bold">{stats.lowStock}</span>
              </div>
            </CardContent>
          </Card>

          <Card className={stats.outOfStock > 0 ? 'border-destructive' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Out of Stock
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <span className="text-2xl font-bold">{stats.outOfStock}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Reserved Qty
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold">{stats.reserved.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or part number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {stockCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={stockFilter} onValueChange={setStockFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stock</SelectItem>
                    <SelectItem value="low">Low Stock</SelectItem>
                    <SelectItem value="out">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stock Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Stock Overview ({filteredStock.length})
            </CardTitle>
            <CardDescription>
              Click on a row to view details or make adjustments
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isValidating && !stockItems.length ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredStock.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No stock records found</p>
                <p className="text-sm">
                  {search || categoryFilter !== 'all' || stockFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Stock records will appear here once materials are added'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Part Number</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">On Hand</TableHead>
                      <TableHead className="text-right">Reserved</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">Reorder Point</TableHead>
                      <TableHead className="w-[180px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStock.map((item) => (
                      <TableRow
                        key={item.materialId}
                        className={item.isLowStock ? 'bg-amber-50 dark:bg-amber-950/20' : ''}
                      >
                        <TableCell className="font-mono text-sm">{item.partNumber}</TableCell>
                        <TableCell className="font-medium">
                          {item.materialName}
                          {item.isLowStock && (
                            <Badge variant="outline" className="ml-2 text-amber-600 border-amber-600">
                              Low
                            </Badge>
                          )}
                          {item.totalOnHand <= 0 && (
                            <Badge variant="destructive" className="ml-2">
                              Out
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getCategoryColor(item.categoryName)}>
                            {item.categoryName}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.totalOnHand.toLocaleString()} {item.baseUom}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.totalReserved > 0 ? item.totalReserved.toLocaleString() : '—'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.totalAvailable.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.reorderPoint ?? '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Add stock"
                              onClick={() => {
                                setSelectedMaterial(item);
                                setAdjustmentMode('adjust');
                                setAdjustmentQty(0);
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Remove stock"
                              onClick={() => {
                                setSelectedMaterial(item);
                                setAdjustmentMode('adjust');
                                setAdjustmentQty(0);
                              }}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Record count"
                              onClick={() => openAdjustmentDialog(item, 'count')}
                            >
                              <ClipboardList className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Transfer"
                              onClick={() => openAdjustmentDialog(item, 'transfer')}
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Adjustment Dialog */}
      <Dialog open={!!adjustmentMode} onOpenChange={(open) => !open && setAdjustmentMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {adjustmentMode === 'count'
                ? 'Record Physical Count'
                : adjustmentMode === 'transfer'
                  ? 'Transfer Stock'
                  : 'Adjust Stock'}
            </DialogTitle>
            <DialogDescription>
              {selectedMaterial && (
                <>
                  <span className="font-mono">{selectedMaterial.partNumber}</span> -{' '}
                  {selectedMaterial.materialName}
                  <br />
                  Current stock: {selectedMaterial.totalOnHand.toLocaleString()}{' '}
                  {selectedMaterial.baseUom}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {adjustmentMode === 'count' ? (
              <div className="space-y-2">
                <Label htmlFor="count-qty">Counted Quantity</Label>
                <Input
                  id="count-qty"
                  type="number"
                  min={0}
                  value={adjustmentQty}
                  onChange={(e) => setAdjustmentQty(parseInt(e.target.value) || 0)}
                />
                <p className="text-sm text-muted-foreground">
                  Enter the actual quantity counted. An adjustment will be calculated automatically.
                </p>
                {selectedMaterial && adjustmentQty !== selectedMaterial.totalOnHand && (
                  <p className="text-sm font-medium">
                    Adjustment:{' '}
                    <span
                      className={
                        adjustmentQty > selectedMaterial.totalOnHand
                          ? 'text-green-600'
                          : 'text-red-600'
                      }
                    >
                      {adjustmentQty > selectedMaterial.totalOnHand ? '+' : ''}
                      {adjustmentQty - selectedMaterial.totalOnHand}
                    </span>
                  </p>
                )}
              </div>
            ) : adjustmentMode === 'transfer' ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Location-based stock transfers require additional configuration. This feature will
                  be available once locations are set up.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="adjust-qty">Adjustment Quantity</Label>
                  <Input
                    id="adjust-qty"
                    type="number"
                    value={adjustmentQty}
                    onChange={(e) => setAdjustmentQty(parseInt(e.target.value) || 0)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Positive to add, negative to remove
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason</Label>
                  <Select value={adjustmentReason} onValueChange={setAdjustmentReason}>
                    <SelectTrigger id="reason">
                      <SelectValue placeholder="Select reason..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="received">Goods Received</SelectItem>
                      <SelectItem value="damaged">Damaged/Broken</SelectItem>
                      <SelectItem value="lost">Lost/Missing</SelectItem>
                      <SelectItem value="returned">Returned</SelectItem>
                      <SelectItem value="correction">Correction</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={adjustmentNotes}
                onChange={(e) => setAdjustmentNotes(e.target.value)}
                placeholder="Add any additional notes..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustmentMode(null)}>
              Cancel
            </Button>
            {adjustmentMode !== 'transfer' && (
              <Button onClick={handleAdjustment} disabled={isSubmitting}>
                {isSubmitting
                  ? 'Saving...'
                  : adjustmentMode === 'count'
                    ? 'Record Count'
                    : 'Apply Adjustment'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageFrame>
  );
}
