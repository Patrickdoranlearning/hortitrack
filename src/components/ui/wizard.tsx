'use client';

import * as React from 'react';
import { Check, Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

// ============================================================
// Types
// ============================================================

export type WizardStep<TId extends string = string> = {
  id: TId;
  label: string;
  icon: LucideIcon;
  description?: string;
};

export type WizardContextValue<TId extends string = string> = {
  currentStep: TId;
  currentStepIndex: number;
  totalSteps: number;
  progressPercent: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  goToStep: (stepId: TId) => void;
  goNext: () => void;
  goBack: () => void;
  canGoToStep: (stepId: TId) => boolean;
  isStepComplete: (stepId: TId) => boolean;
  markStepComplete: (stepId: TId) => void;
  markStepIncomplete: (stepId: TId) => void;
};

// ============================================================
// Context
// ============================================================

const WizardContext = React.createContext<WizardContextValue | null>(null);

export function useWizard<TId extends string = string>() {
  const context = React.useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context as WizardContextValue<TId>;
}

// ============================================================
// Wizard Provider Hook
// ============================================================

export function useWizardState<TId extends string>(
  steps: WizardStep<TId>[],
  initialStep?: TId
) {
  const [currentStep, setCurrentStep] = React.useState<TId>(initialStep ?? steps[0].id);
  const [completedSteps, setCompletedSteps] = React.useState<Set<TId>>(new Set());

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);
  const totalSteps = steps.length;
  const progressPercent = ((currentStepIndex + 1) / totalSteps) * 100;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  const isStepComplete = React.useCallback(
    (stepId: TId) => completedSteps.has(stepId),
    [completedSteps]
  );

  const markStepComplete = React.useCallback((stepId: TId) => {
    setCompletedSteps((prev) => new Set([...prev, stepId]));
  }, []);

  const markStepIncomplete = React.useCallback((stepId: TId) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.delete(stepId);
      return next;
    });
  }, []);

  const canGoToStep = React.useCallback(
    (stepId: TId) => {
      const targetIndex = steps.findIndex((s) => s.id === stepId);
      // Can always go back
      if (targetIndex <= currentStepIndex) return true;
      // Can go forward if all previous steps are complete
      for (let i = 0; i < targetIndex; i++) {
        if (!completedSteps.has(steps[i].id)) return false;
      }
      return true;
    },
    [steps, currentStepIndex, completedSteps]
  );

  const goToStep = React.useCallback(
    (stepId: TId) => {
      if (canGoToStep(stepId)) {
        setCurrentStep(stepId);
      }
    },
    [canGoToStep]
  );

  const goNext = React.useCallback(() => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStep(steps[currentStepIndex + 1].id);
    }
  }, [currentStepIndex, totalSteps, steps]);

  const goBack = React.useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1].id);
    }
  }, [currentStepIndex, steps]);

  const contextValue: WizardContextValue<TId> = {
    currentStep,
    currentStepIndex,
    totalSteps,
    progressPercent,
    isFirstStep,
    isLastStep,
    goToStep,
    goNext,
    goBack,
    canGoToStep,
    isStepComplete,
    markStepComplete,
    markStepIncomplete,
  };

  return contextValue;
}

// ============================================================
// Wizard Root Component
// ============================================================

type WizardRootProps<TId extends string> = {
  steps: WizardStep<TId>[];
  value: WizardContextValue<TId>;
  children: React.ReactNode;
  className?: string;
};

export function WizardRoot<TId extends string>({
  steps,
  value,
  children,
  className,
}: WizardRootProps<TId>) {
  return (
    <WizardContext.Provider value={value as WizardContextValue}>
      <div className={cn('space-y-6', className)}>{children}</div>
    </WizardContext.Provider>
  );
}

// ============================================================
// Step Indicator Component
// ============================================================

type WizardStepIndicatorProps<TId extends string> = {
  steps: WizardStep<TId>[];
  showProgress?: boolean;
  className?: string;
};

export function WizardStepIndicator<TId extends string>({
  steps,
  showProgress = true,
  className,
}: WizardStepIndicatorProps<TId>) {
  const { currentStep, currentStepIndex, progressPercent, goToStep, canGoToStep, isStepComplete } =
    useWizard<TId>();

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const completed = index < currentStepIndex || isStepComplete(step.id);
          const Icon = step.icon;
          const canNavigate = canGoToStep(step.id);

          return (
            <button
              key={step.id}
              onClick={() => canNavigate && goToStep(step.id)}
              disabled={!canNavigate}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors flex-1 justify-center',
                isActive && 'bg-primary text-primary-foreground',
                completed && !isActive && 'bg-primary/20 text-primary cursor-pointer',
                !isActive && !completed && 'bg-muted text-muted-foreground',
                !canNavigate && 'cursor-not-allowed opacity-50'
              )}
            >
              {completed && !isActive ? (
                <Check className="h-4 w-4" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              <span className={cn(
                "text-sm font-medium",
                isActive ? "inline" : "hidden md:inline"
              )}>{step.label}</span>
            </button>
          );
        })}
      </div>
      {showProgress && <Progress value={progressPercent} className="h-1" />}
    </div>
  );
}

// ============================================================
// Step Content Component
// ============================================================

type WizardStepContentProps<TId extends string> = {
  stepId: TId;
  children: React.ReactNode;
  className?: string;
};

export function WizardStepContent<TId extends string>({
  stepId,
  children,
  className,
}: WizardStepContentProps<TId>) {
  const { currentStep } = useWizard<TId>();

  if (currentStep !== stepId) return null;

  return <div className={cn('min-h-[450px]', className)}>{children}</div>;
}

// ============================================================
// Wizard Dialog Component
// ============================================================

type WizardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
};

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
};

export function WizardDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  maxWidth = '3xl',
}: WizardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          maxWidthClasses[maxWidth],
          'max-h-[90vh] overflow-hidden flex flex-col',
          className
        )}
      >
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-1 -mr-1">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Wizard Navigation Buttons
// ============================================================

type WizardNavigationProps = {
  onBack?: () => void;
  onNext?: () => void;
  onCancel?: () => void;
  onSubmit?: () => void;
  backLabel?: string;
  nextLabel?: string;
  cancelLabel?: string;
  submitLabel?: string;
  isSubmitting?: boolean;
  canGoNext?: boolean;
  showCancel?: boolean;
  className?: string;
};

export function WizardNavigation({
  onBack,
  onNext,
  onCancel,
  onSubmit,
  backLabel = 'Back',
  nextLabel = 'Next',
  cancelLabel = 'Cancel',
  submitLabel = 'Submit',
  isSubmitting = false,
  canGoNext = true,
  showCancel = false,
  className,
}: WizardNavigationProps) {
  const { isFirstStep, isLastStep, goBack, goNext } = useWizard();

  const handleBack = onBack ?? goBack;
  const handleNext = onNext ?? goNext;

  return (
    <div className={cn('flex items-center justify-between pt-4', className)}>
      <div>
        {isFirstStep && showCancel && onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            {cancelLabel}
          </Button>
        ) : !isFirstStep ? (
          <Button type="button" variant="ghost" onClick={handleBack} disabled={isSubmitting}>
            {backLabel}
          </Button>
        ) : (
          <div />
        )}
      </div>
      <div>
        {isLastStep && onSubmit ? (
          <Button type="button" onClick={onSubmit} disabled={isSubmitting || !canGoNext}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {submitLabel}...
              </>
            ) : (
              submitLabel
            )}
          </Button>
        ) : (
          <Button type="button" onClick={handleNext} disabled={!canGoNext}>
            {nextLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Loading State Component
// ============================================================

type WizardLoadingProps = {
  message?: string;
  className?: string;
};

export function WizardLoading({ message = 'Loading...', className }: WizardLoadingProps) {
  return (
    <div className={cn('flex items-center justify-center py-12', className)}>
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      {message && <span className="ml-3 text-muted-foreground">{message}</span>}
    </div>
  );
}

// ============================================================
// Error State Component
// ============================================================

type WizardErrorProps = {
  message?: string;
  onRetry?: () => void;
  className?: string;
};

export function WizardError({
  message = 'Something went wrong. Please try again.',
  onRetry,
  className,
}: WizardErrorProps) {
  return (
    <div className={cn('text-center py-12 text-muted-foreground', className)}>
      <p>{message}</p>
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

// ============================================================
// Exports
// ============================================================

export const Wizard = {
  Root: WizardRoot,
  StepIndicator: WizardStepIndicator,
  StepContent: WizardStepContent,
  Dialog: WizardDialog,
  Navigation: WizardNavigation,
  Loading: WizardLoading,
  Error: WizardError,
};
