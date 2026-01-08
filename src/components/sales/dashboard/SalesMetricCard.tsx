'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Euro,
  Calculator,
  ShoppingCart,
  Package,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type IconName = 'trending-up' | 'euro' | 'calculator' | 'shopping-cart' | 'package' | 'clock' | 'alert-circle';

const iconMap: Record<IconName, React.ComponentType<{ className?: string }>> = {
  'trending-up': TrendingUp,
  'euro': Euro,
  'calculator': Calculator,
  'shopping-cart': ShoppingCart,
  'package': Package,
  'clock': Clock,
  'alert-circle': AlertCircle,
};

interface SalesMetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  changeType?: 'percentage' | 'absolute';
  format?: 'currency' | 'number';
  icon?: IconName;
  className?: string;
}

export function SalesMetricCard({
  title,
  value,
  change,
  changeLabel,
  changeType = 'percentage',
  format = 'number',
  icon,
  className,
}: SalesMetricCardProps) {
  const formattedValue = typeof value === 'number'
    ? format === 'currency'
      ? `€${value.toLocaleString()}`
      : value.toLocaleString()
    : value;

  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change === undefined || change === 0;

  const changeDisplay = change !== undefined
    ? changeType === 'percentage'
      ? `${change > 0 ? '+' : ''}${change}%`
      : `${change > 0 ? '+' : ''}${change}`
    : null;

  const Icon = icon ? iconMap[icon] : null;

  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formattedValue}</div>
        {(changeDisplay || changeLabel) && (
          <div className="flex items-center gap-1 mt-1">
            {!isNeutral && (
              <>
                {isPositive && (
                  <TrendingUp className="h-3 w-3 text-green-600" />
                )}
                {isNegative && (
                  <TrendingDown className="h-3 w-3 text-red-600" />
                )}
              </>
            )}
            {isNeutral && change !== undefined && (
              <Minus className="h-3 w-3 text-muted-foreground" />
            )}
            <span
              className={cn(
                'text-xs',
                isPositive && 'text-green-600',
                isNegative && 'text-red-600',
                isNeutral && 'text-muted-foreground'
              )}
            >
              {changeDisplay}
            </span>
            {changeLabel && (
              <span className="text-xs text-muted-foreground">
                {changeLabel}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
