'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Pencil, Trash2, Save, X, Tag, Truck } from 'lucide-react';
import { updateOrderItem, deleteOrderItem } from '@/app/sales/orders/[orderId]/actions';
import { formatCurrency, type CurrencyCode } from '@/lib/format-currency';
import type { OrderItem, OrderFee } from './OrderDetailPage';

interface OrderItemsTableProps {
  orderId: string;
  items: OrderItem[];
  status: string;
  onItemsChange: () => void;
  currency?: CurrencyCode;
  fees?: OrderFee[];
  requiresPrePricing?: boolean;
}

export default function OrderItemsTable({ orderId, items, status, onItemsChange, currency = 'EUR', fees = [], requiresPrePricing = false }: OrderItemsTableProps) {
  const { toast } = useToast();
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<OrderItem | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Allow editing in draft, confirmed, and picking statuses
  const canEdit = ['draft', 'confirmed', 'picking'].includes(status);

  const getItemDescription = (item: OrderItem) => {
    // Prefer specific variety name if available
    if (item.required_variety_name) return item.required_variety_name;
    if (item.product?.name) return item.product.name;
    if (item.description) return item.description;
    const variety = item.sku?.plant_varieties?.name || '';
    const size = item.sku?.plant_sizes?.name || '';
    return `${variety} ${size}`.trim() || 'Product';
  };

  const getItemSize = (item: OrderItem) => {
    return item.sku?.plant_sizes?.name || null;
  };

  const handleStartEdit = (item: OrderItem) => {
    setEditingItemId(item.id);
    setEditQuantity(item.quantity);
    setEditPrice(item.unit_price_ex_vat);
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditQuantity(0);
    setEditPrice(0);
  };

  const handleSaveEdit = async (item: OrderItem) => {
    setIsUpdating(true);
    try {
      const result = await updateOrderItem(item.id, {
        quantity: editQuantity,
        unit_price_ex_vat: editPrice,
      });

      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Item Updated',
          description: 'Order item has been updated',
        });
        setEditingItemId(null);
        onItemsChange();
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update item',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;

    setIsUpdating(true);
    try {
      const result = await deleteOrderItem(itemToDelete.id);

      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Item Deleted',
          description: 'Order item has been removed',
        });
        onItemsChange();
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete item',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const subtotal = items.reduce((sum, item) => sum + item.line_total_ex_vat, 0);
  const totalVat = items.reduce((sum, item) => sum + item.line_vat_amount, 0);
  const feesSubtotal = fees.reduce((sum, fee) => sum + fee.subtotal, 0);
  const feesVat = fees.reduce((sum, fee) => sum + fee.vat_amount, 0);
  const grandSubtotal = subtotal + feesSubtotal;
  const grandVat = totalVat + feesVat;
  const grandTotal = grandSubtotal + grandVat;

  const deliveryFees = fees.filter(f => f.fee_type.includes('delivery'));
  const prePricingFees = fees.filter(f => f.fee_type === 'pre_pricing');
  const hasRrp = items.some(item => item.rrp != null);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Order Items</span>
            <div className="flex items-center gap-2">
              {requiresPrePricing && (
                <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-300 text-xs">
                  <Tag className="h-3 w-3 mr-1" />
                  Pre-Pricing
                </Badge>
              )}
              {deliveryFees.length > 0 && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-300 text-xs">
                  <Truck className="h-3 w-3 mr-1" />
                  Delivery
                </Badge>
              )}
              <span className="text-sm font-normal text-muted-foreground">
                {items.length} item{items.length !== 1 ? 's' : ''}
              </span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No items in this order
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Description</TableHead>
                    <TableHead className="text-right w-[80px] md:w-[100px]">Qty</TableHead>
                    <TableHead className="text-right w-[100px] md:w-[120px]">Unit Price</TableHead>
                    {hasRrp && <TableHead className="text-right w-[100px] md:w-[120px]">RRP</TableHead>}
                    <TableHead className="text-right w-[60px] md:w-[80px]">VAT %</TableHead>
                    <TableHead className="text-right w-[100px] md:w-[120px]">Line Total</TableHead>
                    {canEdit && <TableHead className="w-[80px] md:w-[100px]"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const description = getItemDescription(item);
                    const size = getItemSize(item);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="min-w-[150px]">
                            <p className="font-medium">{description}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {size && <span>{size}</span>}
                              {item.sku?.code && (
                                <>
                                  {size && <span>-</span>}
                                  <span>SKU: {item.sku.code}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {editingItemId === item.id ? (
                            <Input
                              type="number"
                              min="1"
                              value={editQuantity}
                              onChange={(e) => setEditQuantity(parseInt(e.target.value) || 0)}
                              className="w-16 md:w-20 text-right ml-auto"
                            />
                          ) : (
                            item.quantity
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editingItemId === item.id ? (
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editPrice}
                              onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                              className="w-20 md:w-24 text-right ml-auto"
                            />
                          ) : (
                            formatCurrency(item.unit_price_ex_vat, currency)
                          )}
                        </TableCell>
                        {hasRrp && (
                          <TableCell className="text-right text-muted-foreground">
                            {item.rrp != null ? formatCurrency(item.rrp, currency) : '-'}
                          </TableCell>
                        )}
                        <TableCell className="text-right whitespace-nowrap">
                          {item.vat_rate}%
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.line_total_ex_vat, currency)}
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              {editingItemId === item.id ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleSaveEdit(item)}
                                    disabled={isUpdating}
                                    className="h-8 w-8"
                                  >
                                    <Save className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleCancelEdit}
                                    disabled={isUpdating}
                                    className="h-8 w-8"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleStartEdit(item)}
                                    className="h-8 w-8"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setItemToDelete(item);
                                      setDeleteDialogOpen(true);
                                    }}
                                    className="h-8 w-8"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={canEdit ? (hasRrp ? 5 : 4) : (hasRrp ? 4 : 3)} className="text-right">
                      Subtotal (ex VAT)
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(subtotal, currency)}</TableCell>
                    {canEdit && <TableCell />}
                  </TableRow>

                  {/* Delivery fees */}
                  {deliveryFees.map(fee => (
                    <TableRow key={fee.id}>
                      <TableCell colSpan={canEdit ? (hasRrp ? 5 : 4) : (hasRrp ? 4 : 3)} className="text-right text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Truck className="h-3.5 w-3.5" />
                          {fee.name}
                          {fee.total_amount === 0 && (
                            <Badge variant="secondary" className="text-[10px] font-normal">FOC</Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {fee.total_amount === 0 ? 'FOC' : formatCurrency(fee.subtotal, currency)}
                      </TableCell>
                      {canEdit && <TableCell />}
                    </TableRow>
                  ))}

                  {/* Pre-pricing fees */}
                  {prePricingFees.map(fee => (
                    <TableRow key={fee.id}>
                      <TableCell colSpan={canEdit ? (hasRrp ? 5 : 4) : (hasRrp ? 4 : 3)} className="text-right text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Tag className="h-3.5 w-3.5" />
                          {fee.name}
                          {fee.quantity > 1 && fee.total_amount > 0 && (
                            <span className="text-xs">
                              ({fee.quantity} x {formatCurrency(fee.unit_amount, currency)})
                            </span>
                          )}
                          {fee.total_amount === 0 && (
                            <Badge variant="secondary" className="text-[10px] font-normal">FOC</Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {fee.total_amount === 0 ? 'FOC' : formatCurrency(fee.subtotal, currency)}
                      </TableCell>
                      {canEdit && <TableCell />}
                    </TableRow>
                  ))}

                  <TableRow>
                    <TableCell colSpan={canEdit ? (hasRrp ? 5 : 4) : (hasRrp ? 4 : 3)} className="text-right text-muted-foreground">
                      VAT
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(grandVat, currency)}
                    </TableCell>
                    {canEdit && <TableCell />}
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={canEdit ? (hasRrp ? 5 : 4) : (hasRrp ? 4 : 3)} className="text-right font-semibold">
                      Total (inc VAT)
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(grandTotal, currency)}</TableCell>
                    {canEdit && <TableCell />}
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Item?</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove &quot;{itemToDelete ? getItemDescription(itemToDelete) : ''}&quot; from this order?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteItem}
              disabled={isUpdating}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
