'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Camera,
  ChevronLeft,
  Check,
  Loader2,
  X,
  Upload,
  Package,
} from 'lucide-react';
import type { ScannedBatch } from './ScanStep';
import type { ProductionStatusOption } from './SaleabilityWizard';

export type StatusPhotoData = {
  statusId: string;
  statusCode: string;
  statusLabel: string;
  saleableQuantity: number | null;
  photoFile: File | null;
  photoPreview: string | null;
};

type StatusPhotoStepProps = {
  batch: ScannedBatch;
  statusOptions: ProductionStatusOption[];
  onComplete: (data: StatusPhotoData) => void;
  onBack: () => void;
  isSaving: boolean;
};

const BEHAVIOR_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  growing: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Growing' },
  available: { bg: 'bg-green-100', text: 'text-green-700', label: 'Available' },
  archived: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Archived' },
};

function getBehaviorStyle(behavior: string | null) {
  return BEHAVIOR_STYLES[behavior ?? ''] ?? { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Unknown' };
}

export function StatusPhotoStep({
  batch,
  statusOptions,
  onComplete,
  onBack,
  isSaving,
}: StatusPhotoStepProps) {
  // Find the current status option
  const currentStatusOption = statusOptions.find((s) => s.id === batch.statusId);

  // Default to first available status or current status
  const defaultStatusId = statusOptions.find((s) => s.behavior === 'available')?.id
    ?? currentStatusOption?.id
    ?? statusOptions[0]?.id
    ?? '';

  const [selectedStatusId, setSelectedStatusId] = useState(defaultStatusId);
  const [saleableQuantity, setSaleableQuantity] = useState<number | null>(
    batch.saleableQuantity ?? batch.quantity
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(batch.salesPhotoUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalQuantity = batch.quantity ?? 0;

  // Group status options by behavior
  const statusesByBehavior = statusOptions.reduce<Record<string, ProductionStatusOption[]>>(
    (acc, opt) => {
      const behavior = opt.behavior ?? 'growing';
      if (!acc[behavior]) acc[behavior] = [];
      acc[behavior].push(opt);
      return acc;
    },
    { available: [], growing: [], archived: [] }
  );

  const selectedStatus = statusOptions.find((s) => s.id === selectedStatusId);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleRemovePhoto = useCallback(() => {
    setPhotoFile(null);
    setPhotoPreview(batch.salesPhotoUrl); // Revert to original
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [batch.salesPhotoUrl]);

  const handleSubmit = () => {
    if (!selectedStatus) return;

    onComplete({
      statusId: selectedStatus.id,
      statusCode: selectedStatus.systemCode,
      statusLabel: selectedStatus.displayLabel,
      saleableQuantity,
      photoFile,
      photoPreview,
    });
  };

  const originalSaleableQty = batch.saleableQuantity ?? batch.quantity;
  const hasChanges =
    selectedStatusId !== batch.statusId ||
    photoFile !== null ||
    saleableQuantity !== originalSaleableQty;

  return (
    <div className="space-y-6">
      {/* Status Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Check className="h-5 w-5" />
            Set Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Status */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <Label className="text-xs text-muted-foreground">Current Status</Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-medium">{batch.status ?? 'Unknown'}</span>
                {batch.behavior && (
                  <Badge className={`${getBehaviorStyle(batch.behavior).bg} ${getBehaviorStyle(batch.behavior).text} text-xs`}>
                    {getBehaviorStyle(batch.behavior).label}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* New Status Selection */}
          <div className="space-y-2">
            <Label>New Status</Label>
            <Select value={selectedStatusId} onValueChange={setSelectedStatusId}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusesByBehavior).map(
                  ([behavior, statuses]) =>
                    statuses.length > 0 && (
                      <div key={behavior}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                          {getBehaviorStyle(behavior).label}
                        </div>
                        {statuses.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            <div className="flex items-center gap-2">
                              {s.displayLabel}
                              {s.id === batch.statusId && (
                                <span className="text-xs text-muted-foreground">(current)</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </div>
                    )
                )}
              </SelectContent>
            </Select>
            {selectedStatus && selectedStatus.id !== batch.statusId && (
              <p className="text-sm text-muted-foreground">
                Will change from{' '}
                <span className="font-medium">{batch.status}</span> to{' '}
                <span className="font-medium text-primary">{selectedStatus.displayLabel}</span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Saleable Quantity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Saleable Quantity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            How many units are ready for sale? The rest may still be growing.
          </p>

          {/* Quantity display and input */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Slider
                value={[saleableQuantity ?? 0]}
                onValueChange={([val]) => setSaleableQuantity(val)}
                max={totalQuantity}
                min={0}
                step={1}
                className="w-full"
              />
            </div>
            <div className="w-24">
              <Input
                type="number"
                value={saleableQuantity ?? 0}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 0 && val <= totalQuantity) {
                    setSaleableQuantity(val);
                  }
                }}
                min={0}
                max={totalQuantity}
                className="text-center font-medium"
              />
            </div>
          </div>

          {/* Summary */}
          <div className="flex items-center justify-between text-sm p-3 bg-muted/50 rounded-lg">
            <div>
              <span className="text-muted-foreground">Total in batch:</span>
              <span className="font-medium ml-2">{totalQuantity.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Saleable:</span>
              <span className="font-medium text-green-600 ml-2">
                {(saleableQuantity ?? 0).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Not ready:</span>
              <span className="font-medium text-orange-600 ml-2">
                {(totalQuantity - (saleableQuantity ?? 0)).toLocaleString()}
              </span>
            </div>
          </div>

          {saleableQuantity !== originalSaleableQty && (
            <p className="text-sm text-muted-foreground">
              Changing saleable quantity from{' '}
              <span className="font-medium">{(originalSaleableQty ?? 0).toLocaleString()}</span> to{' '}
              <span className="font-medium text-primary">{(saleableQuantity ?? 0).toLocaleString()}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Photo Upload */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Sales Photo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Photo Preview / Upload Area */}
          <div className="relative">
            {photoPreview ? (
              <div className="relative rounded-lg overflow-hidden border">
                <img
                  src={photoPreview}
                  alt="Batch preview"
                  className="w-full aspect-video object-cover"
                />
                <div className="absolute top-2 right-2 flex gap-2">
                  {photoFile && (
                    <Badge variant="secondary" className="bg-white/90">
                      New photo
                    </Badge>
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8 bg-white/90"
                    onClick={handleRemovePhoto}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="absolute bottom-2 right-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Replace Photo
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-video rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-primary"
              >
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <Upload className="h-8 w-8" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Add Sales Photo</p>
                  <p className="text-sm">Tap to take a photo or upload from gallery</p>
                </div>
              </button>
            )}
          </div>

          {/* Hidden file input - allows both camera and gallery */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Grower Photo (if exists) */}
          {batch.growerPhotoUrl && (
            <div className="pt-2 border-t">
              <Label className="text-xs text-muted-foreground mb-2 block">
                Grower Photo (for reference)
              </Label>
              <img
                src={batch.growerPhotoUrl}
                alt="Grower reference"
                className="w-32 h-24 object-cover rounded-lg border"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4">
        <Button type="button" variant="ghost" onClick={onBack} disabled={isSaving}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving || !hasChanges}
          className="min-w-[140px]"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {!hasChanges && (
        <p className="text-center text-sm text-muted-foreground">
          Select a different status or add a photo to enable saving
        </p>
      )}
    </div>
  );
}
