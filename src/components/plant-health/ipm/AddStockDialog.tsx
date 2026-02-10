'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from '@/lib/toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Loader2,
  Package,
  Calendar,
  Printer,
  Plus,
  Minus,
  QrCode,
  FlaskConical,
} from 'lucide-react';
import {
  createBottles,
  type IpmBottle,
} from '@/app/actions/ipm-stock';
import type { IpmProduct } from '@/app/actions/ipm';

const formSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(50).default(1),
  volumeMl: z.coerce.number().int().min(1).default(1000),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type AddStockDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: IpmProduct;
  onSuccess?: (bottles: IpmBottle[]) => void;
};

export function AddStockDialog({
  open,
  onOpenChange,
  product,
  onSuccess,
}: AddStockDialogProps) {
  const [createdBottles, setCreatedBottles] = useState<IpmBottle[]>([]);
  const [showPrintView, setShowPrintView] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: 1,
      volumeMl: 1000,
      batchNumber: '',
      expiryDate: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      notes: '',
    },
  });

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        quantity: 1,
        volumeMl: 1000,
        batchNumber: '',
        expiryDate: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        notes: '',
      });
      setCreatedBottles([]);
      setShowPrintView(false);
    }
  }, [open, form]);

  const isSubmitting = form.formState.isSubmitting;
  const quantity = form.watch('quantity');

  const adjustQuantity = (delta: number) => {
    const current = form.getValues('quantity');
    const newVal = Math.max(1, Math.min(50, current + delta));
    form.setValue('quantity', newVal);
  };

  async function onSubmit(values: FormValues) {
    try {
      const result = await createBottles(
        {
          productId: product.id,
          volumeMl: values.volumeMl,
          batchNumber: values.batchNumber || undefined,
          expiryDate: values.expiryDate || undefined,
          purchaseDate: values.purchaseDate || undefined,
          notes: values.notes || undefined,
        },
        values.quantity
      );

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      if (result.data) {
        setCreatedBottles(result.data);
        setShowPrintView(true);
        toast.success(`${result.data.length} bottle(s) registered`, {
          description: 'Ready to print labels',
        });
      }
    } catch {
      toast.error('Failed to create stock');
    }
  }

  const handlePrintLabels = () => {
    // Open print dialog for bottle labels
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>IPM Bottle Labels</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: system-ui, -apple-system, sans-serif; }
            .label {
              width: 50mm;
              height: 30mm;
              border: 1px solid #000;
              padding: 2mm;
              margin: 2mm;
              display: inline-block;
              page-break-inside: avoid;
            }
            .product-name {
              font-size: 10pt;
              font-weight: bold;
              margin-bottom: 1mm;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .bottle-code {
              font-size: 14pt;
              font-weight: bold;
              font-family: monospace;
              margin: 2mm 0;
            }
            .qr-placeholder {
              width: 15mm;
              height: 15mm;
              border: 1px dashed #666;
              display: inline-block;
              vertical-align: middle;
              margin-right: 2mm;
              text-align: center;
              line-height: 15mm;
              font-size: 7pt;
              color: #666;
            }
            .details {
              display: inline-block;
              vertical-align: middle;
              font-size: 7pt;
            }
            .details div { margin: 0.5mm 0; }
            @media print {
              .label { border: 1px solid #000; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="padding: 10px; background: #f0f0f0; margin-bottom: 10px;">
            <button onclick="window.print()" style="padding: 8px 16px; font-size: 14px; cursor: pointer;">
              🖨️ Print Labels
            </button>
            <span style="margin-left: 10px; font-size: 12px; color: #666;">
              ${createdBottles.length} label(s) ready
            </span>
          </div>
          ${createdBottles.map(bottle => `
            <div class="label">
              <div class="product-name">${product.name}</div>
              <div class="bottle-code">${bottle.bottleCode}</div>
              <div class="qr-placeholder">QR</div>
              <div class="details">
                <div>${bottle.volumeMl}ml</div>
              </div>
            </div>
          `).join('')}
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleClose = () => {
    if (createdBottles.length > 0) {
      onSuccess?.(createdBottles);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Add Stock: {product.name}
          </DialogTitle>
          <DialogDescription>
            Register new bottles and print labels for tracking.
          </DialogDescription>
        </DialogHeader>

        {!showPrintView ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Quantity Selector */}
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Bottles</FormLabel>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => adjustQuantity(-1)}
                        disabled={quantity <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="50"
                          className="w-20 text-center text-lg font-semibold"
                          {...field}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => adjustQuantity(1)}
                        disabled={quantity >= 50}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        bottle{quantity !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Volume */}
              <FormField
                control={form.control}
                name="volumeMl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Volume per Bottle (ml)</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Common sizes: 250ml, 500ml, 1000ml, 5000ml
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />


              {/* Summary */}
              <Card className="bg-muted/50">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>Total volume to add:</span>
                    <span className="font-semibold">
                      {(quantity * form.watch('volumeMl')).toLocaleString()}ml
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Submit */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Package className="mr-2 h-4 w-4" />
                      Register {quantity} Bottle{quantity !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <div className="space-y-4">
            {/* Success View - Ready to Print */}
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                <QrCode className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg">
                {createdBottles.length} Bottle{createdBottles.length !== 1 ? 's' : ''} Registered!
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Print labels and attach to each bottle
              </p>
            </div>

            {/* Bottles List */}
            <div className="border rounded-lg divide-y max-h-[200px] overflow-y-auto">
              {createdBottles.map((bottle) => (
                <div
                  key={bottle.id}
                  className="p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <FlaskConical className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-mono font-semibold">{bottle.bottleCode}</p>
                      <p className="text-xs text-muted-foreground">
                        {bottle.volumeMl}ml
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">Sealed</Badge>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleClose}
              >
                Done
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handlePrintLabels}
              >
                <Printer className="h-4 w-4" />
                Print Labels
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

