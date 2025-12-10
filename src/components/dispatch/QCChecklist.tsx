'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ClipboardCheck, Hash, Leaf, Sparkles, Ruler, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QCChecklistState {
  qtyCorrect: boolean;
  varietyCorrect: boolean;
  qualityAcceptable: boolean;
  sizeCorrect: boolean;
  labellingOk: boolean;
}

interface QCChecklistProps {
  checklist: QCChecklistState;
  onChange: (key: keyof QCChecklistState, value: boolean) => void;
  disabled?: boolean;
}

const CHECKLIST_ITEMS: Array<{
  key: keyof QCChecklistState;
  label: string;
  description: string;
  icon: typeof Hash;
}> = [
  {
    key: 'qtyCorrect',
    label: 'Quantity Correct',
    description: 'All quantities match the pick list',
    icon: Hash,
  },
  {
    key: 'varietyCorrect',
    label: 'Correct Variety/Product',
    description: 'All plants are the correct variety',
    icon: Leaf,
  },
  {
    key: 'qualityAcceptable',
    label: 'Plant Quality Acceptable',
    description: 'No damage, pests, or disease visible',
    icon: Sparkles,
  },
  {
    key: 'sizeCorrect',
    label: 'Correct Pot Size',
    description: 'All pot sizes match the order',
    icon: Ruler,
  },
  {
    key: 'labellingOk',
    label: 'Plants Properly Labelled',
    description: 'All plants have correct labels',
    icon: Tag,
  },
];

export default function QCChecklist({ checklist, onChange, disabled }: QCChecklistProps) {
  const checkedCount = Object.values(checklist).filter(Boolean).length;
  const allChecked = checkedCount === CHECKLIST_ITEMS.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" />
          QC Checklist
        </CardTitle>
        <CardDescription>
          Verify each item before approving the order
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress indicator */}
        <div className="flex items-center justify-between text-sm mb-4">
          <span className="text-muted-foreground">Progress</span>
          <span className={cn(
            'font-medium',
            allChecked ? 'text-green-600' : 'text-muted-foreground'
          )}>
            {checkedCount} / {CHECKLIST_ITEMS.length} completed
          </span>
        </div>

        {/* Checklist items */}
        <div className="space-y-3">
          {CHECKLIST_ITEMS.map((item) => {
            const Icon = item.icon;
            const isChecked = checklist[item.key];

            return (
              <div
                key={item.key}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                  isChecked
                    ? 'bg-green-50 border-green-200'
                    : 'bg-background hover:bg-muted/50'
                )}
              >
                <Checkbox
                  id={item.key}
                  checked={isChecked}
                  onCheckedChange={(checked) => onChange(item.key, checked as boolean)}
                  disabled={disabled}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <Label
                    htmlFor={item.key}
                    className={cn(
                      'flex items-center gap-2 font-medium cursor-pointer',
                      isChecked && 'text-green-700'
                    )}
                  >
                    <Icon className={cn(
                      'h-4 w-4',
                      isChecked ? 'text-green-600' : 'text-muted-foreground'
                    )} />
                    {item.label}
                  </Label>
                  <p className={cn(
                    'text-sm mt-0.5',
                    isChecked ? 'text-green-600' : 'text-muted-foreground'
                  )}>
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* All checked indicator */}
        {allChecked && (
          <div className="flex items-center justify-center gap-2 p-3 bg-green-100 rounded-lg text-green-700">
            <ClipboardCheck className="h-5 w-5" />
            <span className="font-medium">All checks completed!</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}



