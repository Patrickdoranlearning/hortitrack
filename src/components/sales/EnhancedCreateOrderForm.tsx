'use client';

import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateOrderSchema, CreateOrderInput, CreateOrderLineSchema } from '@/lib/sales/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createOrder } from '@/app/sales/actions';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Plus, Trash2, Layers, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { BatchSelectionDialog, BatchAllocation, Batch } from './BatchSelectionDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export interface Product {
  id: string;
  name: string;
  plantVariety: string;
  size: string;
  availableStock: number;
  batches?: Batch[];
  defaultPrice?: number | null;
  aliases?: Array<{
    id: string;
    aliasName: string | null;
    customerId: string | null;
    customerSkuCode?: string | null;
    isActive?: boolean | null;
    unitPriceExVat?: number | null;
  }>;
}

export interface CustomerAddress {
  id: string;
  label: string;
  storeName: string | null;
  line1: string;
  line2: string | null;
  city: string | null;
  county: string | null;
  eircode: string | null;
  countryCode: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

interface EnhancedCreateOrderFormProps {
  customers: {
    id: string;
    name: string;
    store?: string | null;
    currency?: string;
    countryCode?: string;
    addresses?: CustomerAddress[];
  }[];
  products: Product[];
}

type Totals = { net: number; vat: number; total: number };

export default function EnhancedCreateOrderForm({ customers, products }: EnhancedCreateOrderFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchDialogLineIndex, setBatchDialogLineIndex] = useState<number | null>(null);
  const [lineAllocations, setLineAllocations] = useState<Map<number, BatchAllocation[]>>(new Map());
  const [submitError, setSubmitError] = useState<{ message: string; details?: string } | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const form = useForm<CreateOrderInput>({
    resolver: zodResolver(CreateOrderSchema),
    defaultValues: {
      customerId: '',
      storeId: 'main',
      deliveryAddress: '',
      orderReference: '',
      deliveryDate: '',
      shipMethod: '',
      notesCustomer: '',
      notesInternal: '',
      lines: [{
        plantVariety: '',
        size: '',
        requiredVarietyId: undefined,
        requiredBatchId: undefined,
        qty: 1,
        allowSubstitute: true,
        unitPrice: undefined,
        vatRate: 13.5, // Default Irish VAT rate for plants
        description: '',
      }],
      autoPrint: true,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const selectedCustomerId = useWatch({ control: form.control, name: 'customerId' });
  const storeId = useWatch({ control: form.control, name: 'storeId' });
  const watchedLines = useWatch({ control: form.control, name: 'lines' });

  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  const customerAddresses = useMemo(() => {
    return selectedCustomer?.addresses ?? [];
  }, [selectedCustomer]);

  const defaultShippingAddress = useMemo(() => {
    return customerAddresses.find(a => a.isDefaultShipping) ?? customerAddresses[0];
  }, [customerAddresses]);

  const formatAddress = (address: CustomerAddress) => {
    const parts = [address.line1, address.line2, address.city, address.county, address.eircode].filter(Boolean);
    return parts.join(', ');
  };

  useEffect(() => {
    if (defaultShippingAddress) {
      form.setValue('storeId', defaultShippingAddress.id);
      form.setValue('shipToAddressId', defaultShippingAddress.id);
      form.setValue('deliveryAddress', formatAddress(defaultShippingAddress));
    } else if (selectedCustomer?.store) {
      form.setValue('storeId', selectedCustomer.store);
      form.setValue('shipToAddressId', undefined);
      form.setValue('deliveryAddress', '');
    } else {
      form.setValue('storeId', 'main');
      form.setValue('shipToAddressId', undefined);
      form.setValue('deliveryAddress', '');
    }
    setShowAllProducts(false);
  }, [selectedCustomer?.id, defaultShippingAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredProducts = useMemo(() => {
    if (!selectedCustomerId) return products;

    const aliasMatches = products.filter((product) =>
      product.aliases?.some(
        (alias) => alias.isActive !== false && alias.customerId === selectedCustomerId
      )
    );

    if (showAllProducts) {
      const aliasIds = new Set(aliasMatches.map((p) => p.id));
      return [...aliasMatches, ...products.filter((p) => !aliasIds.has(p.id))];
    }

    return aliasMatches.length > 0 ? aliasMatches : products;
  }, [products, selectedCustomerId, showAllProducts]);

  const resolveProductLabel = (product: Product) => {
    const alias = product.aliases?.find(
      (a) => a.isActive !== false && (selectedCustomerId ? a.customerId === selectedCustomerId : !!a.aliasName)
    );
    if (alias?.aliasName) return alias.aliasName;
    if (product.name) return product.name;
    return `${product.plantVariety} - ${product.size}`;
  };

  // Get price for a product: customer-specific alias price > default price
  const getProductPrice = (product: Product): number | undefined => {
    // First check for customer-specific alias price
    if (selectedCustomerId) {
      const customerAlias = product.aliases?.find(
        (a) => a.isActive !== false && a.customerId === selectedCustomerId && a.unitPriceExVat != null
      );
      if (customerAlias?.unitPriceExVat != null) {
        return customerAlias.unitPriceExVat;
      }
    }
    // Fall back to default price
    if (product.defaultPrice != null) {
      return product.defaultPrice;
    }
    return undefined;
  };

  // Calculate totals from watched lines - this will re-render when any line value changes
  const totals: Totals = useMemo(() => {
    const aggregate = (watchedLines || []).reduce(
      (acc, line) => {
        const qty = typeof line?.qty === 'number' ? line.qty : (parseInt(String(line?.qty)) || 0);
        const price = typeof line?.unitPrice === 'number' ? line.unitPrice : (parseFloat(String(line?.unitPrice)) || 0);
        const vatRate = typeof line?.vatRate === 'number' ? line.vatRate : (parseFloat(String(line?.vatRate)) || 0);
        const net = qty * price;
        const vat = net * (vatRate / 100);
        acc.net += net;
        acc.vat += vat;
        return acc;
      },
      { net: 0, vat: 0, total: 0 } as Totals
    );
    return { ...aggregate, total: aggregate.net + aggregate.vat };
  }, [watchedLines]);

  const openBatchDialog = (index: number) => {
    setBatchDialogLineIndex(index);
    setBatchDialogOpen(true);
  };

  const handleBatchConfirm = (allocations: BatchAllocation[]) => {
    if (batchDialogLineIndex === null) return;
    const next = new Map(lineAllocations);
    next.set(batchDialogLineIndex, allocations);
    setLineAllocations(next);

    // Update line qty to sum of allocations if any
    if (allocations.length > 0) {
      const totalQty = allocations.reduce((sum, a) => sum + a.qty, 0);
      form.setValue(`lines.${batchDialogLineIndex}.qty`, totalQty);
      // Store batch preferences
      form.setValue(`lines.${batchDialogLineIndex}.preferredBatchNumbers`, allocations.map(a => a.batchNumber));
      // If a single batch is selected, set required batch id; otherwise clear
      if (allocations.length === 1) {
        form.setValue(`lines.${batchDialogLineIndex}.requiredBatchId`, allocations[0].batchId);
      } else {
        form.setValue(`lines.${batchDialogLineIndex}.requiredBatchId`, undefined);
      }
    }
  };

  const getSelectedProduct = (index: number) => {
    const line = watchedLines?.[index];
    if (!line?.productId) return null;
    return products.find((p) => p.id === line.productId) ?? null;
  };

  async function onSubmit(data: CreateOrderInput) {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      console.log('Submitting order:', data);

      // Double-check validation
      const validation = CreateOrderSchema.safeParse(data);
      if (!validation.success) {
        console.error('Zod validation failed:', validation.error.flatten());
        const errors = validation.error.flatten();
        const errorMessages: string[] = [];
        Object.entries(errors.fieldErrors).forEach(([field, msgs]) => {
          errorMessages.push(`${field}: ${(msgs as string[]).join(', ')}`);
        });
        errors.formErrors.forEach(msg => errorMessages.push(msg));

        setSubmitError({
          message: 'Validation failed',
          details: errorMessages.join('\n')
        });
        setIsSubmitting(false);
        return;
      }

      const result = await createOrder(validation.data);
      if (result?.error) {
        console.error('Order creation error:', result.error, result.details);
        const detailsStr = result.details
          ? JSON.stringify(result.details, null, 2)
          : undefined;
        setSubmitError({
          message: result.error,
          details: detailsStr
        });
      } else {
        setSubmitSuccess(true);
        form.reset();
        setLineAllocations(new Map());
        // Success message will show briefly before redirect (if redirect happens)
      }
    } catch (error) {
      console.error('Failed to create order', error);
      setSubmitError({
        message: 'Failed to create order',
        details: error instanceof Error ? error.message : 'An unexpected error occurred. Check console for details.'
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // Manual submit handler that bypasses react-hook-form validation
  const handleManualSubmit = async () => {
    setSubmitError(null);
    setSubmitSuccess(false);

    const values = form.getValues();
    console.log('Manual submit - form values:', values);

    // Validate with Zod directly
    const validation = CreateOrderSchema.safeParse(values);
    if (!validation.success) {
      console.error('Manual validation failed:', validation.error.flatten());
      const errors = validation.error.flatten();
      const messages: string[] = [];

      Object.entries(errors.fieldErrors).forEach(([field, msgs]) => {
        messages.push(`${field}: ${(msgs as string[]).join(', ')}`);
      });
      errors.formErrors.forEach(msg => messages.push(msg));

      setSubmitError({
        message: 'Please fix the following validation errors',
        details: messages.join('\n')
      });
      return;
    }

    // If validation passes, submit
    await onSubmit(validation.data);
  };

  // Log validation errors when they occur
  const onInvalid = useCallback((errors: any) => {
    console.error('Form validation errors:', errors);
    console.error('Current form values:', form.getValues());

    // Manually validate to get better error messages
    const values = form.getValues();
    const messages: string[] = [];

    if (!values.customerId) {
      messages.push('Customer is required');
    }

    if (!values.lines || values.lines.length === 0) {
      messages.push('At least one order line is required');
    } else {
      values.lines.forEach((line: any, idx: number) => {
        const hasProduct = Boolean(line?.productId);
        const hasVarietyAndSize = Boolean(line?.plantVariety) && Boolean(line?.size);
        if (!hasProduct && !hasVarietyAndSize) {
          messages.push(`Line ${idx + 1}: Select a product`);
        }
        if (!line?.qty || line.qty < 1) {
          messages.push(`Line ${idx + 1}: Enter a valid quantity (minimum 1)`);
        }
      });
    }

    if (messages.length > 0) {
      setSubmitError({
        message: 'Please fix the following errors',
        details: messages.join('\n')
      });
    } else {
      setSubmitError({
        message: 'Unknown validation error',
        details: 'Check console for details.'
      });
    }
  }, [form]);

  const batchDialogProduct = batchDialogLineIndex !== null ? getSelectedProduct(batchDialogLineIndex) : null;
  const batchDialogAllocations = batchDialogLineIndex !== null ? (lineAllocations.get(batchDialogLineIndex) ?? []) : [];
  const batchDialogSelectedVariety =
    batchDialogLineIndex !== null ? form.getValues(`lines.${batchDialogLineIndex}.plantVariety`) : undefined;
  const batchDialogBatches =
    batchDialogProduct?.batches?.filter((b) =>
      batchDialogSelectedVariety && batchDialogSelectedVariety !== 'any'
        ? b.plantVariety === batchDialogSelectedVariety
        : true
    ) ?? [];

  return (
    <div className="max-w-7xl mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6">
          {/* Success Message */}
          {submitSuccess && (
            <Alert className="border-green-500 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Order Created Successfully!</AlertTitle>
              <AlertDescription className="text-green-700">
                Your order has been created. You will be redirected to the orders page.
              </AlertDescription>
            </Alert>
          )}

          {/* Server Error Display */}
          {submitError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{submitError.message}</AlertTitle>
              {submitError.details && (
                <AlertDescription>
                  <pre className="mt-2 text-xs whitespace-pre-wrap font-mono bg-destructive/10 p-2 rounded">
                    {submitError.details}
                  </pre>
                </AlertDescription>
              )}
            </Alert>
          )}

          {/* Form Validation Errors Display */}
          {Object.keys(form.formState.errors).length > 0 && !submitError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Please fix the following errors:</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  {form.formState.errors.customerId && <li>Customer is required</li>}
                  {form.formState.errors.lines && (
                    <li>
                      {Array.isArray(form.formState.errors.lines)
                        ? 'Some order lines have errors - check product selection and quantity'
                        : 'At least one order line is required'}
                    </li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Header Section - Invoice Style */}
          <div className="bg-white border rounded-lg shadow-sm">
            <div className="p-6 border-b">
              <h1 className="text-2xl font-semibold text-foreground">New Sales Order</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Create an order to send to your customer. Select a customer to see their product listings.
              </p>
            </div>

            {/* Top Row: Customer | Invoice Date | Due Date | Reference */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4 border-b bg-muted/20">
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer *</FormLabel>
                    <Select
                      onValueChange={(val) => {
                        field.onChange(val);
                        form.setValue('customerId', val, { shouldValidate: true });
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Search for a Customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
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
                name="deliveryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Order Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ''} className="bg-white" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shipMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Delivery Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="van">Van Delivery</SelectItem>
                        <SelectItem value="haulier">Haulier</SelectItem>
                        <SelectItem value="collection">Collection</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="orderReference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reference</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. PO Number" {...field} value={field.value ?? ''} className="bg-white" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Second Row: Store / Delivery Address */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 border-b">
              <FormField
                control={form.control}
                name="storeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Deliver To</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Update delivery address and shipToAddressId based on selection
                        if (value === 'custom') {
                          form.setValue('deliveryAddress', '');
                          form.setValue('shipToAddressId', undefined);
                        } else {
                          const address = customerAddresses.find(a => a.id === value);
                          if (address) {
                            form.setValue('deliveryAddress', formatAddress(address));
                            form.setValue('shipToAddressId', address.id);
                          } else {
                            form.setValue('shipToAddressId', undefined);
                          }
                        }
                      }}
                      value={field.value || 'main'}
                      disabled={!selectedCustomer}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder={selectedCustomer ? 'Select delivery location' : 'Select a customer first'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customerAddresses.length > 0 ? (
                          <>
                            {customerAddresses.map((address) => (
                              <SelectItem key={address.id} value={address.id}>
                                {address.storeName || address.label}
                                {address.isDefaultShipping && ' (Default)'}
                              </SelectItem>
                            ))}
                            <SelectItem value="custom">Custom delivery address</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value={selectedCustomer?.store || 'main'}>
                              {selectedCustomer?.store || 'Main premises'}
                            </SelectItem>
                            <SelectItem value="custom">Custom delivery address</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deliveryAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {storeId === 'custom' ? 'Custom Address' : 'Delivery Address'}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={storeId === 'custom' ? "Enter delivery address" : "Address will auto-fill"}
                        {...field}
                        value={field.value ?? ''}
                        className="bg-white"
                        readOnly={storeId !== 'custom'}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-muted/40 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <div className="col-span-4">Product / Service *</div>
              <div className="col-span-2">Description</div>
              <div className="col-span-1 text-right">Qty/Hrs *</div>
              <div className="col-span-1 text-right">Price *</div>
              <div className="col-span-1 text-right">Discount</div>
              <div className="col-span-1 text-right">VAT Rate *</div>
              <div className="col-span-1 text-right">VAT</div>
              <div className="col-span-1 text-right">Total</div>
            </div>

            {/* Line Items */}
            {fields.map((field, index) => {
              const line = watchedLines?.[index];
              const qty = typeof line?.qty === 'number' ? line.qty : (parseInt(String(line?.qty)) || 0);
              const price = typeof line?.unitPrice === 'number' ? line.unitPrice : (parseFloat(String(line?.unitPrice)) || 0);
              const vatRate = typeof line?.vatRate === 'number' ? line.vatRate : (parseFloat(String(line?.vatRate)) || 0);
              const lineNet = qty * price;
              const lineVat = lineNet * (vatRate / 100);
              const lineTotal = lineNet + lineVat;
              const selectedProduct = getSelectedProduct(index);
              const allocations = lineAllocations.get(index) ?? [];

              return (
                <div key={field.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b items-start hover:bg-muted/10 group">
                  {/* Product */}
                  <div className="col-span-4 space-y-2">
                    <FormField
                      control={form.control}
                      name={`lines.${index}.productId`}
                      render={({ field: productField }) => (
                        <FormItem>
                          <Select
                            onValueChange={(val) => {
                              productField.onChange(val);
                              const product = products.find((p) => p.id === val);
                              if (product) {
                                form.setValue(`lines.${index}.plantVariety`, product.plantVariety);
                                form.setValue(`lines.${index}.size`, product.size);
                                // Auto-populate price from customer alias or default price
                                const price = getProductPrice(product);
                                if (price !== undefined) {
                                  form.setValue(`lines.${index}.unitPrice`, price);
                                }
                              }
                              // Clear batch allocations when product changes
                              const next = new Map(lineAllocations);
                              next.delete(index);
                              setLineAllocations(next);
                            }}
                            value={productField.value || ''}
                          >
                            <FormControl>
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Select product" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {filteredProducts.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  <span>{resolveProductLabel(product)}</span>
                                  <span className="text-xs text-muted-foreground ml-2">
                                    ({product.availableStock} avail)
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedProduct && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Variety selection (by name, filters batches) */}
                        {selectedProduct?.batches && selectedProduct.batches.length > 0 && (
                          <FormField
                            control={form.control}
                            name={`lines.${index}.plantVariety`}
                            render={({ field }) => (
                              <FormItem className="w-48">
                                <FormLabel className="text-xs text-muted-foreground">Variety</FormLabel>
                                <Select
                                  onValueChange={(val) => {
                                    field.onChange(val);
                                    // Clear allocations when variety changes
                                    const next = new Map(lineAllocations);
                                    next.delete(index);
                                    setLineAllocations(next);
                                    // Clear required batch/variety ids (no IDs available here)
                                    form.setValue(`lines.${index}.requiredBatchId`, undefined);
                                  }}
                                  value={field.value || 'any'}
                                >
                                  <FormControl>
                                    <SelectTrigger className="h-8">
                                      <SelectValue placeholder="Any / Assorted" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="any">Any / Assorted</SelectItem>
                                    {Array.from(
                                      new Set((selectedProduct.batches ?? []).map((b) => b.plantVariety).filter(Boolean))
                                    ).map((name) => (
                                      <SelectItem key={name} value={name!}>
                                        {name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        )}

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => openBatchDialog(index)}
                        >
                          <Layers className="h-3 w-3 mr-1" />
                          {allocations.length > 0 ? `${allocations.length} batch(es)` : 'Select Batches'}
                        </Button>
                        {allocations.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {allocations.slice(0, 2).map((a) => (
                              <Badge key={a.batchId} variant="secondary" className="text-[10px]">
                                {a.batchNumber}: {a.qty}
                              </Badge>
                            ))}
                            {allocations.length > 2 && (
                              <Badge variant="outline" className="text-[10px]">+{allocations.length - 2} more</Badge>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name={`lines.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input placeholder="Description" {...field} value={field.value ?? ''} className="h-9" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Qty */}
                  <div className="col-span-1">
                    <FormField
                      control={form.control}
                      name={`lines.${index}.qty`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              className="h-9 text-right"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Price */}
                  <div className="col-span-1">
                    <FormField
                      control={form.control}
                      name={`lines.${index}.unitPrice`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="h-9 text-right"
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                field.onChange(val === '' ? undefined : parseFloat(val));
                              }}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Discount (placeholder) */}
                  <div className="col-span-1">
                    <Input type="number" step="0.01" placeholder="0.00" className="h-9 text-right" disabled />
                  </div>

                  {/* VAT Rate */}
                  <div className="col-span-1">
                    <FormField
                      control={form.control}
                      name={`lines.${index}.vatRate`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.5"
                              placeholder="13.5"
                              className="h-9 text-right"
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                field.onChange(val === '' ? undefined : parseFloat(val));
                              }}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* VAT Amount */}
                  <div className="col-span-1 text-right text-sm pt-2">
                    €{lineVat.toFixed(2)}
                  </div>

                  {/* Total */}
                  <div className="col-span-1 flex items-center justify-end gap-1">
                    <span className="text-sm font-medium">€{lineTotal.toFixed(2)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {/* Add Line Button */}
            <div className="px-4 py-3 border-b">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-primary"
                onClick={() =>
                  append({
                    plantVariety: '',
                    size: '',
                    qty: 1,
                    allowSubstitute: true,
                    unitPrice: undefined,
                    vatRate: 13.5, // Default Irish VAT rate
                    description: '',
                  })
                }
              >
                <Plus className="h-4 w-4 mr-1" />
                Add line
              </Button>

              <div className="inline-flex items-center gap-2 ml-4 text-xs text-muted-foreground">
                <Switch
                  checked={showAllProducts}
                  onCheckedChange={(checked) => setShowAllProducts(checked)}
                  className="scale-75"
                />
                <span>Show all products (not just customer aliases)</span>
              </div>
            </div>
          </div>

          {/* Notes and Totals Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Notes */}
            <div className="bg-white border rounded-lg shadow-sm p-6 space-y-4">
              <FormField
                control={form.control}
                name="notesCustomer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Notes visible to customer..."
                        className="resize-none h-24"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notesInternal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Internal Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Internal notes (not visible to customer)..."
                        className="resize-none h-24"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Totals Summary */}
            <div className="bg-white border rounded-lg shadow-sm p-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span>€0.00</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Net</span>
                  <span className="font-medium">€{totals.net.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">VAT</span>
                  <span className="font-medium">€{totals.vat.toFixed(2)}</span>
                </div>
                <div className="border-t pt-3 flex items-center justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>€{totals.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.watch('autoPrint')}
                    onCheckedChange={(v) => form.setValue('autoPrint', v)}
                  />
                  <span className="text-sm">Auto print pick list and invoice</span>
                </div>

                <Button
                  type="button"
                  disabled={isSubmitting}
                  size="lg"
                  className="w-full"
                  onClick={handleManualSubmit}
                >
                  {isSubmitting ? 'Creating Order...' : 'Create Order'}
                </Button>

                <Button type="button" variant="outline" className="w-full" onClick={() => form.reset()}>
                  Reset Form
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Form>

      {/* Batch Selection Dialog */}
      <BatchSelectionDialog
        open={batchDialogOpen}
        onOpenChange={setBatchDialogOpen}
        batches={batchDialogBatches}
        productName={batchDialogProduct ? resolveProductLabel(batchDialogProduct) : ''}
        productVariety={batchDialogSelectedVariety || batchDialogProduct?.plantVariety || ''}
        productSize={batchDialogProduct?.size ?? ''}
        currentAllocations={batchDialogAllocations}
        onConfirm={handleBatchConfirm}
      />
    </div>
  );
}
