'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sprout, ArrowRightLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PlanType = 'propagation' | 'transplant';

type PlanTypeStepProps = {
  selectedType: PlanType | null;
  onSelect: (type: PlanType) => void;
  onCancel?: () => void;
};

export function PlanTypeStep({ selectedType, onSelect, onCancel }: PlanTypeStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h3 className="text-lg font-medium">What would you like to plan?</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Choose the type of batch planning you want to do
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Plan Propagation */}
        <Card
          className={cn(
            'cursor-pointer transition-all hover:border-primary/50 hover:shadow-md',
            selectedType === 'propagation' && 'border-primary ring-2 ring-primary/20'
          )}
          onClick={() => onSelect('propagation')}
        >
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-3 p-4 rounded-full bg-green-100">
              <Sprout className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-xl">Plan Propagation</CardTitle>
            <CardDescription>
              Schedule future propagation batches
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-green-600">•</span>
                Create new batches from scratch
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">•</span>
                Specify variety, tray size, quantity
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">•</span>
                Schedule for a future date
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Plan Transplant */}
        <Card
          className={cn(
            'cursor-pointer transition-all hover:border-primary/50 hover:shadow-md',
            selectedType === 'transplant' && 'border-primary ring-2 ring-primary/20'
          )}
          onClick={() => onSelect('transplant')}
        >
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-3 p-4 rounded-full bg-blue-100">
              <ArrowRightLeft className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-xl">Plan Transplant</CardTitle>
            <CardDescription>
              Schedule transplants from existing batches
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                Select source batches to transplant from
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                Choose target pot size and quantity
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                Reserves quantity on source batch
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : (
          <div />
        )}
        <Button type="button" disabled={!selectedType} onClick={() => selectedType && onSelect(selectedType)}>
          Continue
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
