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
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Loader2, FlaskConical } from 'lucide-react';
import {
  createIpmProduct,
  updateIpmProduct,
  type IpmProduct,
  type IpmProductInput,
} from '@/app/actions/ipm';

const formSchema = z.object({
  name: z.string().min(2, 'Product name required'),
  pcsNumber: z.string().optional(),
  activeIngredient: z.string().optional(),
  targetPests: z.array(z.string()).default([]),
  suggestedRate: z.coerce.number().min(0).optional().or(z.literal('')),
  suggestedRateUnit: z.string().default('ml/L'),
  maxRate: z.coerce.number().min(0).optional().or(z.literal('')),
  harvestIntervalDays: z.coerce.number().int().min(0).optional().or(z.literal('')),
  reiHours: z.coerce.number().int().min(0).default(0),
  useRestriction: z.enum(['indoor', 'outdoor', 'both']).default('both'),
  applicationMethods: z.array(z.string()).default(['Foliar Spray']),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

const RATE_UNITS = [
  { value: 'ml/L', label: 'ml/L' },
  { value: 'g/L', label: 'g/L' },
  { value: 'ml/100L', label: 'ml/100L' },
  { value: 'g/100L', label: 'g/100L' },
  { value: 'kg/ha', label: 'kg/ha' },
  { value: 'L/ha', label: 'L/ha' },
];

const APPLICATION_METHODS = [
  'Foliar Spray',
  'Drench',
  'Bio-Control',
  'Granular',
  'Fumigation',
  'Seed Treatment',
];

type ProductDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: IpmProduct | null;
  onSuccess?: () => void;
};

export function ProductDialog({
  open,
  onOpenChange,
  product,
  onSuccess,
}: ProductDialogProps) {
  const [newPest, setNewPest] = useState('');
  const isEditing = !!product;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      pcsNumber: '',
      activeIngredient: '',
      targetPests: [],
      suggestedRate: '',
      suggestedRateUnit: 'ml/L',
      maxRate: '',
      harvestIntervalDays: '',
      reiHours: 0,
      useRestriction: 'both',
      applicationMethods: ['Foliar Spray'],
      notes: '',
      isActive: true,
    },
  });

  // Reset form when product changes or dialog opens
  useEffect(() => {
    if (open) {
      if (product) {
        form.reset({
          name: product.name,
          pcsNumber: product.pcsNumber || '',
          activeIngredient: product.activeIngredient || '',
          targetPests: product.targetPests || [],
          suggestedRate: product.suggestedRate ?? '',
          suggestedRateUnit: product.suggestedRateUnit || 'ml/L',
          maxRate: product.maxRate ?? '',
          harvestIntervalDays: product.harvestIntervalDays ?? '',
          reiHours: product.reiHours ?? 0,
          useRestriction: product.useRestriction || 'both',
          applicationMethods: product.applicationMethods || ['Foliar Spray'],
          notes: product.notes || '',
          isActive: product.isActive ?? true,
        });
      } else {
        form.reset({
          name: '',
          pcsNumber: '',
          activeIngredient: '',
          targetPests: [],
          suggestedRate: '',
          suggestedRateUnit: 'ml/L',
          maxRate: '',
          harvestIntervalDays: '',
          reiHours: 0,
          useRestriction: 'both',
          applicationMethods: ['Foliar Spray'],
          notes: '',
          isActive: true,
        });
      }
    }
  }, [open, product, form]);

  const isSubmitting = form.formState.isSubmitting;
  const targetPests = form.watch('targetPests');
  const applicationMethods = form.watch('applicationMethods');

  const addPest = () => {
    if (newPest.trim() && !targetPests.includes(newPest.trim())) {
      form.setValue('targetPests', [...targetPests, newPest.trim()]);
      setNewPest('');
    }
  };

  const removePest = (pest: string) => {
    form.setValue('targetPests', targetPests.filter(p => p !== pest));
  };

  const toggleMethod = (method: string) => {
    if (applicationMethods.includes(method)) {
      form.setValue('applicationMethods', applicationMethods.filter(m => m !== method));
    } else {
      form.setValue('applicationMethods', [...applicationMethods, method]);
    }
  };

  async function onSubmit(values: FormValues) {
    try {
      const input: IpmProductInput = {
        name: values.name,
        pcsNumber: values.pcsNumber || undefined,
        activeIngredient: values.activeIngredient || undefined,
        targetPests: values.targetPests,
        suggestedRate: values.suggestedRate !== '' ? Number(values.suggestedRate) : undefined,
        suggestedRateUnit: values.suggestedRateUnit,
        maxRate: values.maxRate !== '' ? Number(values.maxRate) : undefined,
        harvestIntervalDays: values.harvestIntervalDays !== '' ? Number(values.harvestIntervalDays) : undefined,
        reiHours: values.reiHours,
        useRestriction: values.useRestriction,
        applicationMethods: values.applicationMethods.length > 0 ? values.applicationMethods : ['Foliar Spray'],
        notes: values.notes || undefined,
        isActive: values.isActive,
      };

      const result = isEditing
        ? await updateIpmProduct(product.id, input)
        : await createIpmProduct(input);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(isEditing ? 'Product updated' : 'Product created', {
        description: values.name,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Product save failed', error);
      toast.error('Failed to save product');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            {isEditing ? 'Edit IPM Product' : 'Add IPM Product'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the product details below.'
              : 'Add a new IPM product to your database.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Nemasys" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pcsNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PCS Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Regulatory ID" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="activeIngredient"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Active Ingredient</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Steinernema feltiae"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Target Pests */}
            <FormField
              control={form.control}
              name="targetPests"
              render={() => (
                <FormItem>
                  <FormLabel>Target Pests/Diseases</FormLabel>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add pest or disease..."
                      value={newPest}
                      onChange={(e) => setNewPest(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addPest();
                        }
                      }}
                      disabled={isSubmitting}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={addPest}
                      disabled={isSubmitting}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {targetPests.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {targetPests.map((pest) => (
                        <Badge key={pest} variant="secondary" className="gap-1">
                          {pest}
                          <button
                            type="button"
                            onClick={() => removePest(pest)}
                            className="hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Rates */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="suggestedRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Suggested Rate</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g. 2.5"
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
                name="suggestedRateUnit"
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
                        {RATE_UNITS.map((unit) => (
                          <SelectItem key={unit.value} value={unit.value}>
                            {unit.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Rate</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g. 5.0"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Safety */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="harvestIntervalDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Harvest Interval (days)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Withholding period"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Days before harvest
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reiHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>REI (hours)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Re-entry interval"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Re-entry interval
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Use Restriction */}
            <FormField
              control={form.control}
              name="useRestriction"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Use Restriction</FormLabel>
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
                      <SelectItem value="both">Indoor & Outdoor</SelectItem>
                      <SelectItem value="indoor">Indoor Only</SelectItem>
                      <SelectItem value="outdoor">Outdoor Only</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Application Methods */}
            <FormField
              control={form.control}
              name="applicationMethods"
              render={() => (
                <FormItem>
                  <FormLabel>Application Methods</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {APPLICATION_METHODS.map((method) => (
                      <Badge
                        key={method}
                        variant={applicationMethods.includes(method) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleMethod(method)}
                      >
                        {method}
                      </Badge>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes, mixing instructions, etc."
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

            {/* Active Toggle */}
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Active</FormLabel>
                    <FormDescription className="text-xs">
                      Inactive products won't appear in selection lists
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Submit */}
            <div className="flex justify-end gap-2 pt-4">
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
                    Saving...
                  </>
                ) : isEditing ? (
                  'Update Product'
                ) : (
                  'Create Product'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

