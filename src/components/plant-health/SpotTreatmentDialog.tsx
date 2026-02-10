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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Syringe, Calendar, AlertCircle } from 'lucide-react';
import {
  listIpmProducts,
  createIpmSpotTreatment,
  type IpmProduct,
} from '@/app/actions/ipm';

const formSchema = z.object({
  productId: z.string().min(1, 'Select a product'),
  applicationsTotal: z.coerce.number().int().min(1).max(3).default(1),
  applicationIntervalDays: z.coerce.number().int().min(1).optional().or(z.literal('')),
  firstApplicationDate: z.string().min(1, 'Date required'),
  rate: z.coerce.number().min(0).optional().or(z.literal('')),
  rateUnit: z.string().default('ml/L'),
  method: z.string().default('Foliar Spray'),
  reason: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type SpotTreatmentDialogProps = {
  // Target - either location or batch
  targetType: 'location' | 'batch';
  targetId: string;
  targetName: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
};

const APPLICATION_METHODS = [
  'Foliar Spray',
  'Drench',
  'Bio-Control',
  'Granular',
];

export function SpotTreatmentDialog({
  targetType,
  targetId,
  targetName,
  trigger,
  onSuccess,
}: SpotTreatmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<IpmProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productId: '',
      applicationsTotal: 1,
      applicationIntervalDays: '',
      firstApplicationDate: new Date().toISOString().split('T')[0],
      rate: '',
      rateUnit: 'ml/L',
      method: 'Foliar Spray',
      reason: '',
    },
  });

  // Load products when dialog opens
  useEffect(() => {
    if (open) {
      setLoadingProducts(true);
      listIpmProducts().then((result) => {
        if (result.success && result.data) {
          setProducts(result.data.filter((p) => p.isActive));
        }
        setLoadingProducts(false);
      });
    }
  }, [open]);

  // Reset form on open
  useEffect(() => {
    if (open) {
      form.reset({
        productId: '',
        applicationsTotal: 1,
        applicationIntervalDays: '',
        firstApplicationDate: new Date().toISOString().split('T')[0],
        rate: '',
        rateUnit: 'ml/L',
        method: 'Foliar Spray',
        reason: '',
      });
    }
  }, [open, form]);

  const isSubmitting = form.formState.isSubmitting;
  const applicationsTotal = form.watch('applicationsTotal');
  const selectedProductId = form.watch('productId');
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  async function onSubmit(values: FormValues) {
    try {
      const result = await createIpmSpotTreatment({
        productId: values.productId,
        targetType,
        targetBatchId: targetType === 'batch' ? targetId : undefined,
        targetLocationId: targetType === 'location' ? targetId : undefined,
        applicationsTotal: values.applicationsTotal,
        applicationIntervalDays:
          values.applicationsTotal > 1 && values.applicationIntervalDays !== ''
            ? Number(values.applicationIntervalDays)
            : undefined,
        firstApplicationDate: values.firstApplicationDate,
        rate: values.rate !== '' ? Number(values.rate) : undefined,
        rateUnit: values.rateUnit,
        method: values.method,
        reason: values.reason || undefined,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success('Spot treatment scheduled', {
        description: `${selectedProduct?.name} - ${values.applicationsTotal} application(s)`,
      });

      setOpen(false);
      onSuccess?.();
    } catch {
      toast.error('Failed to create spot treatment');
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="gap-2">
            <Syringe className="h-4 w-4" />
            Spot Treatment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Syringe className="h-5 w-5" />
            Schedule Spot Treatment
          </DialogTitle>
          <DialogDescription>
            Schedule an ad-hoc treatment for{' '}
            <span className="font-medium">{targetName}</span>.
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
                  ) : products.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No active products. Add products first.
                    </div>
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
                              <span>{p.name}</span>
                              {p.activeIngredient && (
                                <span className="text-xs text-muted-foreground">
                                  ({p.activeIngredient})
                                </span>
                              )}
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
              <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                <div className="flex flex-wrap gap-2">
                  {selectedProduct.targetPests.slice(0, 3).map((pest) => (
                    <Badge key={pest} variant="outline" className="text-xs">
                      {pest}
                    </Badge>
                  ))}
                </div>
                {selectedProduct.reiHours > 0 && (
                  <div className="flex items-center gap-1 text-amber-600">
                    <AlertCircle className="h-3 w-3" />
                    <span className="text-xs">REI: {selectedProduct.reiHours} hours</span>
                  </div>
                )}
              </div>
            )}

            {/* Application Count */}
            <FormField
              control={form.control}
              name="applicationsTotal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Applications</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(v) => field.onChange(Number(v))}
                      value={field.value.toString()}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="1" id="app-1" />
                        <Label htmlFor="app-1">Single</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="2" id="app-2" />
                        <Label htmlFor="app-2">2x Series</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="3" id="app-3" />
                        <Label htmlFor="app-3">3x Series</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Interval (only for series) */}
            {applicationsTotal > 1 && (
              <FormField
                control={form.control}
                name="applicationIntervalDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Days Between Applications</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="e.g. 7"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      How many days between each application
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* First Application Date */}
            <FormField
              control={form.control}
              name="firstApplicationDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Application Date *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="date"
                        className="pl-10"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Rate and Method */}
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={selectedProduct?.suggestedRate?.toString() || '—'}
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
                name="rateUnit"
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
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Method</FormLabel>
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
                        {APPLICATION_METHODS.map((m) => (
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
            </div>

            {/* Reason */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Why is this treatment needed? (e.g. Aphid infestation spotted)"
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
            <Button type="submit" className="w-full" disabled={isSubmitting || loadingProducts}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                'Schedule Treatment'
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

