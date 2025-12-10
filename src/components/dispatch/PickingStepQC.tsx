'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Flag,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePickingWizardStore } from '@/stores/use-picking-wizard-store';

const QC_ITEMS = [
  {
    key: 'quantitiesCorrect' as const,
    label: 'Quantities Correct',
    description: 'All item quantities match the order',
  },
  {
    key: 'varietiesCorrect' as const,
    label: 'Varieties Correct',
    description: 'All plant varieties are correct',
  },
  {
    key: 'qualityAcceptable' as const,
    label: 'Quality Acceptable',
    description: 'Plants meet quality standards',
  },
  {
    key: 'labelsAttached' as const,
    label: 'Labels Attached',
    description: 'All price/plant labels are attached',
  },
];

export default function PickingStepQC() {
  const {
    items,
    qcChecklist,
    setQCChecklist,
    qcNotes,
    setQCNotes,
    flaggedItems,
    toggleFlaggedItem,
    nextStep,
    prevStep,
    canProceed,
  } = usePickingWizardStore();

  const [showFailDialog, setShowFailDialog] = useState(false);

  const allChecked = Object.values(qcChecklist).every(Boolean);
  const hasFlags = flaggedItems.length > 0;
  const shortItems = items.filter((item) => item.status === 'short');
  const substitutedItems = items.filter((item) => item.status === 'substituted');

  const handleChecklistChange = (key: keyof typeof qcChecklist, checked: boolean) => {
    setQCChecklist({ [key]: checked });
  };

  const handleFlagItem = (itemId: string) => {
    toggleFlaggedItem(itemId);
  };

  const handleContinue = () => {
    if (hasFlags || !allChecked) {
      setShowFailDialog(true);
    } else {
      nextStep();
    }
  };

  const handleForcePass = () => {
    setShowFailDialog(false);
    nextStep();
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Warnings */}
      {(shortItems.length > 0 || substitutedItems.length > 0) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                {shortItems.length > 0 && (
                  <p className="text-sm text-amber-800">
                    <strong>{shortItems.length}</strong> item(s) marked as short
                  </p>
                )}
                {substitutedItems.length > 0 && (
                  <p className="text-sm text-amber-800">
                    <strong>{substitutedItems.length}</strong> item(s) were substituted
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* QC Checklist */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            QC Checklist
          </CardTitle>
          <CardDescription>
            Verify each item before approving the order
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {QC_ITEMS.map((item) => (
            <div
              key={item.key}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                qcChecklist[item.key]
                  ? 'bg-green-50 border-green-200'
                  : 'bg-muted/50'
              )}
            >
              <Checkbox
                id={item.key}
                checked={qcChecklist[item.key]}
                onCheckedChange={(checked) =>
                  handleChecklistChange(item.key, checked === true)
                }
                className="mt-0.5"
              />
              <div className="flex-1">
                <Label
                  htmlFor={item.key}
                  className={cn(
                    'font-medium cursor-pointer',
                    qcChecklist[item.key] && 'text-green-700'
                  )}
                >
                  {item.label}
                </Label>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              {qcChecklist[item.key] && (
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Items Review */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Verify Items</CardTitle>
          <CardDescription>
            Flag any items that need attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[300px] overflow-auto">
            {items.map((item) => {
              const isFlagged = flaggedItems.includes(item.id);
              const isShort = item.status === 'short';
              const isSubstituted = item.status === 'substituted';

              return (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg border',
                    isFlagged && 'bg-red-50 border-red-200',
                    isShort && !isFlagged && 'bg-amber-50 border-amber-200',
                    isSubstituted && !isFlagged && 'bg-blue-50 border-blue-200'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate text-sm">
                        {item.productName || item.plantVariety}
                      </p>
                      {isShort && (
                        <Badge variant="destructive" className="text-xs">
                          Short
                        </Badge>
                      )}
                      {isSubstituted && (
                        <Badge variant="secondary" className="text-xs">
                          Substituted
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.size} • {item.pickedQty}/{item.targetQty} picked
                    </p>
                    {isSubstituted && item.pickedBatchNumber && (
                      <p className="text-xs text-blue-600">
                        New batch: {item.pickedBatchNumber}
                      </p>
                    )}
                  </div>
                  <Button
                    variant={isFlagged ? 'destructive' : 'ghost'}
                    size="sm"
                    onClick={() => handleFlagItem(item.id)}
                  >
                    {isFlagged ? (
                      <X className="h-4 w-4" />
                    ) : (
                      <Flag className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>

          {flaggedItems.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {flaggedItems.length} item(s) flagged - order cannot proceed
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">QC Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={qcNotes}
            onChange={(e) => setQCNotes(e.target.value)}
            placeholder="Add any notes about this order..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Status Summary */}
      <Card className={cn(allChecked && !hasFlags ? 'bg-green-50 border-green-200' : '')}>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            {allChecked && !hasFlags ? (
              <>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <p className="font-medium text-green-700">QC Passed</p>
                  <p className="text-sm text-green-600">Ready to proceed</p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="font-medium text-amber-700">QC Incomplete</p>
                  <p className="text-sm text-amber-600">
                    {!allChecked && 'Complete the checklist'}
                    {!allChecked && hasFlags && ' and '}
                    {hasFlags && 'resolve flagged items'}
                  </p>
                </div>
              </>
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
            onClick={handleContinue}
            disabled={hasFlags}
            className={cn(
              'flex-1',
              allChecked && !hasFlags && 'bg-green-600 hover:bg-green-700'
            )}
          >
            Continue
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Force Pass Dialog */}
      <AlertDialog open={showFailDialog} onOpenChange={setShowFailDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>QC Incomplete</AlertDialogTitle>
            <AlertDialogDescription>
              The QC checklist is not fully completed. Do you want to proceed anyway?
              This will be noted in the order history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForcePass}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Proceed Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}



