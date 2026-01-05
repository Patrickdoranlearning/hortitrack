'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, 
  Truck, 
  AlertTriangle, 
  Plus, 
  MapPin,
  Calendar,
  TrendingDown,
  UserPlus,
  Clock
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { LogInteractionDialog } from './LogInteractionDialog';

export interface SalesTarget {
  customer_id: string;
  org_id: string;
  customer_name: string;
  phone: string | null;
  email: string | null;
  county: string | null;
  city: string | null;
  last_order_at: string | null;
  total_orders: number | null;
  avg_order_value: number | null;
  last_interaction_at: string | null;
  last_interaction_outcome: string | null;
  target_reason: 'fill_van' | 'churn_risk' | 'new_customer' | 'routine';
  context_note: string;
  suggested_delivery_date: string | null;
  van_current_load: number | null;
  priority_score: number;
}

interface TargetListProps {
  targets: SalesTarget[];
}

const REASON_CONFIG = {
  fill_van: {
    icon: Truck,
    badge: 'Van Opportunity',
    badgeClass: 'bg-green-100 text-green-700 border-green-200',
    cardClass: 'border-l-4 border-l-green-500',
  },
  churn_risk: {
    icon: AlertTriangle,
    badge: 'Churn Risk',
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
    cardClass: 'border-l-4 border-l-amber-500',
  },
  new_customer: {
    icon: UserPlus,
    badge: 'New Customer',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    cardClass: 'border-l-4 border-l-blue-500',
  },
  routine: {
    icon: Clock,
    badge: 'Routine',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    cardClass: '',
  },
};

export function TargetList({ targets }: TargetListProps) {
  const router = useRouter();
  const [selectedTarget, setSelectedTarget] = useState<SalesTarget | null>(null);

  const handleCreateOrder = (target: SalesTarget) => {
    const params = new URLSearchParams();
    params.set('customerId', target.customer_id);
    if (target.suggested_delivery_date) {
      params.set('date', target.suggested_delivery_date);
    }
    router.push(`/sales/orders/new?${params.toString()}`);
  };

  if (targets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-50 border border-dashed rounded-lg text-center">
        <Truck className="h-12 w-12 text-slate-400 mb-4" />
        <h3 className="text-lg font-medium text-slate-900">No Targets Available</h3>
        <p className="text-slate-500 max-w-xs mx-auto mt-2">
          No high-priority customers to target right now. Check back when there are active delivery runs.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {targets.map((target) => {
          const config = REASON_CONFIG[target.target_reason] || REASON_CONFIG.routine;
          const Icon = config.icon;

          return (
            <Card 
              key={target.customer_id} 
              className={`flex flex-col hover:shadow-md transition-shadow ${config.cardClass}`}
            >
              <CardContent className="p-5 flex-1 flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                  <div className="min-w-0 flex-1">
                    <h3 
                      className="font-semibold text-lg line-clamp-1 cursor-pointer hover:text-green-700" 
                      title={target.customer_name}
                      onClick={() => router.push(`/sales/customers?id=${target.customer_id}`)}
                    >
                      {target.customer_name}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                      {target.county && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {target.city ? `${target.city}, ${target.county}` : target.county}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className={`shrink-0 ${config.badgeClass}`}>
                    <Icon className="w-3 h-3 mr-1" />
                    {config.badge}
                  </Badge>
                </div>

                {/* The Hook - Context Note */}
                <div className="bg-slate-50 p-3 rounded-md mb-4 flex-1">
                  <p className="text-sm font-medium text-slate-700">
                    {target.context_note}
                  </p>
                  {target.target_reason === 'fill_van' && target.suggested_delivery_date && (
                    <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Delivery: {format(new Date(target.suggested_delivery_date), 'EEE, MMM d')}
                    </p>
                  )}
                </div>

                {/* Customer Stats */}
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 mb-4">
                  <div>
                    <span className="font-medium text-slate-700">
                      {target.total_orders || 0}
                    </span>{' '}
                    orders
                  </div>
                  {target.avg_order_value && (
                    <div>
                      Avg: <span className="font-medium text-slate-700">
                        €{Math.round(target.avg_order_value)}
                      </span>
                    </div>
                  )}
                  {target.last_order_at && (
                    <div className="col-span-2">
                      Last order:{' '}
                      <span className="font-medium text-slate-700">
                        {formatDistanceToNow(new Date(target.last_order_at), { addSuffix: true })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Contact Info */}
                {target.phone && (
                  <div className="text-xs text-slate-500 mb-4">
                    <a 
                      href={`tel:${target.phone}`} 
                      className="flex items-center gap-1 hover:text-green-700"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone className="h-3 w-3" />
                      {target.phone}
                    </a>
                  </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3 mt-auto">
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedTarget(target)}
                    className="gap-2"
                  >
                    <Phone className="w-4 h-4" />
                    Log Call
                  </Button>
                  <Button 
                    onClick={() => handleCreateOrder(target)}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Order
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Log Interaction Dialog */}
      {selectedTarget && (
        <LogInteractionDialog
          open={!!selectedTarget}
          onOpenChange={(open) => !open && setSelectedTarget(null)}
          customerId={selectedTarget.customer_id}
          customerName={selectedTarget.customer_name}
        />
      )}
    </>
  );
}

export default TargetList;


