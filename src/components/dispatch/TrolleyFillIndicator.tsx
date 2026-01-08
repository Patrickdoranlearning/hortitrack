'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TROLLEY_CONSTANTS } from '@/lib/dispatch/trolley-calculation';

// ================================================
// TYPES
// ================================================

export type TrolleyCalculationInput = {
  sizeId: string;
  family?: string | null;
  quantity: number;
};

export type TrolleyCalculationResponse = {
  ok: boolean;
  totalTrolleys: number;
  totalHolesUsed: number;
  currentTrolleyHolesUsed: number;
  holesRemaining: number;
  suggestions?: Array<{
    sizeName: string;
    sizeId: string;
    shelvesCanFit: number;
    unitsCanFit: number;
  }>;
};

export interface TrolleyFillIndicatorProps {
  /** Cart lines for calculation */
  lines: TrolleyCalculationInput[];
  /** Show suggestions for remaining capacity */
  showSuggestions?: boolean;
  /** Compact mode for inline display */
  compact?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when calculation completes */
  onCalculated?: (result: TrolleyCalculationResponse) => void;
}

// ================================================
// COMPONENT
// ================================================

export default function TrolleyFillIndicator({
  lines,
  showSuggestions = true,
  compact = false,
  className,
  onCalculated,
}: TrolleyFillIndicatorProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrolleyCalculationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Debounced calculation
  const calculateTrolleys = useCallback(async () => {
    // Filter out lines with 0 quantity
    const validLines = lines.filter((l) => l.quantity > 0);

    if (validLines.length === 0) {
      const emptyResult: TrolleyCalculationResponse = {
        ok: true,
        totalTrolleys: 0,
        totalHolesUsed: 0,
        currentTrolleyHolesUsed: 0,
        holesRemaining: TROLLEY_CONSTANTS.STANDARD_HOLES,
        suggestions: [],
      };
      setResult(emptyResult);
      onCalculated?.(emptyResult);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/dispatch/trolley-calculation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: validLines,
          includeSuggestions: showSuggestions,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        setResult(data);
        onCalculated?.(data);
      } else {
        setError(data.error || 'Calculation failed');
      }
    } catch (err) {
      console.error('Trolley calculation error:', err);
      setError('Failed to calculate trolleys');
    } finally {
      setLoading(false);
    }
  }, [lines, showSuggestions, onCalculated]);

  // Recalculate when lines change (with debounce)
  useEffect(() => {
    const timer = setTimeout(calculateTrolleys, 300);
    return () => clearTimeout(timer);
  }, [calculateTrolleys]);

  // Compact mode - inline display
  if (compact) {
    if (loading) {
      return (
        <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Calculating...</span>
        </div>
      );
    }

    if (error || !result) {
      return null;
    }

    // Calculate decimal trolley count
    const decimalTrolleys = result.totalHolesUsed / TROLLEY_CONSTANTS.STANDARD_HOLES;
    const displayValue = decimalTrolleys > 0 ? decimalTrolleys.toFixed(1) : '0';
    const fillPct = Math.round((result.currentTrolleyHolesUsed / TROLLEY_CONSTANTS.STANDARD_HOLES) * 100);

    return (
      <div className={cn('flex items-center gap-3 text-sm', className)}>
        <div className="flex items-center gap-1.5">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {displayValue} {parseFloat(displayValue) === 1 ? 'trolley' : 'trolleys'}
          </span>
        </div>
        {result.totalHolesUsed > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  fillPct >= 90 ? 'bg-green-500' : fillPct >= 50 ? 'bg-blue-500' : 'bg-gray-400'
                )}
                style={{ width: `${fillPct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{fillPct}%</span>
          </div>
        )}
      </div>
    );
  }

  // Full card display
  return (
    <Card className={cn('', className)}>
      <CardContent className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Calculating trolleys...</span>
          </div>
        ) : error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : result ? (
          (() => {
            // Calculate decimal trolley count (e.g., 1.5 trolleys)
            const decimalTrolleys = result.totalHolesUsed / TROLLEY_CONSTANTS.STANDARD_HOLES;
            const displayValue = decimalTrolleys > 0 ? decimalTrolleys.toFixed(1) : '0';
            const currentFillPercent = Math.round((result.currentTrolleyHolesUsed / TROLLEY_CONSTANTS.STANDARD_HOLES) * 100);
            const isPartiallyFilled = decimalTrolleys > 0 && decimalTrolleys % 1 !== 0;

            return (
              <div className="space-y-3">
                {/* Header with decimal trolley count */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">Trolleys</span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold">{displayValue}</span>
                  </div>
                </div>

                {/* Fill progress bar - show when we have any holes used */}
                {result.totalHolesUsed > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Current trolley</span>
                      <span className="font-medium">{currentFillPercent}% full</span>
                    </div>
                    <Progress value={currentFillPercent} className="h-2" />
                    {isPartiallyFilled && (
                      <p className="text-xs text-muted-foreground">
                        Add more to fill {result.totalTrolleys} {result.totalTrolleys === 1 ? 'trolley' : 'trolleys'}
                      </p>
                    )}
                  </div>
                )}

                {/* Suggestions for what else fits */}
                {showSuggestions &&
                  result.suggestions &&
                  result.suggestions.length > 0 &&
                  result.holesRemaining > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">
                        Space remaining for:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.suggestions.slice(0, 3).map((suggestion) => (
                          <div
                            key={suggestion.sizeId}
                            className="text-xs bg-muted px-2 py-1 rounded"
                          >
                            {suggestion.shelvesCanFit} shelf
                            {suggestion.shelvesCanFit > 1 ? 's' : ''} of {suggestion.sizeName} (
                            {suggestion.unitsCanFit} units)
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            );
          })()
        ) : (
          <div className="text-sm text-muted-foreground text-center py-2">
            Add items to see trolley estimate
          </div>
        )}
      </CardContent>
    </Card>
  );
}
