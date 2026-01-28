'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { FormProvider, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateOrderInput,
  CreateOrderSchema,
  CustomerAddress,
} from '@/lib/sales/types';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Trash2 } from 'lucide-react';
import { CustomerDeliveryStep } from './steps/CustomerDeliveryStep';
import { ProductSelectionStep } from './steps/ProductSelectionStep';
import { PricingReviewStep } from './steps/PricingReviewStep';
import { CopyOrderDialog } from './CopyOrderDialog';
import { createOrder, getOrderForCopy, getPricingHints, type PricingHint } from '@/app/sales/actions';
import type { ProductWithBatches } from '@/server/sales/products-with-batches';
import type { ProductGroupWithAvailability } from '@/server/sales/product-groups-with-availability';
import type { BatchAllocation } from '../BatchSelectionDialog';
import type { OrgFee } from '@/app/sales/settings/fees/actions';

export type SalesCustomer = {
  id: string;
  name: string;
  store?: string | null;
  currency?: string;
  countryCode?: string;
  addresses?: CustomerAddress[];
  requiresPrePricing?: boolean;
  prePricingFoc?: boolean;
  prePricingCostPerLabel?: number | null;
};

type SalesOrderWizardProps = {
  customers: SalesCustomer[];
  products: ProductWithBatches[];
  productGroups?: ProductGroupWithAvailability[];
  copyOrderId?: string;
  fees?: OrgFee[];
};

const DEFAULT_LINE = {
  plantVariety: '',
  size: '',
  requiredVarietyId: undefined as string | undefined,
  requiredBatchId: undefined as string | undefined,
  qty: 1,
  allowSubstitute: true,
  unitPrice: undefined as number | undefined,
  vatRate: 13.5,
  description: '',
  rrp: undefined as number | undefined,
};

// Draft persistence key
const DRAFT_STORAGE_KEY = 'hortitrack_sales_order_draft';

type DraftData = {
  formValues: Partial<CreateOrderInput>;
  step: number;
  lineAllocations: [number, BatchAllocation[]][];
  savedAt: number;
};

function saveDraft(data: DraftData) {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be unavailable or full
  }
}

function loadDraft(): DraftData | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as DraftData;
    // Expire drafts after 24 hours
    if (Date.now() - data.savedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

const steps = [
  { id: 'customer', label: 'Customer & Delivery' },
  { id: 'products', label: 'Products & Varieties' },
  { id: 'pricing', label: 'Pricing & Review' },
];

export function SalesOrderWizard({ customers, products, productGroups = [], copyOrderId, fees = [] }: SalesOrderWizardProps) {
  // Draft state - loaded in useEffect to avoid hydration mismatch
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  // Initialize state without draft (server-safe defaults)
  const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false); // Prevent auto-save during/after submission
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [lineAllocations, setLineAllocations] = useState<Map<number, BatchAllocation[]>>(new Map());
  const [prefillPending, startPrefillTransition] = useTransition();
  const [pricingHints, setPricingHints] = useState<Record<string, PricingHint>>({});

  const form = useForm<CreateOrderInput>({
    resolver: zodResolver(CreateOrderSchema),
    defaultValues: {
      customerId: '',
      storeId: 'main',
      deliveryAddress: '',
      orderReference: '',
      deliveryDate: new Date().toISOString().split('T')[0],
      shipMethod: '',
      notesCustomer: '',
      notesInternal: '',
      autoPrint: true,
      lines: [DEFAULT_LINE],
    },
  });

  // Load draft after mount to avoid hydration mismatch
  useEffect(() => {
    const draft = loadDraft();
    if (draft && draft.formValues.customerId) {
      // Restore form values
      form.reset({
        customerId: draft.formValues.customerId ?? '',
        storeId: draft.formValues.storeId ?? 'main',
        deliveryAddress: draft.formValues.deliveryAddress ?? '',
        orderReference: draft.formValues.orderReference ?? '',
        deliveryDate: draft.formValues.deliveryDate ?? new Date().toISOString().split('T')[0],
        shipMethod: draft.formValues.shipMethod ?? '',
        notesCustomer: draft.formValues.notesCustomer ?? '',
        notesInternal: draft.formValues.notesInternal ?? '',
        autoPrint: draft.formValues.autoPrint ?? true,
        shipToAddressId: draft.formValues.shipToAddressId,
        lines: draft.formValues.lines?.length ? draft.formValues.lines : [DEFAULT_LINE],
      });
      // Restore step and allocations
      setStep(draft.step);
      if (draft.lineAllocations) {
        setLineAllocations(new Map(draft.lineAllocations));
      }
      setHasDraft(true);
      setDraftLoaded(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { control, handleSubmit, reset, setValue } = form;
  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'lines',
  });

  const selectedCustomerId = useWatch({ control, name: 'customerId' });
  const watchedLines = useWatch({ control, name: 'lines' });

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  // Filter products/batches based on customer reservation
  // Shows: unreserved batches + batches reserved for the selected customer
  const filteredProducts = useMemo(() => {
    return products
      .map((product) => {
        const filteredBatches = product.batches.filter((batch) => {
          // Include batch if: unreserved OR reserved for this customer
          return !batch.reservedForCustomerId || batch.reservedForCustomerId === selectedCustomerId;
        });
        const availableStock = filteredBatches.reduce((sum, b) => sum + b.quantity, 0);
        return {
          ...product,
          batches: filteredBatches,
          availableStock,
        };
      })
      .filter((p) => p.availableStock > 0); // Only show products with available stock
  }, [products, selectedCustomerId]);

  const customerAddresses = useMemo(() => selectedCustomer?.addresses ?? [], [selectedCustomer]);
  const defaultShippingAddress = useMemo(
    () => customerAddresses.find((a) => a.isDefaultShipping) ?? customerAddresses[0],
    [customerAddresses]
  );

  // Auto-populate delivery address when customer changes
  useEffect(() => {
    if (defaultShippingAddress) {
      const formatted = formatAddress(defaultShippingAddress);
      setValue('storeId', defaultShippingAddress.id);
      setValue('shipToAddressId', defaultShippingAddress.id);
      setValue('deliveryAddress', formatted);
    } else {
      setValue('storeId', 'main');
      setValue('shipToAddressId', undefined);
      setValue('deliveryAddress', '');
    }
    setLineAllocations(new Map());
  }, [defaultShippingAddress, setValue]);

  // Fetch pricing hints when customer changes
  useEffect(() => {
    if (!selectedCustomerId) {
      setPricingHints({});
      return;
    }
    const productIds = filteredProducts.map((p) => p.id);
    if (productIds.length === 0) return;

    getPricingHints(selectedCustomerId, productIds).then((hints) => {
      setPricingHints(hints);
    });
  }, [selectedCustomerId, filteredProducts]);

  // Pre-fill from query string copyOrderId on first load
  useEffect(() => {
    if (!copyOrderId) return;
    startPrefillTransition(async () => {
      const result = await getOrderForCopy(copyOrderId);
      if (result?.order) {
        applyCopiedOrder(result.order);
      } else if (result?.error) {
        setSubmitError(result.error);
      }
    });
  }, [copyOrderId]);

  // Auto-save draft when form changes
  const formValues = form.watch();
  useEffect(() => {
    // Don't save empty drafts or while loading copyOrderId
    if (!formValues.customerId && step === 0) return;
    if (prefillPending) return;
    // Don't auto-save if we're submitting (prevents re-saving after clearDraft)
    if (submittingRef.current) return;

    const draftData: DraftData = {
      formValues,
      step,
      lineAllocations: Array.from(lineAllocations.entries()),
      savedAt: Date.now(),
    };
    saveDraft(draftData);
    setHasDraft(true);
  }, [formValues, step, lineAllocations, prefillPending]);

  // Clear draft handler
  const handleClearDraft = useCallback(() => {
    clearDraft();
    setHasDraft(false);
    setStep(0);
    setLineAllocations(new Map());
    form.reset({
      customerId: '',
      storeId: 'main',
      deliveryAddress: '',
      orderReference: '',
      deliveryDate: new Date().toISOString().split('T')[0],
      shipMethod: '',
      notesCustomer: '',
      notesInternal: '',
      autoPrint: true,
      lines: [DEFAULT_LINE],
    });
  }, [form]);

  const totals = useMemo(() => {
    return (watchedLines || []).reduce(
      (acc, line) => {
        const qty = typeof line?.qty === 'number' ? line.qty : Number(line?.qty) || 0;
        const price = typeof line?.unitPrice === 'number' ? line.unitPrice : Number(line?.unitPrice) || 0;
        const vatRate = typeof line?.vatRate === 'number' ? line.vatRate : Number(line?.vatRate) || 0;
        const net = qty * price;
        const vat = net * (vatRate / 100);
        acc.net += net;
        acc.vat += vat;
        return acc;
      },
      { net: 0, vat: 0, total: 0 }
    );
  }, [watchedLines]);

  const canGoNext = () => {
    if (step === 0) {
      return Boolean(selectedCustomerId);
    }
    if (step === 1) {
      // Allow proceeding if any line has a product OR a product group selected
      return (watchedLines || []).some((line) => line?.productId || line?.productGroupId);
    }
    return true;
  };

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    setIsSubmitting(true);
    submittingRef.current = true; // Prevent auto-save from re-saving draft
    try {
      // Merge user-specified lineAllocations into form values before submission
      // No auto-allocation - pickers will allocate specific batches during fulfillment
      const valuesWithAllocations = {
        ...values,
        lines: values.lines.map((line, index) => {
          const userAllocations = lineAllocations.get(index);
          const validUserAllocations = userAllocations?.filter(a => a.batchId && a.batchId.length > 0) || [];

          if (validUserAllocations.length > 0) {
            return {
              ...line,
              allocations: validUserAllocations.map(a => ({
                batchId: a.batchId,
                qty: a.qty,
              })),
            };
          }

          // No allocations - order line will be fulfilled at pick time
          return line;
        }),
      };

      const result = await createOrder(valuesWithAllocations);
      // If createOrder returns an error object, display it
      if (result && 'error' in result) {
        setSubmitError(result.error ?? 'Failed to create order');
        setIsSubmitting(false);
        submittingRef.current = false; // Allow auto-save to resume on error
        return;
      }
      // Clear draft on successful order creation
      clearDraft();
      setHasDraft(false);
    } catch (err: unknown) {
      // Next.js redirect() throws an error with digest starting with NEXT_REDIRECT
      // This is expected behavior and not an actual error
      if (err && typeof err === 'object' && 'digest' in err) {
        const digest = (err as { digest?: string }).digest;
        if (digest?.startsWith('NEXT_REDIRECT')) {
          // Clear draft before redirect completes
          clearDraft();
          setHasDraft(false);
          return;
        }
      }
      setSubmitError(err instanceof Error ? err.message : 'An unexpected response was received from the server.');
      submittingRef.current = false; // Allow auto-save to resume on error
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleCopySelect = (orderId: string) => {
    startPrefillTransition(async () => {
      const result = await getOrderForCopy(orderId);
      if (result?.order) {
        applyCopiedOrder(result.order);
        setCopyDialogOpen(false);
        setStep(1);
      } else if (result?.error) {
        setSubmitError(result.error);
      }
    });
  };

  const applyCopiedOrder = (payload: {
    customerId: string;
    shipToAddressId?: string;
    deliveryDate?: string;
    lines: Partial<CreateOrderInput['lines'][number]>[];
  }) => {
    const nextLines =
      payload.lines?.length && payload.lines.length > 0
        ? payload.lines.map((line) => ({
            ...DEFAULT_LINE,
            ...line,
            qty: line.qty ?? 1,
          }))
        : [DEFAULT_LINE];

    reset({
      customerId: payload.customerId,
      storeId: payload.shipToAddressId ?? 'main',
      shipToAddressId: payload.shipToAddressId,
      deliveryDate: payload.deliveryDate ?? '',
      deliveryAddress: '',
      orderReference: '',
      shipMethod: '',
      notesCustomer: '',
      notesInternal: '',
      autoPrint: true,
      lines: nextLines,
    });
    setLineAllocations(new Map());
  };

  const handleAllocationsChange = (index: number, allocations: BatchAllocation[]) => {
    const next = new Map(lineAllocations);
    next.set(index, allocations);
    setLineAllocations(next);
  };

  const currentStep = steps[step];

  return (
    <FormProvider {...form}>
      <div className="space-y-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold">New Sales Order</h1>
                {hasDraft && draftLoaded && (
                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                    Draft restored
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">Wizard flow with batches & pre-pricing.</p>
            </div>
            <div className="flex items-center gap-2">
              {steps.map((s, idx) => (
                <div key={s.id} className="flex items-center gap-2">
                  <div
                    className={cn(
                      'h-8 w-8 rounded-full border flex items-center justify-center text-sm',
                      idx === step
                        ? 'bg-primary text-primary-foreground'
                        : idx < step
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {idx + 1}
                  </div>
                  <span className={cn('text-sm font-medium', idx === step ? 'text-foreground' : 'text-muted-foreground')}>
                    {s.label}
                  </span>
                  {idx < steps.length - 1 && <Separator orientation="vertical" className="h-8" />}
                </div>
              ))}
            </div>
          </div>
        </Card>

        {submitError && (
          <Alert variant="destructive">
            <AlertTitle>Submission Error</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        <Card className="p-6 space-y-6">
          {/* Show customer info on steps 2 and 3 */}
          {step > 0 && selectedCustomer && (
            <div className="flex items-center gap-2 pb-4 border-b text-sm">
              <span className="text-muted-foreground">Customer:</span>
              <span className="font-medium">{selectedCustomer.name}</span>
              {selectedCustomer.store && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">Store:</span>
                  <span className="font-medium">{selectedCustomer.store}</span>
                </>
              )}
            </div>
          )}

          {currentStep.id === 'customer' && (
            <CustomerDeliveryStep
              form={form}
              customers={customers}
              selectedCustomer={selectedCustomer}
              customerAddresses={customerAddresses}
              onOpenCopyDialog={() => setCopyDialogOpen(true)}
              prefillPending={prefillPending}
            />
          )}

          {currentStep.id === 'products' && (
            <ProductSelectionStep
              form={form}
              products={filteredProducts}
              productGroups={productGroups}
              fields={fields}
              append={append}
              remove={remove}
              lineAllocations={lineAllocations}
              onAllocationsChange={handleAllocationsChange}
              selectedCustomerId={selectedCustomerId}
              pricingHints={pricingHints}
            />
          )}

          {currentStep.id === 'pricing' && (
            <PricingReviewStep
              form={form}
              totals={totals}
              lines={fields}
              products={filteredProducts}
              selectedCustomerId={selectedCustomerId}
              fees={fees}
              defaultShowRrp={selectedCustomer?.requiresPrePricing ?? false}
              customerPrePricing={
                selectedCustomer
                  ? {
                      prePricingFoc: selectedCustomer.prePricingFoc ?? false,
                      prePricingCostPerLabel: selectedCustomer.prePricingCostPerLabel ?? null,
                    }
                  : undefined
              }
            />
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Step {step + 1} of {steps.length}
              </span>
              {hasDraft && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={handleClearDraft}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear draft
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
                Back
              </Button>
              {step < steps.length - 1 ? (
                <Button disabled={!canGoNext()} onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}>
                  Next
                </Button>
              ) : (
                <Button onClick={onSubmit} disabled={isSubmitting}>
                  {isSubmitting ? 'Creating Order...' : 'Create Order'}
                </Button>
              )}
            </div>
          </div>
        </Card>

        <CopyOrderDialog
          open={copyDialogOpen}
          onOpenChange={setCopyDialogOpen}
          customerId={selectedCustomerId}
          onCopy={handleCopySelect}
        />
      </div>
    </FormProvider>
  );
}

function formatAddress(address: CustomerAddress) {
  const parts = [address.line1, address.line2, address.city, address.county, address.eircode].filter(Boolean);
  return parts.join(', ');
}
