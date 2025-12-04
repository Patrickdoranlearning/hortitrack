'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ActiveDeliveryRunSummary } from '@/lib/dispatch/types';
import { format } from 'date-fns';
import { Truck, Package, CheckCircle, Clock } from 'lucide-react';
import {
  DELIVERY_RUN_STATUS_LABELS,
  DELIVERY_RUN_STATUS_COLORS,
} from '@/server/dispatch/status';

interface DeliveryRunCardProps {
  run: ActiveDeliveryRunSummary;
  onClick?: () => void;
}

export default function DeliveryRunCard({ run, onClick }: DeliveryRunCardProps) {
  const completionRate =
    run.totalDeliveries > 0
      ? Math.round((run.completedDeliveries / run.totalDeliveries) * 100)
      : 0;

  return (
    <Card
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg font-semibold">{run.runNumber}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {format(new Date(run.runDate), 'PPP')}
            </p>
          </div>
          <Badge variant={DELIVERY_RUN_STATUS_COLORS[run.status]}>
            {DELIVERY_RUN_STATUS_LABELS[run.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Driver & Vehicle Info */}
        <div className="flex items-center gap-2 text-sm">
          <Truck className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {run.driverName || 'No driver assigned'}
            {run.vehicleRegistration && ` • ${run.vehicleRegistration}`}
          </span>
        </div>

        {/* Delivery Stats */}
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="flex items-center gap-1">
            <Package className="h-4 w-4 text-blue-500" />
            <span className="font-medium">{run.totalDeliveries}</span>
            <span className="text-muted-foreground text-xs">total</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="font-medium">{run.completedDeliveries}</span>
            <span className="text-muted-foreground text-xs">done</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-orange-500" />
            <span className="font-medium">{run.pendingDeliveries}</span>
            <span className="text-muted-foreground text-xs">pending</span>
          </div>
        </div>

        {/* Progress Bar */}
        {run.totalDeliveries > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{completionRate}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
        )}

        {/* Trolley Info */}
        {run.trolleysLoaded > 0 && (
          <div className="flex items-center justify-between text-sm pt-2 border-t">
            <span className="text-muted-foreground">Trolleys:</span>
            <div className="flex gap-2">
              <span>{run.trolleysLoaded} loaded</span>
              {run.trolleysOutstanding > 0 && (
                <span className="text-orange-600 font-medium">
                  {run.trolleysOutstanding} outstanding
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
