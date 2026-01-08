'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CustomerTrolleySummary } from '@/lib/dispatch/types';
import { format } from 'date-fns';
import { AlertCircle } from 'lucide-react';

interface TrolleyBalanceCardProps {
  balance: CustomerTrolleySummary;
  onClick?: () => void;
}

export default function TrolleyBalanceCard({ balance, onClick }: TrolleyBalanceCardProps) {
  const isOverdue = balance.daysOutstanding !== undefined && balance.daysOutstanding > 14;

  return (
    <Card
      className={`hover:shadow-md transition-shadow cursor-pointer ${
        isOverdue ? 'border-l-4 border-l-orange-500' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="font-semibold text-base">{balance.customerName}</div>
            {balance.lastDeliveryDate && (
              <div className="text-xs text-muted-foreground mt-1">
                Last delivery: {format(new Date(balance.lastDeliveryDate), 'PP')}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-orange-600">
              {balance.trolleysOutstanding}
            </div>
            <div className="text-xs text-muted-foreground">trolleys out</div>
          </div>
        </div>

        {balance.daysOutstanding !== undefined && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <span className="text-sm text-muted-foreground">Days outstanding:</span>
            <div className="flex items-center gap-2">
              {isOverdue && <AlertCircle className="h-4 w-4 text-orange-500" />}
              <Badge variant={isOverdue ? 'destructive' : 'secondary'}>
                {balance.daysOutstanding} days
              </Badge>
            </div>
          </div>
        )}

        {balance.lastReturnDate && (
          <div className="text-xs text-muted-foreground mt-2">
            Last return: {format(new Date(balance.lastReturnDate), 'PP')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
