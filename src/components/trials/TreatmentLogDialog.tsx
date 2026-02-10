'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/lib/toast';
import { Loader2, Syringe } from 'lucide-react';
import { logTreatment } from '@/app/actions/trials';
import type { TrialGroupWithSubjects } from '@/types/trial';

interface TreatmentLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: TrialGroupWithSubjects[];
  onSuccess: () => void;
}

const TREATMENT_TYPES = [
  { value: 'ipm', label: 'IPM Product' },
  { value: 'material', label: 'Material/Fertilizer' },
  { value: 'custom', label: 'Custom Treatment' },
];

const APPLICATION_METHODS = [
  'Foliar spray',
  'Drench',
  'Granular',
  'Injection',
  'Other',
];

export function TreatmentLogDialog({
  open,
  onOpenChange,
  groups,
  onSuccess,
}: TreatmentLogDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [treatmentType, setTreatmentType] = useState<'ipm' | 'material' | 'custom'>('custom');
  const [treatmentDate, setTreatmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [rateUnit, setRateUnit] = useState('ml/L');
  const [method, setMethod] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setSelectedGroupId('');
    setTreatmentType('custom');
    setTreatmentDate(new Date().toISOString().split('T')[0]);
    setName('');
    setRate('');
    setRateUnit('ml/L');
    setMethod('');
    setNotes('');
  };

  const handleSubmit = async () => {
    if (!selectedGroupId || !name.trim()) {
      toast.error('Please select a group and enter a treatment name');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await logTreatment({
        groupId: selectedGroupId,
        treatmentType,
        treatmentDate,
        name: name.trim(),
        rate: rate ? parseFloat(rate) : undefined,
        rateUnit: rateUnit || undefined,
        method: method || undefined,
        notes: notes.trim() || undefined,
      });

      if (result.success) {
        toast.success('Treatment logged successfully');
        resetForm();
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(result.error || 'Failed to log treatment');
      }
    } catch (error) {
      toast.error('Failed to log treatment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Syringe className="h-5 w-5" />
            Log Treatment
          </DialogTitle>
          <DialogDescription>
            Record a treatment application for a trial group
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Trial Group *</Label>
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger>
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id!}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: group.labelColor || '#6B7280' }}
                      />
                      {group.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Treatment Type</Label>
              <Select
                value={treatmentType}
                onValueChange={(v) => setTreatmentType(v as 'ipm' | 'material' | 'custom')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TREATMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={treatmentDate}
                onChange={(e) => setTreatmentDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Treatment Name *</Label>
            <Input
              placeholder="e.g., Fertilizer A, Neem Oil, Extra watering"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Rate (optional)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g., 5"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="flex-1"
                />
                <Select value={rateUnit} onValueChange={setRateUnit}>
                  <SelectTrigger className="w-[90px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ml/L">ml/L</SelectItem>
                    <SelectItem value="g/L">g/L</SelectItem>
                    <SelectItem value="ml">ml</SelectItem>
                    <SelectItem value="g">g</SelectItem>
                    <SelectItem value="%">%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Application Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {APPLICATION_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Any additional notes about this treatment..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {selectedGroup && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="text-muted-foreground">
                This treatment will be recorded for the{' '}
                <span className="font-medium text-foreground">{selectedGroup.name}</span> group (
                {selectedGroup.subjects?.filter((s) => s.isActive).length} active subjects)
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Logging...
              </>
            ) : (
              'Log Treatment'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
