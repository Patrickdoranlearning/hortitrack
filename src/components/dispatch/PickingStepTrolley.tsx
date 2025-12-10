'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const TROLLEY_TYPES = [
  { value: 'tag6', label: 'Tag 6 (Yellow)', description: 'Standard yellow tagged trolley' },
  { value: 'dc', label: 'DC (No Tag)', description: 'Distribution center trolley' },
  { value: 'danish', label: 'Danish Trolley', description: 'Standard danish trolley' },
  { value: 'dutch', label: 'Dutch Trolley', description: 'Dutch style trolley' },
  { value: 'pallet', label: 'Pallet', description: 'Full pallet' },
] as const;

export default function PickingStepTrolley() {
  const {
    items,
    trolleyInfo,
    setTrolleyInfo,
    nextStep,
    prevStep,
    canProceed,
  } = usePickingWizardStore();

  const totalUnits = items.reduce((sum, item) => sum + item.pickedQty, 0);

  const handleTrolleyTypeChange = (value: TrolleyInfo['trolleyType']) => {
    setTrolleyInfo({ trolleyType: value });
  };

  const handleCountChange = (delta: number) => {
    const newCount = Math.max(0, trolleyInfo.count + delta);
    setTrolleyInfo({ count: newCount });
  };

  const handleShelvesChange = (delta: number) => {
    const current = trolleyInfo.shelves || 0;
    const newShelves = Math.max(0, Math.min(10, current + delta));
    setTrolleyInfo({ shelves: newShelves });
  };

  const handleTrolleyNumberAdd = () => {
    const numbers = trolleyInfo.trolleyNumbers || [];
    // Add a placeholder for a new trolley number
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

  const selectedType = TROLLEY_TYPES.find((t) => t.value === trolleyInfo.trolleyType);

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

      {/* Trolley Type Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Trolley Type
          </CardTitle>
          <CardDescription>
            Select the type of trolley used for this order
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={trolleyInfo.trolleyType}
            onValueChange={handleTrolleyTypeChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select trolley type" />
            </SelectTrigger>
            <SelectContent>
              {TROLLEY_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  <div className="flex flex-col">
                    <span>{type.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {type.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedType && (
            <p className="text-sm text-muted-foreground mt-2">
              {selectedType.description}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Trolley Count */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="h-5 w-5" />
            Number of Trolleys
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleCountChange(-1)}
              disabled={trolleyInfo.count <= 0}
              className="h-12 w-12"
            >
              <Minus className="h-6 w-6" />
            </Button>
            <div className="text-center min-w-[80px]">
              <span className="text-4xl font-bold">{trolleyInfo.count}</span>
              <p className="text-sm text-muted-foreground">trolleys</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleCountChange(1)}
              className="h-12 w-12"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </div>
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
              onClick={() => handleShelvesChange(-1)}
              disabled={(trolleyInfo.shelves || 0) <= 0}
              className="h-10 w-10"
            >
              <Minus className="h-5 w-5" />
            </Button>
            <div className="text-center min-w-[60px]">
              <span className="text-3xl font-bold">{trolleyInfo.shelves || 0}</span>
              <p className="text-xs text-muted-foreground">shelves</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleShelvesChange(1)}
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
      <Card className={cn(trolleyInfo.count > 0 && 'bg-green-50 border-green-200')}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {trolleyInfo.count} × {selectedType?.label || 'Trolley'}
              </p>
              {(trolleyInfo.shelves || 0) > 0 && (
                <p className="text-sm text-muted-foreground">
                  {trolleyInfo.shelves} shelves
                </p>
              )}
            </div>
            {trolleyInfo.count > 0 && (
              <Badge className="bg-green-600">Ready</Badge>
            )}
          </div>
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



