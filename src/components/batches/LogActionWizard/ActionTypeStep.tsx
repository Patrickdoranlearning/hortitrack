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
  Maximize2,
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
  Maximize2,
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
          'flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all',
          'hover:border-primary hover:bg-primary/5',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
          'active:scale-95'
        )}
      >
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="text-sm font-medium text-center">{meta.label}</span>
        <span className="text-[11px] text-muted-foreground text-center line-clamp-1">
          {meta.description}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Care Actions */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Care
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {careActions.map(renderActionCard)}
        </div>
      </div>

      {/* Operation Actions */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Operations
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {operationActions.map(renderActionCard)}
        </div>
      </div>

      {/* Log Actions (Launchers) */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Log
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {logActions.map(renderActionCard)}
        </div>
      </div>
    </div>
  );
}

export default ActionTypeStep;
