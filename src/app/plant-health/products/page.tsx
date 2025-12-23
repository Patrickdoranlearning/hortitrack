'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  FlaskConical,
  Bug,
  Clock,
  Leaf,
  Package,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageFrame } from '@/ui/templates';
import { ModulePageHeader } from '@/ui/templates';
import { ProductDialog } from '@/components/plant-health/ipm/ProductDialog';
import { StockDetailsDialog } from '@/components/plant-health/ipm/StockDetailsDialog';
import { AddStockDialog } from '@/components/plant-health/ipm/AddStockDialog';
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
} from '@/components/ui/dialog';
import {
  listIpmProducts,
  deleteIpmProduct,
  type IpmProduct,
} from '@/app/actions/ipm';
import {
  getStockSummary,
  type IpmStockSummary,
} from '@/app/actions/ipm-stock';

export default function IpmProductsPage() {
  const [products, setProducts] = useState<IpmProduct[]>([]);
  const [stockSummaries, setStockSummaries] = useState<Map<string, IpmStockSummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<IpmProduct | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<IpmProduct | null>(null);
  const [stockDialogProduct, setStockDialogProduct] = useState<IpmProduct | null>(null);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [addStockProduct, setAddStockProduct] = useState<IpmProduct | null>(null);
  const [selectProductOpen, setSelectProductOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [productsResult, stockResult] = await Promise.all([
      listIpmProducts(),
      getStockSummary(),
    ]);
    
    if (productsResult.success && productsResult.data) {
      setProducts(productsResult.data);
    } else {
      toast.error('Failed to load products');
    }
    
    if (stockResult.success && stockResult.data) {
      const summaryMap = new Map<string, IpmStockSummary>();
      stockResult.data.forEach(s => summaryMap.set(s.productId, s));
      setStockSummaries(summaryMap);
    }
    
    setLoading(false);
  }, []);

  // Alias for backward compatibility
  const fetchProducts = fetchData;

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredProducts = products.filter((product) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      product.name.toLowerCase().includes(q) ||
      product.activeIngredient?.toLowerCase().includes(q) ||
      product.pcsNumber?.toLowerCase().includes(q) ||
      product.targetPests.some((p) => p.toLowerCase().includes(q))
    );
  });

  const handleEdit = (product: IpmProduct) => {
    setEditingProduct(product);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!productToDelete) return;
    const result = await deleteIpmProduct(productToDelete.id);
    if (result.success) {
      toast.success('Product deleted');
      fetchProducts();
    } else {
      toast.error(result.error || 'Failed to delete product');
    }
    setProductToDelete(null);
    setDeleteDialogOpen(false);
  };

  const confirmDelete = (product: IpmProduct) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingProduct(null);
    }
  };

  return (
    <PageFrame moduleKey="plantHealth">
      <div className="space-y-6">
        <ModulePageHeader
          title="IPM Products"
          description="Manage your IPM product database"
          actionsSlot={
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setSelectProductOpen(true)} 
                className="gap-2"
                disabled={products.length === 0}
              >
                <Package className="h-4 w-4" />
                Add Stock
              </Button>
              <Button onClick={() => setDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                New Product
              </Button>
            </div>
          }
        />

        {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search products, ingredients, pests..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Target Pests</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Restrictions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Loading products...
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">
                    {searchQuery ? 'No products match your search' : 'No IPM products yet'}
                  </p>
                  {!searchQuery && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setDialogOpen(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add your first product
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => {
                const stock = stockSummaries.get(product.id);
                return (
                <TableRow key={product.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{product.name}</div>
                      {product.pcsNumber && (
                        <div className="text-xs text-muted-foreground">
                          PCS: {product.pcsNumber}
                        </div>
                      )}
                      {product.activeIngredient && (
                        <div className="text-xs text-muted-foreground">
                          {product.activeIngredient}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto py-1 px-2 -ml-2"
                      onClick={() => setStockDialogProduct(product)}
                    >
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <div className="text-left">
                          <div className="flex items-center gap-1">
                            <span className="font-semibold">
                              {stock?.bottlesInStock ?? 0}
                            </span>
                            <span className="text-muted-foreground text-xs">bottles</span>
                            {stock?.isLowStock && (
                              <AlertTriangle className="h-3 w-3 text-amber-500" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {stock ? `${(stock.totalRemainingMl / 1000).toFixed(1)}L` : '0L'}
                          </div>
                        </div>
                      </div>
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {product.targetPests.length > 0 ? (
                        product.targetPests.slice(0, 3).map((pest) => (
                          <Badge key={pest} variant="outline" className="text-xs gap-1">
                            <Bug className="h-3 w-3" />
                            {pest}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                      {product.targetPests.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{product.targetPests.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {product.suggestedRate ? (
                      <span className="text-sm">
                        {product.suggestedRate} {product.suggestedRateUnit}
                        {product.maxRate && (
                          <span className="text-muted-foreground">
                            {' '}(max {product.maxRate})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {product.useRestriction !== 'both' && (
                        <Badge
                          variant={product.useRestriction === 'indoor' ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          <Leaf className="h-3 w-3 mr-1" />
                          {product.useRestriction}
                        </Badge>
                      )}
                      {(product.harvestIntervalDays ?? 0) > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {product.harvestIntervalDays}d harvest
                        </Badge>
                      )}
                      {product.reiHours > 0 && (
                        <Badge variant="outline" className="text-xs">
                          REI {product.reiHours}h
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.isActive ? 'default' : 'secondary'}>
                      {product.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(product)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setStockDialogProduct(product)}>
                          <Package className="mr-2 h-4 w-4" />
                          Manage Stock
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => confirmDelete(product)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );})
            )}
          </TableBody>
        </Table>
      </div>

      {/* Product Dialog */}
      <ProductDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        product={editingProduct}
        onSuccess={fetchProducts}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{productToDelete?.name}"? This action cannot be undone.
              Products that are used in IPM programs cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stock Details Dialog */}
      {stockDialogProduct && (
        <StockDetailsDialog
          open={!!stockDialogProduct}
          onOpenChange={(open) => !open && setStockDialogProduct(null)}
          product={stockDialogProduct}
          stockSummary={stockSummaries.get(stockDialogProduct.id)}
          onRefresh={fetchData}
        />
      )}

      {/* Select Product for Stock Dialog */}
      <Dialog open={selectProductOpen} onOpenChange={setSelectProductOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Stock</DialogTitle>
            <DialogDescription>
              Select a product to add stock to
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select
              onValueChange={(id) => {
                const product = products.find(p => p.id === id);
                if (product) {
                  setAddStockProduct(product);
                  setSelectProductOpen(false);
                  setAddStockOpen(true);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a product..." />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    <div className="flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-muted-foreground" />
                      {product.name}
                      {product.pcsNumber && (
                        <span className="text-xs text-muted-foreground">
                          (PCS: {product.pcsNumber})
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Stock Dialog */}
      {addStockProduct && (
        <AddStockDialog
          open={addStockOpen}
          onOpenChange={(open) => {
            setAddStockOpen(open);
            if (!open) setAddStockProduct(null);
          }}
          product={addStockProduct}
          onSuccess={(_bottles) => {
            fetchData();
            setAddStockOpen(false);
            setAddStockProduct(null);
          }}
        />
      )}
      </div>
    </PageFrame>
  );
}

