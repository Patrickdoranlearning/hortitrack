'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
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
import { CustomerDeliveryStep } from './steps/CustomerDeliveryStep';
import { ProductSelectionStep } from './steps/ProductSelectionStep';
import { PricingReviewStep } from './steps/PricingReviewStep';
import { CopyOrderDialog } from './CopyOrderDialog';
import { createOrder, getOrderForCopy } from '@/app/sales/actions';
import type { ProductWithBatches } from '@/server/sales/products-with-batches';
import type { BatchAllocation } from '../BatchSelectionDialog';

export type SalesCustomer = {
  id: string;
  name: string;
  store?: string | null;
  currency?: string;
  countryCode?: string;
  addresses?: CustomerAddress[];
};

type SalesOrderWizardProps = {
  customers: SalesCustomer[];
  products: ProductWithBatches[];
  copyOrderId?: string;
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

const steps = [
  { id: 'customer', label: 'Customer & Delivery' },
  { id: 'products', label: 'Products & Batches' },
  { id: 'pricing', label: 'Pricing & Review' },
];

export function SalesOrderWizard({ customers, products, copyOrderId }: SalesOrderWizardProps) {
  const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [lineAllocations, setLineAllocations] = useState<Map<number, BatchAllocation[]>>(new Map());
  const [prefillPending, startPrefillTransition] = useTransition();

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
      autoPrint: true,
      lines: [DEFAULT_LINE],
    },
  });

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
      return (watchedLines || []).some((line) => line?.productId);
    }
    return true;
  };

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await createOrder(values);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create order');
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
              <h1 className="text-2xl font-semibold">New Sales Order</h1>
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
              products={products}
              fields={fields}
              append={append}
              remove={remove}
              lineAllocations={lineAllocations}
              onAllocationsChange={handleAllocationsChange}
              selectedCustomerId={selectedCustomerId}
            />
          )}

          {currentStep.id === 'pricing' && (
            <PricingReviewStep
              form={form}
              totals={totals}
              lines={fields}
              onSubmit={onSubmit}
              isSubmitting={isSubmitting}
            />
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-muted-foreground">
              Step {step + 1} of {steps.length}
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
