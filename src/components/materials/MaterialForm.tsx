'use client';

import { useContext, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '../ui/searchable-select';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ReferenceDataContext } from '@/contexts/ReferenceDataContext';
import { CreateMaterialSchema, type CreateMaterialSchemaType } from '@/lib/schemas/materials';
import type { Material, MaterialCategory } from '@/lib/types/materials';

type MaterialFormProps = {
  material?: Material | null;
  categories: MaterialCategory[];
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
};

export function MaterialForm({ material, categories, onSubmit, onCancel }: MaterialFormProps) {
  const { data: refData, reload } = useContext(ReferenceDataContext);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Auto-refresh reference data when user returns from creating a new entity in another tab
  useRefreshOnFocus(reload);

  const sizes = refData?.sizes ?? [];
  const suppliers = refData?.suppliers ?? [];

  // Group categories by parent group
  const categoryGroups = categories.reduce(
    (acc, cat) => {
      if (!acc[cat.parentGroup]) acc[cat.parentGroup] = [];
      acc[cat.parentGroup].push(cat);
      return acc;
    },
    {} as Record<string, MaterialCategory[]>
  );

  const form = useForm<CreateMaterialSchemaType>({
    resolver: zodResolver(CreateMaterialSchema),
    defaultValues: {
      name: material?.name ?? '',
      description: material?.description ?? '',
      categoryId: material?.categoryId ?? '',
      linkedSizeId: material?.linkedSizeId ?? undefined,
      baseUom: material?.baseUom ?? 'each',
      defaultSupplierId: material?.defaultSupplierId ?? undefined,
      reorderPoint: material?.reorderPoint ?? undefined,
      reorderQuantity: material?.reorderQuantity ?? undefined,
      targetStock: material?.targetStock ?? undefined,
      standardCost: material?.standardCost ?? undefined,
      barcode: material?.barcode ?? '',
    },
  });

  const handleFormSubmit = form.handleSubmit(async (data) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
    } finally {
      setIsSubmitting(false);
    }
  });

  const selectedCategory = categories.find((c) => c.id === form.watch('categoryId'));
  const isContainerCategory = selectedCategory?.parentGroup === 'Containers';

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          {material ? 'Edit Material' : 'Add New Material'}
        </DialogTitle>
        <DialogDescription>
          {material
            ? `Update details for ${material.partNumber}`
            : 'Add a new material to your catalog. A part number will be generated automatically.'}
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={handleFormSubmit} className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 12cm Round Pot" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(categoryGroups).map(([group, cats]) => (
                        <div key={group}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                            {group}
                          </div>
                          {cats.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Optional description or notes"
                    className="resize-none"
                    rows={2}
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Size Linking (for Containers) */}
          {isContainerCategory && (
            <FormField
              control={form.control}
              name="linkedSizeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked Plant Size</FormLabel>
                  <SearchableSelect
                    options={sizes.map((size) => ({
                      value: size.id,
                      label: size.name,
                    }))}
                    value={field.value ?? 'none'}
                    onValueChange={(val) => field.onChange(val === 'none' ? null : val)}
                    createHref="/sizes"
                    placeholder="Select size to link"
                    createLabel="Add new size"
                    emptyLabel="No linked size"
                    emptyValue="none"
                  />
                  <FormDescription>
                    Link this material to a plant size for automatic consumption during batch
                    actualization.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* UOM and Supplier */}
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="baseUom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit of Measure</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="each">Each</SelectItem>
                      <SelectItem value="litre">Litre</SelectItem>
                      <SelectItem value="kg">Kilogram</SelectItem>
                      <SelectItem value="g">Gram</SelectItem>
                      <SelectItem value="ml">Millilitre</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="defaultSupplierId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Supplier</FormLabel>
                  <SearchableSelect
                    options={suppliers.map((supplier) => ({
                      value: supplier.id,
                      label: supplier.name,
                    }))}
                    value={field.value ?? 'none'}
                    onValueChange={(val) => field.onChange(val === 'none' ? null : val)}
                    createHref="/suppliers"
                    placeholder="Select supplier"
                    createLabel="Add new supplier"
                    emptyLabel="No default supplier"
                    emptyValue="none"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Stock Management */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Stock Management</h4>

            {/* Initial Stock - only show when creating new material */}
            {!material && (
              <FormField
                control={form.control}
                name="initialStock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Stock Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      Enter current stock on hand. Leave empty or 0 if none.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="reorderPoint"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reorder Point</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                        }
                      />
                    </FormControl>
                    <FormDescription>Alert when stock falls below</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reorderQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reorder Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        placeholder="Suggested order qty"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="targetStock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Stock</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Ideal stock level"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Pricing and Barcode */}
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="standardCost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Standard Cost</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) =>
                        field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                      }
                    />
                  </FormControl>
                  <FormDescription>Cost per unit for valuation</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="barcode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>External Barcode</FormLabel>
                  <FormControl>
                    <Input placeholder="EAN/UPC if applicable" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormDescription>Supplier barcode (internal code auto-generated)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Show part number if editing */}
          {material && (
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                Part Number: <span className="font-mono font-medium">{material.partNumber}</span>
              </p>
              {material.internalBarcode && (
                <p className="text-sm text-muted-foreground mt-1">
                  Internal Barcode: <span className="font-mono">{material.internalBarcode}</span>
                </p>
              )}
            </div>
          )}
        </form>
      </Form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" onClick={handleFormSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : material ? 'Update Material' : 'Create Material'}
        </Button>
      </DialogFooter>
    </>
  );
}
