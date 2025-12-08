'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { createCreditNote } from '@/app/sales/orders/[orderId]/actions';
import type { OrderItem } from './OrderDetailPage';

interface CreditNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderItems: OrderItem[];
  onCreditNoteCreated: () => void;
}

interface CreditLineItem {
  orderItemId: string;
  selected: boolean;
  quantity: number;
  maxQuantity: number;
  unitPrice: number;
}

export default function CreditNoteDialog({
  open,
  onOpenChange,
  orderId,
  orderItems,
  onCreditNoteCreated,
}: CreditNoteDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState('');
  const [creditItems, setCreditItems] = useState<CreditLineItem[]>(() =>
    orderItems.map((item) => ({
      orderItemId: item.id,
      selected: false,
      quantity: item.quantity,
      maxQuantity: item.quantity,
      unitPrice: item.unit_price_ex_vat,
    }))
  );

  const getItemDescription = (item: OrderItem) => {
    if (item.product?.name) return item.product.name;
    if (item.description) return item.description;
    const variety = item.sku?.plant_varieties?.name || '';
    const size = item.sku?.plant_sizes?.name || '';
    return `${variety} ${size}`.trim() || 'Product';
  };

  const handleToggleItem = (index: number) => {
    setCreditItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    setCreditItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, quantity: Math.min(quantity, item.maxQuantity) }
          : item
      )
    );
  };

  const calculateTotal = () => {
    return creditItems
      .filter((item) => item.selected)
      .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  };

  const handleSubmit = async () => {
    const selectedItems = creditItems.filter((item) => item.selected && item.quantity > 0);

    if (selectedItems.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select at least one item to credit',
        variant: 'destructive',
      });
      return;
    }

    if (!reason.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a reason for the credit note',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createCreditNote(orderId, {
        reason: reason.trim(),
        items: selectedItems.map((item) => ({
          orderItemId: item.orderItemId,
          quantity: item.quantity,
          amount: item.quantity * item.unitPrice,
        })),
      });

      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Credit Note Created',
          description: `Credit note for €${calculateTotal().toFixed(2)} has been created`,
        });
        onOpenChange(false);
        onCreditNoteCreated();
        // Reset form
        setReason('');
        setCreditItems(
          orderItems.map((item) => ({
            orderItemId: item.id,
            selected: false,
            quantity: item.quantity,
            maxQuantity: item.quantity,
            unitPrice: item.unit_price_ex_vat,
          }))
        );
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to create credit note',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Credit Note</DialogTitle>
          <DialogDescription>
            Select items to credit and provide a reason for the credit note.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter the reason for this credit note..."
              rows={2}
            />
          </div>

          {/* Items Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Credit</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-[100px] text-right">Qty</TableHead>
                  <TableHead className="w-[100px] text-right">Unit Price</TableHead>
                  <TableHead className="w-[100px] text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderItems.map((item, index) => {
                  const creditItem = creditItems[index];
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={creditItem.selected}
                          onCheckedChange={() => handleToggleItem(index)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {getItemDescription(item)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="1"
                          max={creditItem.maxQuantity}
                          value={creditItem.quantity}
                          onChange={(e) =>
                            handleQuantityChange(index, parseInt(e.target.value) || 0)
                          }
                          disabled={!creditItem.selected}
                          className="w-20 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        €{creditItem.unitPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {creditItem.selected
                          ? `€${(creditItem.quantity * creditItem.unitPrice).toFixed(2)}`
                          : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Total */}
          <div className="flex justify-end">
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex items-center justify-between gap-8">
                <span className="text-muted-foreground">Total Credit Amount:</span>
                <span className="text-xl font-bold">€{calculateTotal().toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Credit Note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

