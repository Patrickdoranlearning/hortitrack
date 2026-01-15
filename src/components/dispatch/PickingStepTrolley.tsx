'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ShoppingCart,
  Plus,
  Minus,
  ArrowRight,
  ArrowLeft,
  Layers,
  Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePickingWizardStore, type TrolleyInfo } from '@/stores/use-picking-wizard-store';
import { useAttributeOptions } from '@/hooks/useAttributeOptions';

// Default trolley types if attribute options not loaded
const DEFAULT_TROLLEY_TYPES = [
  { systemCode: 'tag6', displayLabel: 'Tag 6 (Yellow)' },
  { systemCode: 'dc', displayLabel: 'DC (No Tag)' },
  { systemCode: 'danish', displayLabel: 'Danish Trolley' },
  { systemCode: 'dutch', displayLabel: 'Dutch Trolley' },
  { systemCode: 'half_trolley', displayLabel: 'Half Trolley' },
  { systemCode: 'pallet', displayLabel: 'Pallet' },
];

export default function PickingStepTrolley() {
  const {
    items,
    trolleyInfo,
    setTrolleyInfo,
    nextStep,
    prevStep,
    canProceed,
  } = usePickingWizardStore();

  // Load trolley types from attribute options
  const { options: trolleyTypeOptions, loading: loadingOptions } = useAttributeOptions('trolley_type');

  // Use attribute options if available, otherwise use defaults
  const trolleyTypes = trolleyTypeOptions.length > 0
    ? trolleyTypeOptions.filter(o => o.isActive)
    : DEFAULT_TROLLEY_TYPES;

  // Initialize trolleyCounts from trolleyTypes if not set
  useEffect(() => {
    if (!trolleyInfo.trolleyCounts && trolleyTypes.length > 0) {
      const initialCounts: Record<string, number> = {};
      trolleyTypes.forEach(type => {
        initialCounts[type.systemCode] = 0;
      });
      setTrolleyInfo({ trolleyCounts: initialCounts });
    }
  }, [trolleyTypes, trolleyInfo.trolleyCounts, setTrolleyInfo]);

  const totalUnits = items.reduce((sum, item) => sum + item.pickedQty, 0);

  // Calculate total trolley count from all types
  const totalTrolleys = trolleyInfo.trolleyCounts
    ? Object.values(trolleyInfo.trolleyCounts).reduce((sum, count) => sum + count, 0)
    : trolleyInfo.count;

  const handleTrolleyCountChange = (typeCode: string, value: number) => {
    const newCount = Math.max(0, value);
    const counts = { ...(trolleyInfo.trolleyCounts || {}) };
    counts[typeCode] = newCount;

    // Also update legacy count and trolleyType for backward compatibility
    const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
    const primaryType = Object.entries(counts).find(([_, c]) => c > 0)?.[0] as TrolleyInfo['trolleyType'] || 'tag6';

    setTrolleyInfo({
      trolleyCounts: counts,
      count: total,
      trolleyType: primaryType,
    });
  };

  const handleShelvesChange = (value: number) => {
    const newShelves = Math.max(0, value);
    setTrolleyInfo({ shelves: newShelves });
  };

  const handleTrolleyNumberAdd = () => {
    const numbers = trolleyInfo.trolleyNumbers || [];
    setTrolleyInfo({ trolleyNumbers: [...numbers, ''] });
  };

  const handleTrolleyNumberChange = (index: number, value: string) => {
    const numbers = [...(trolleyInfo.trolleyNumbers || [])];
    numbers[index] = value;
    setTrolleyInfo({ trolleyNumbers: numbers });
  };

  const handleTrolleyNumberRemove = (index: number) => {
    const numbers = [...(trolleyInfo.trolleyNumbers || [])];
    numbers.splice(index, 1);
    setTrolleyInfo({ trolleyNumbers: numbers });
  };

  // Build summary of trolleys being used
  const trolleySummary = trolleyInfo.trolleyCounts
    ? Object.entries(trolleyInfo.trolleyCounts)
        .filter(([_, count]) => count > 0)
        .map(([code, count]) => {
          const type = trolleyTypes.find(t => t.systemCode === code);
          return { label: type?.displayLabel || code, count };
        })
    : [];

  return (
    <div className="space-y-4 pb-24">
      {/* Order Summary */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total units picked</span>
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {totalUnits} units
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Trolley Type Quantities */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Trolleys Used
          </CardTitle>
          <CardDescription>
            Enter the quantity for each trolley type
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingOptions ? (
            <div className="py-4 text-center text-muted-foreground">Loading trolley types...</div>
          ) : (
            trolleyTypes.map((type) => {
              const count = trolleyInfo.trolleyCounts?.[type.systemCode] || 0;
              return (
                <div key={type.systemCode} className="flex items-center justify-between gap-4">
                  <Label className="flex-1 text-base">{type.displayLabel}</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleTrolleyCountChange(type.systemCode, count - 1)}
                      disabled={count <= 0}
                      className="h-10 w-10"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      min={0}
                      value={count}
                      onChange={(e) => handleTrolleyCountChange(type.systemCode, parseInt(e.target.value) || 0)}
                      className="w-16 text-center text-lg font-semibold"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleTrolleyCountChange(type.systemCode, count + 1)}
                      className="h-10 w-10"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Shelves */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-5 w-5" />
            Number of Shelves
          </CardTitle>
          <CardDescription>
            How many shelves are being used?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleShelvesChange((trolleyInfo.shelves || 0) - 1)}
              disabled={(trolleyInfo.shelves || 0) <= 0}
              className="h-10 w-10"
            >
              <Minus className="h-5 w-5" />
            </Button>
            <Input
              type="number"
              min={0}
              value={trolleyInfo.shelves || 0}
              onChange={(e) => handleShelvesChange(parseInt(e.target.value) || 0)}
              className="w-20 text-center text-2xl font-bold"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleShelvesChange((trolleyInfo.shelves || 0) + 1)}
              className="h-10 w-10"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Trolley Numbers (Optional) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Trolley Numbers (Optional)</CardTitle>
          <CardDescription>
            Optionally record specific trolley IDs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(trolleyInfo.trolleyNumbers || []).map((number, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={number}
                onChange={(e) => handleTrolleyNumberChange(index, e.target.value)}
                placeholder={`Trolley ${index + 1}`}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleTrolleyNumberRemove(index)}
              >
                <Minus className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={handleTrolleyNumberAdd}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Trolley Number
          </Button>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className={cn(totalTrolleys > 0 && 'bg-green-50 border-green-200')}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {trolleySummary.length > 0 ? (
            <>
              {trolleySummary.map(({ label, count }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span>{label}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex items-center justify-between">
                <span className="font-medium">Total Trolleys</span>
                <Badge className="bg-green-600">{totalTrolleys}</Badge>
              </div>
              {(trolleyInfo.shelves || 0) > 0 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Shelves</span>
                  <span>{trolleyInfo.shelves}</span>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No trolleys selected</p>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t safe-area-pb">
        <div className="flex gap-3">
          <Button variant="outline" onClick={prevStep} className="flex-1">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={nextStep}
            disabled={!canProceed()}
            className={cn(
              'flex-1',
              canProceed() && 'bg-green-600 hover:bg-green-700'
            )}
          >
            Complete Order
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
