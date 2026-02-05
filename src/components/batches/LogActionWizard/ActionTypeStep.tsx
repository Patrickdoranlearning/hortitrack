'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Scissors,
  Leaf,
  MapPin,
  Trash2,
  Search,
  DollarSign,
  type LucideIcon,
} from 'lucide-react';
import {
  type OperationalActionType,
  ACTION_META,
} from '@/types/batch-actions';

// ============================================================================
// Icon mapping
// ============================================================================

const ICON_MAP: Record<string, LucideIcon> = {
  Scissors,
  Leaf,
  MapPin,
  Trash2,
  Search,
  DollarSign,
};

// ============================================================================
// Types
// ============================================================================

type ActionTypeStepProps = {
  onSelect: (action: OperationalActionType) => void;
};

// ============================================================================
// Component
// ============================================================================

export function ActionTypeStep({ onSelect }: ActionTypeStepProps) {
  // Group actions by category
  const careActions = (Object.keys(ACTION_META) as OperationalActionType[]).filter(
    (key) => ACTION_META[key].category === 'care'
  );
  const operationActions = (Object.keys(ACTION_META) as OperationalActionType[]).filter(
    (key) => ACTION_META[key].category === 'operation'
  );
  const logActions = (Object.keys(ACTION_META) as OperationalActionType[]).filter(
    (key) => ACTION_META[key].category === 'log'
  );

  const renderActionCard = (action: OperationalActionType) => {
    const meta = ACTION_META[action];
    const Icon = ICON_MAP[meta.icon] || Leaf;

    return (
      <button
        key={action}
        type="button"
        onClick={() => onSelect(action)}
        className={cn(
          'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all',
          'hover:border-primary hover:bg-primary/5',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
          'active:scale-95'
        )}
      >
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <span className="text-sm font-medium text-center">{meta.label}</span>
        <span className="text-xs text-muted-foreground text-center line-clamp-2">
          {meta.description}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Care Actions */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Care
        </h4>
        <div className="grid grid-cols-2 gap-3">
          {careActions.map(renderActionCard)}
        </div>
      </div>

      {/* Operation Actions */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Operations
        </h4>
        <div className="grid grid-cols-2 gap-3">
          {operationActions.map(renderActionCard)}
        </div>
      </div>

      {/* Log Actions (Launchers) */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Log
        </h4>
        <div className="grid grid-cols-2 gap-3">
          {logActions.map(renderActionCard)}
        </div>
      </div>
    </div>
  );
}

export default ActionTypeStep;
