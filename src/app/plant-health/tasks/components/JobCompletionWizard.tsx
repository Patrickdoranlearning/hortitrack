'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  CheckCircle2,
  Beaker,
  FlaskConical,
  Cloud,
  Droplets,
  PenLine,
} from 'lucide-react';
import { toast } from 'sonner';
import type { IpmJob } from '@/types/ipm-jobs';
import { completeJob } from '@/app/actions/ipm-tasks';
import { getAvailableBottles, type IpmBottle } from '@/app/actions/ipm-stock';
import { useAttributeOptions } from '@/hooks/useAttributeOptions';
import { cn } from '@/lib/utils';

type Props = {
  job: IpmJob | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
};

export function JobCompletionWizard({ job, open, onOpenChange, onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Application details
  const [weatherConditions, setWeatherConditions] = useState('');
  const [sprayerUsed, setSprayerUsed] = useState('');
  const [totalVolumeMl, setTotalVolumeMl] = useState('');
  const [selectedBottle, setSelectedBottle] = useState('');
  const [quantityUsed, setQuantityUsed] = useState('');
  const [bottles, setBottles] = useState<IpmBottle[]>([]);

  // Step 2: Sign off
  const [signedBy, setSignedBy] = useState('');
  const [notes, setNotes] = useState('');

  const { options: sprayerOptions } = useAttributeOptions('sprayer_used');

  // Load bottles when opened
  useEffect(() => {
    async function loadBottles() {
      if (job?.product.id) {
        const result = await getAvailableBottles(job.product.id);
        if (result.success && result.data) {
          setBottles(result.data);
        }
      }
    }
    if (open && job) {
      loadBottles();
    }
  }, [open, job]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setStep(1);
      setWeatherConditions('');
      setSprayerUsed('');
      setTotalVolumeMl('');
      setSelectedBottle('');
      setQuantityUsed('');
      setSignedBy('');
      setNotes('');
    }
  }, [open]);

  const handleComplete = async () => {
    if (!job) return;

    setLoading(true);
    const result = await completeJob({
      jobId: job.id,
      weatherConditions: weatherConditions || undefined,
      sprayerUsed: sprayerUsed || undefined,
      totalVolumeMl: totalVolumeMl ? parseInt(totalVolumeMl) : undefined,
      bottleId: selectedBottle && selectedBottle !== 'none' ? selectedBottle : undefined,
      quantityUsedMl: quantityUsed ? parseInt(quantityUsed) : undefined,
      signedBy,
      notes: notes || undefined,
    });

    if (result.success) {
      toast.success('Job completed & logged to batch history!');
      onComplete();
    } else {
      toast.error(result.error || 'Failed to complete job');
    }
    setLoading(false);
  };

  if (!job) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 1 ? (
              <>
                <Droplets className="h-5 w-5 text-primary" />
                Step 1: Application Details
              </>
            ) : (
              <>
                <PenLine className="h-5 w-5 text-primary" />
                Step 2: Sign Off
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Record application conditions and equipment used'
              : 'Review and sign off on the application'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors',
                step === s
                  ? 'bg-primary text-primary-foreground'
                  : step > s
                  ? 'bg-green-600 text-white'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {step > s ? '✓' : s}
            </div>
          ))}
        </div>

        <div className="py-4 space-y-4">
          {step === 1 && (
            <>
              {/* Job summary */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  {job.product.isTankMix ? (
                    <Beaker className="h-4 w-4 text-purple-600" />
                  ) : (
                    <FlaskConical className="h-4 w-4 text-primary" />
                  )}
                  <span className="font-medium">{job.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {job.batchCount} batches across {job.locationCount} locations
                </p>
              </div>

              <div className="space-y-2">
                <Label>Weather Conditions</Label>
                <Input
                  placeholder="e.g., Dry, 15°C, Low wind"
                  value={weatherConditions}
                  onChange={(e) => setWeatherConditions(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Sprayer Used</Label>
                <Select value={sprayerUsed} onValueChange={setSprayerUsed}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sprayer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sprayerOptions
                      .filter((o) => o.isActive)
                      .map((sprayer) => (
                        <SelectItem key={sprayer.systemCode} value={sprayer.displayLabel}>
                          {sprayer.displayLabel}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Total Volume Applied (ml)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 5000"
                  value={totalVolumeMl}
                  onChange={(e) => setTotalVolumeMl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Product Bottle Used</Label>
                <Select value={selectedBottle} onValueChange={setSelectedBottle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bottle (optional)..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not tracking stock</SelectItem>
                    {bottles.map((bottle) => (
                      <SelectItem key={bottle.id} value={bottle.id}>
                        {bottle.bottleCode} - {bottle.remainingMl}ml remaining
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedBottle && selectedBottle !== 'none' && (
                <div className="space-y-2">
                  <Label>Quantity Used (ml) *</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 500"
                    value={quantityUsed}
                    onChange={(e) => setQuantityUsed(e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              {/* Summary */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <h4 className="font-medium text-sm">Application Summary</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Product:</span>
                  <span>{job.name}</span>
                  <span className="text-muted-foreground">Batches:</span>
                  <span>{job.batchCount}</span>
                  <span className="text-muted-foreground">Locations:</span>
                  <span>{job.locationCount}</span>
                  {weatherConditions && (
                    <>
                      <span className="text-muted-foreground">Weather:</span>
                      <span>{weatherConditions}</span>
                    </>
                  )}
                  {sprayerUsed && (
                    <>
                      <span className="text-muted-foreground">Sprayer:</span>
                      <span>{sprayerUsed}</span>
                    </>
                  )}
                  {totalVolumeMl && (
                    <>
                      <span className="text-muted-foreground">Total Volume:</span>
                      <span>{totalVolumeMl}ml</span>
                    </>
                  )}
                  {selectedBottle && selectedBottle !== 'none' && quantityUsed && (
                    <>
                      <span className="text-muted-foreground">Product Used:</span>
                      <span>{quantityUsed}ml</span>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Signed By *</Label>
                <Input
                  placeholder="Your name"
                  value={signedBy}
                  onChange={(e) => setSignedBy(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Additional Notes</Label>
                <Textarea
                  placeholder="Any additional observations..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          {step === 1 && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          {step < 2 ? (
            <Button onClick={() => setStep(step + 1)}>Next</Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={loading || !signedBy}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Complete & Log
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
