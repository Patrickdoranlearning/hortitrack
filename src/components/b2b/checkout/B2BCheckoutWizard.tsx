'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, CheckCircle2, Package, Tag } from 'lucide-react';
import { B2BCheckoutTrolley } from './B2BCheckoutCart';
import { B2BCheckoutPricing, type PricingHint } from './B2BCheckoutPricing';
import { B2BCheckoutDelivery } from './B2BCheckoutDelivery';
import { B2BCheckoutReview } from './B2BCheckoutReview';
import type { CartItem } from '@/lib/b2b/types';
import type { Database } from '@/types/supabase';

type CustomerAddress = Database['public']['Tables']['customer_addresses']['Row'];

type Props = {
  cart: CartItem[];
  addresses: CustomerAddress[];
  pricingHints?: Record<string, PricingHint>;
  onUpdateCart: (cart: CartItem[]) => void;
  onSubmit: (deliveryAddressId: string, deliveryDate?: string, notes?: string) => Promise<void>;
  onStepChange?: (stepIndex: number, stepId: string) => void;
  error?: string | null;
};

const steps = [
  { id: 'cart', label: 'Trolley', icon: Package },
  { id: 'pricing', label: 'Pricing', icon: Tag },
  { id: 'delivery', label: 'Delivery', icon: Calendar },
  { id: 'review', label: 'Review', icon: CheckCircle2 },
];

export function B2BCheckoutWizard({
  cart,
  addresses,
  pricingHints,
  onUpdateCart,
  onSubmit,
  onStepChange,
  error,
}: Props) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleStepChange = (newStep: number) => {
    setCurrentStep(newStep);
    onStepChange?.(newStep, steps[newStep].id);
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deliveryAddressId, setDeliveryAddressId] = useState(
    addresses.find((a) => a.is_default_shipping)?.id || addresses[0]?.id || ''
  );
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');

  const currentAddressLabel = useMemo(() => {
    const address = addresses.find((a) => a.id === deliveryAddressId);
    return address
      ? address.label || address.store_name || `${address.line1}, ${address.city || ''}`
      : 'No address selected';
  }, [addresses, deliveryAddressId]);

  const updateItem = (index: number, updates: Partial<CartItem>) => {
    const newCart = [...cart];
    newCart[index] = { ...newCart[index], ...updates };
    onUpdateCart(newCart);
  };

  const removeItem = (index: number) => {
    const newCart = cart.filter((_, i) => i !== index);
    onUpdateCart(newCart);
  };

  const canProceed =
    cart.length > 0 &&
    (steps[currentStep].id !== 'delivery' || Boolean(deliveryAddressId));

  const goNext = () => {
    if (currentStep < steps.length - 1 && canProceed) {
      handleStepChange(currentStep + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      handleStepChange(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || cart.length === 0 || !deliveryAddressId) return;
    setIsSubmitting(true);
    try {
      await onSubmit(deliveryAddressId, deliveryDate || undefined, notes || undefined);
    } finally {
      setIsSubmitting(false);
    }
  };

  const StepIcon = steps[currentStep].icon;

  const renderStep = () => {
    switch (steps[currentStep].id) {
      case 'cart':
        return (
          <B2BCheckoutTrolley trolley={cart} onUpdateItem={updateItem} onRemoveItem={removeItem} />
        );
      case 'pricing':
        return (
          <B2BCheckoutPricing cart={cart} pricingHints={pricingHints} onUpdateItem={updateItem} />
        );
      case 'delivery':
        return (
          <B2BCheckoutDelivery
            addresses={addresses}
            deliveryAddressId={deliveryAddressId}
            deliveryDate={deliveryDate}
            notes={notes}
            onChange={(updates) => {
              if (updates.deliveryAddressId !== undefined) setDeliveryAddressId(updates.deliveryAddressId);
              if (updates.deliveryDate !== undefined) setDeliveryDate(updates.deliveryDate);
              if (updates.notes !== undefined) setNotes(updates.notes);
            }}
          />
        );
      case 'review':
      default:
        return (
          <B2BCheckoutReview
            cart={cart}
            deliverySummary={{ addressLabel: currentAddressLabel, deliveryDate, notes }}
          />
        );
    }
  };

  return (
    <Card className="sticky top-20 h-fit">
      <CardHeader>
        <div className="flex items-center gap-2">
          <StepIcon className="h-5 w-5" />
          <div>
            <CardTitle>{steps[currentStep].label}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Step {currentStep + 1} of {steps.length}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-1">
              <div
                className={`h-2 w-2 rounded-full ${
                  idx === currentStep ? 'bg-primary' : idx < currentStep ? 'bg-primary/60' : 'bg-muted-foreground/30'
                }`}
              />
              <span className={idx === currentStep ? 'text-foreground' : ''}>{step.label}</span>
              {idx < steps.length - 1 && <Separator orientation="vertical" className="h-4" />}
            </div>
          ))}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {renderStep()}

        <div className="flex justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={goBack} disabled={currentStep === 0}>
            Back
          </Button>
          {currentStep < steps.length - 1 ? (
            <Button onClick={goNext} disabled={!canProceed}>
              Next
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || cart.length === 0 || !deliveryAddressId}
            >
              {isSubmitting ? 'Placing Order...' : 'Place Order'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}




