'use client';

import { useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Package,
  Printer,
  ClipboardCheck,
  ShoppingCart,
  Rocket,
} from 'lucide-react';
import {
  usePickingWizardStore,
  type PickingStep,
} from '@/stores/use-picking-wizard-store';
import type { PickList, PickItem } from '@/server/sales/picking';

// Step components will be imported dynamically
import PickingStepStart from './PickingStepStart';
import PickingStepLabels from './PickingStepLabels';
import PickingStepPick from './PickingStepPick';
import PickingStepQC from './PickingStepQC';
import PickingStepTrolley from './PickingStepTrolley';
import PickingStepComplete from './PickingStepComplete';

interface PickingWizardProps {
  pickList: PickList;
  initialItems: PickItem[];
  onComplete?: () => void;
  onExit?: () => void;
}

const STEPS: { key: PickingStep; label: string; icon: typeof Package }[] = [
  { key: 'start', label: 'Start', icon: Rocket },
  { key: 'labels', label: 'Print', icon: Printer },
  { key: 'pick', label: 'Pick', icon: Package },
  { key: 'qc', label: 'QC', icon: ClipboardCheck },
  { key: 'trolley', label: 'Trolley', icon: ShoppingCart },
  { key: 'complete', label: 'Done', icon: CheckCircle2 },
];

export default function PickingWizard({
  pickList,
  initialItems,
  onComplete,
  onExit,
}: PickingWizardProps) {
  const {
    currentStep,
    setPickList,
    setItems,
    reset,
    getProgress,
  } = usePickingWizardStore();

  // Initialize store with data
  useEffect(() => {
    setPickList(pickList);
    setItems(initialItems);
    
    return () => {
      // Don't reset on unmount - user might be navigating back
    };
  }, [pickList, initialItems, setPickList, setItems]);

  const progress = getProgress();
  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);

  const handleExit = () => {
    if (onExit) {
      onExit();
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'start':
        return <PickingStepStart />;
      case 'labels':
        return <PickingStepLabels />;
      case 'pick':
        return <PickingStepPick />;
      case 'qc':
        return <PickingStepQC />;
      case 'trolley':
        return <PickingStepTrolley />;
      case 'complete':
        return <PickingStepComplete onComplete={onComplete} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleExit}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold truncate">
                Order #{pickList.orderNumber || pickList.orderId.slice(0, 8)}
              </h1>
              <p className="text-sm text-muted-foreground truncate">
                {pickList.customerName}
              </p>
            </div>
            <Badge variant="outline" className="shrink-0">
              {progress.picked}/{progress.total}
            </Badge>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between gap-1">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.key === currentStep;
              const isCompleted = index < currentStepIndex;
              const isPending = index > currentStepIndex;

              return (
                <div
                  key={step.key}
                  className={cn(
                    'flex flex-col items-center gap-1 flex-1',
                    isActive && 'text-primary',
                    isCompleted && 'text-green-600',
                    isPending && 'text-muted-foreground/50'
                  )}
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                      isActive && 'bg-primary text-primary-foreground',
                      isCompleted && 'bg-green-100 text-green-600',
                      isPending && 'bg-muted'
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span className="text-[10px] font-medium hidden sm:block">
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
          
          {/* Progress bar between steps */}
          <div className="mt-2">
            <Progress 
              value={(currentStepIndex / (STEPS.length - 1)) * 100} 
              className="h-1" 
            />
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}




