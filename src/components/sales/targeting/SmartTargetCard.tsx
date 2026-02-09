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
  UserPlus,
  TrendingUp,
  Route,
  Clock,
  Target,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { LogInteractionDialog } from '../dashboard/LogInteractionDialog';
import type { SmartTarget, TargetReason } from '@/lib/targeting/types';
import {
  formatDaysSinceOrder,
  formatOrderInterval,
} from '@/lib/targeting/types';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format-currency';

interface SmartTargetCardProps {
  target: SmartTarget;
  showScoreBreakdown?: boolean;
}

const REASON_CONFIG: Record<TargetReason, {
  icon: typeof Truck;
  badge: string;
  badgeClass: string;
  cardClass: string;
}> = {
  route_match: {
    icon: Truck,
    badge: 'Route Match',
    badgeClass: 'bg-green-100 text-green-700 border-green-200',
    cardClass: 'border-l-4 border-l-green-500',
  },
  nearby_route: {
    icon: Route,
    badge: 'Nearby Route',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    cardClass: 'border-l-4 border-l-emerald-500',
  },
  likely_to_order: {
    icon: TrendingUp,
    badge: 'Likely to Order',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    cardClass: 'border-l-4 border-l-blue-500',
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
    badgeClass: 'bg-sky-100 text-sky-700 border-sky-200',
    cardClass: 'border-l-4 border-l-sky-500',
  },
  routine: {
    icon: Clock,
    badge: 'Routine',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    cardClass: '',
  },
};

function ScoreBar({ score, label, color }: { score: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full', color)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-medium text-slate-700 w-8 text-right">{score}</span>
    </div>
  );
}

export function SmartTargetCard({ target, showScoreBreakdown = false }: SmartTargetCardProps) {
  const router = useRouter();
  const [showInteractionDialog, setShowInteractionDialog] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const config = REASON_CONFIG[target.target_reason] || REASON_CONFIG.routine;
  const Icon = config.icon;

  const handleCreateOrder = () => {
    const params = new URLSearchParams();
    params.set('customerId', target.customer_id);
    if (target.suggested_delivery_date) {
      params.set('date', target.suggested_delivery_date);
    }
    router.push(`/sales/orders/new?${params.toString()}`);
  };

  // Format value quartile
  const getValueTier = () => {
    if (!target.value_quartile) return null;
    const tiers = ['Bronze', 'Silver', 'Gold', 'Platinum'];
    return tiers[target.value_quartile - 1] || null;
  };

  const valueTier = getValueTier();

  return (
    <>
      <Card className={cn('flex flex-col hover:shadow-md transition-shadow', config.cardClass)}>
        <CardContent className="p-4 flex-1 flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-start mb-3">
            <div className="min-w-0 flex-1">
              <h3
                className="font-semibold text-base line-clamp-1 cursor-pointer hover:text-green-700"
                title={target.customer_name}
                onClick={() => router.push(`/sales/customers?id=${target.customer_id}`)}
              >
                {target.customer_name}
              </h3>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                {target.zone_name || target.county ? (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {target.zone_name || target.county}
                    {target.routing_key && (
                      <span className="text-slate-400">({target.routing_key})</span>
                    )}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Priority Score Circle */}
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold',
                  target.priority_score >= 80 && 'bg-green-100 text-green-700',
                  target.priority_score >= 50 && target.priority_score < 80 && 'bg-amber-100 text-amber-700',
                  target.priority_score < 50 && 'bg-slate-100 text-slate-600'
                )}
                title="Priority Score"
              >
                {target.priority_score}
              </div>
              <Badge variant="outline" className={cn('text-xs', config.badgeClass)}>
                <Icon className="w-3 h-3 mr-1" />
                {config.badge}
              </Badge>
            </div>
          </div>

          {/* Context Note - The Hook */}
          <div className="bg-slate-50 p-3 rounded-md mb-3">
            <p className="text-sm font-medium text-slate-700">{target.context_note}</p>
            {target.target_reason === 'route_match' && target.suggested_delivery_date && (
              <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Delivery: {format(new Date(target.suggested_delivery_date), 'EEE, MMM d')}
                {target.van_current_load !== null && (
                  <span className="ml-2">
                    ({target.van_current_load}/10 trolleys)
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Customer Stats Row */}
          <div className="grid grid-cols-4 gap-2 text-xs mb-3">
            <div className="text-center p-2 bg-slate-50 rounded">
              <div className="font-semibold text-slate-700">{target.total_orders || 0}</div>
              <div className="text-slate-500">Orders</div>
            </div>
            <div className="text-center p-2 bg-slate-50 rounded">
              <div className="font-semibold text-slate-700">
                {target.avg_order_value ? formatCurrency(Math.round(target.avg_order_value)) : '-'}
              </div>
              <div className="text-slate-500">Avg</div>
            </div>
            <div className="text-center p-2 bg-slate-50 rounded">
              <div className="font-semibold text-slate-700">
                {formatOrderInterval(target.avg_order_interval)}
              </div>
              <div className="text-slate-500">Freq</div>
            </div>
            <div className="text-center p-2 bg-slate-50 rounded">
              <div className="font-semibold text-slate-700">
                {valueTier || '-'}
              </div>
              <div className="text-slate-500">Tier</div>
            </div>
          </div>

          {/* Last Order / Interaction */}
          <div className="text-xs text-slate-500 space-y-1 mb-3">
            <div className="flex items-center justify-between">
              <span>Last order:</span>
              <span className="font-medium text-slate-700">
                {formatDaysSinceOrder(target.last_order_at)}
              </span>
            </div>
            {target.last_interaction_at && (
              <div className="flex items-center justify-between">
                <span>Last contact:</span>
                <span className="font-medium text-slate-700">
                  {formatDistanceToNow(new Date(target.last_interaction_at), { addSuffix: true })}
                  {target.last_interaction_outcome && (
                    <span className="text-slate-400 ml-1">
                      ({target.last_interaction_outcome})
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Score Breakdown (Expandable) */}
          {showScoreBreakdown && (
            <div className="mb-3">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
              >
                <Target className="h-3 w-3" />
                Score Breakdown
                {expanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
              {expanded && (
                <div className="mt-2 p-2 bg-slate-50 rounded space-y-2">
                  <ScoreBar
                    score={target.probability_score}
                    label="Probability"
                    color="bg-blue-500"
                  />
                  <ScoreBar
                    score={target.route_fit_score}
                    label="Route Fit"
                    color="bg-green-500"
                  />
                  <ScoreBar
                    score={target.priority_score}
                    label="Combined"
                    color="bg-purple-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* Contact Info */}
          {target.phone && (
            <div className="text-xs text-slate-500 mb-3">
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
          <div className="grid grid-cols-2 gap-2 mt-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInteractionDialog(true)}
              className="gap-1.5"
            >
              <Phone className="w-3.5 h-3.5" />
              Log Call
            </Button>
            <Button size="sm" onClick={handleCreateOrder} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Order
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Log Interaction Dialog */}
      <LogInteractionDialog
        open={showInteractionDialog}
        onOpenChange={setShowInteractionDialog}
        customerId={target.customer_id}
        customerName={target.customer_name}
      />
    </>
  );
}
