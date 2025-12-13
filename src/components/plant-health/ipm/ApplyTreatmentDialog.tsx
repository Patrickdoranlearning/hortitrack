'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  SprayCan,
  AlertTriangle,
  Clock,
  Loader2,
  Package,
  ScanLine,
  CheckCircle2,
  FlaskConical,
} from 'lucide-react';
import { applyLocationTreatment } from '@/app/actions/plant-health';
import { listIpmProducts, type IpmProduct } from '@/app/actions/ipm';
import { getAvailableBottles, recordUsage, type IpmBottle } from '@/app/actions/ipm-stock';
import { BottleScanDialog } from './BottleScanDialog';

const formSchema = z.object({
  productId: z.string().min(1, 'Select a product'),
  rate: z.coerce.number().min(0.001, 'Rate must be positive'),
  unit: z.string().min(1, 'Unit required'),
  method: z.string().min(1, 'Method required'),
  quantityUsedMl: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const COMMON_METHODS = [
  'Foliar Spray',
  'Drench',
  'Bio-Control',
  'Granular',
];

type ApplyTreatmentDialogProps = {
  locationId: string;
  locationName: string;
  trigger?: React.ReactNode;
  onSuccess?: (count: number) => void;
};

export function ApplyTreatmentDialog({
  locationId,
  locationName,
  trigger,
  onSuccess,
}: ApplyTreatmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<IpmProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedBottle, setSelectedBottle] = useState<IpmBottle | null>(null);
  const [bottleScanOpen, setBottleScanOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productId: '',
      rate: 0,
      unit: 'ml/L',
      method: 'Foliar Spray',
      quantityUsedMl: 0,
      notes: '',
    },
  });

  const selectedProductId = form.watch('productId');
  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Load products
  useEffect(() => {
    if (open) {
      setLoadingProducts(true);
      listIpmProducts().then((result) => {
        if (result.success && result.data) {
          setProducts(result.data.filter(p => p.isActive));
        }
        setLoadingProducts(false);
      });
      // Reset state
      setSelectedBottle(null);
      form.reset();
    }
  }, [open, form]);

  // Update form when product selected
  useEffect(() => {
    if (selectedProduct) {
      if (selectedProduct.suggestedRate) {
        form.setValue('rate', selectedProduct.suggestedRate);
      }
      if (selectedProduct.suggestedRateUnit) {
        form.setValue('unit', selectedProduct.suggestedRateUnit);
      }
      if (selectedProduct.applicationMethods?.[0]) {
        form.setValue('method', selectedProduct.applicationMethods[0]);
      }
      // Reset bottle when product changes
      setSelectedBottle(null);
    }
  }, [selectedProduct, form]);

  const isSubmitting = form.formState.isSubmitting;

  const handleBottleScanned = (bottle: IpmBottle, quantityMl: number) => {
    setSelectedBottle(bottle);
    form.setValue('quantityUsedMl', quantityMl);
  };

  async function onSubmit(values: FormValues) {
    try {
      if (!selectedProduct) {
        toast.error('Please select a product');
        return;
      }

      const result = await applyLocationTreatment({
        locationId,
        productName: selectedProduct.name,
        rate: values.rate,
        unit: values.unit,
        method: values.method,
        reiHours: selectedProduct.reiHours ?? 0,
        notes: values.notes,
        ipmProductId: selectedProduct.id,
        bottleId: selectedBottle?.id,
        quantityUsedMl: values.quantityUsedMl || undefined,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      const count = result.data?.count ?? 0;
      toast.success(`Treatment applied to ${count} batch${count !== 1 ? 'es' : ''}`, {
        description: selectedBottle
          ? `${values.quantityUsedMl}ml recorded from ${selectedBottle.bottleCode}`
          : undefined,
      });

      setOpen(false);
      form.reset();
      setSelectedBottle(null);
      onSuccess?.(count);
    } catch (error) {
      console.error('Treatment application failed', error);
      toast.error('Failed to apply treatment');
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="destructive" className="gap-2">
              <SprayCan className="h-4 w-4" />
              Apply Treatment
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SprayCan className="h-5 w-5" />
              Treat {locationName}
            </DialogTitle>
            <DialogDescription>
              Apply a treatment to all active batches and track product usage.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Product Selection */}
              <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>IPM Product *</FormLabel>
                    {loadingProducts ? (
                      <div className="text-sm text-muted-foreground">Loading products...</div>
                    ) : (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              <div className="flex items-center gap-2">
                                <FlaskConical className="h-4 w-4 text-muted-foreground" />
                                <span>{p.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Product Info */}
              {selectedProduct && (
                <Card className="bg-muted/50">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {selectedProduct.targetPests.slice(0, 3).map((pest) => (
                        <Badge key={pest} variant="outline" className="text-xs">
                          {pest}
                        </Badge>
                      ))}
                    </div>
                    {selectedProduct.reiHours > 0 && (
                      <div className="flex items-center gap-1 text-amber-600 text-sm">
                        <AlertTriangle className="h-4 w-4" />
                        <span>REI: {selectedProduct.reiHours} hours restriction</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Rate and Unit */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Application Rate *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ml/L">ml/L</SelectItem>
                          <SelectItem value="g/L">g/L</SelectItem>
                          <SelectItem value="ml/100L">ml/100L</SelectItem>
                          <SelectItem value="g/100L">g/100L</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Method */}
              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Application Method</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COMMON_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Stock Tracking Section */}
              {selectedProduct && (
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">Stock Tracking</span>
                    </div>
                    {!selectedBottle && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setBottleScanOpen(true)}
                      >
                        <ScanLine className="h-4 w-4 mr-1" />
                        Scan Bottle
                      </Button>
                    )}
                  </div>

                  {selectedBottle ? (
                    <div className="flex items-center justify-between bg-green-50 dark:bg-green-950/30 rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-mono font-semibold">{selectedBottle.bottleCode}</p>
                          <p className="text-xs text-muted-foreground">
                            {form.watch('quantityUsedMl')}ml will be deducted
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setBottleScanOpen(true)}
                      >
                        Change
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Optional: Scan a bottle to track exact product usage
                    </p>
                  )}
                </div>
              )}

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any additional notes..."
                        className="resize-none"
                        rows={2}
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Submit */}
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || !selectedProductId}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  'Apply Treatment'
                )}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Bottle Scan Dialog */}
      {selectedProduct && (
        <BottleScanDialog
          open={bottleScanOpen}
          onOpenChange={setBottleScanOpen}
          productId={selectedProduct.id}
          productName={selectedProduct.name}
          locationId={locationId}
          onUsageRecorded={handleBottleScanned}
        />
      )}
    </>
  );
}

