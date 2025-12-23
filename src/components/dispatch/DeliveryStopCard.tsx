'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  MapPin,
  Phone,
  CheckCircle2,
  Clock,
  Package,
  Navigation,
  ChevronDown,
  ChevronUp,
  Camera,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { getStopColor } from './TruckVisualization';
import { DeliveryCompletionDialog } from './driver/DeliveryCompletionDialog';

export interface DeliveryStop {
  id: string;
  sequenceNumber: number;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  address?: {
    line1: string;
    line2?: string;
    city?: string;
    county?: string;
    eircode?: string;
  };
  trolleysDelivered: number;
  trolleysReturned: number;
  trolleysOutstanding: number;
  status: 'pending' | 'loading' | 'in_transit' | 'delivered' | 'failed' | 'rescheduled';
  deliveryNotes?: string;
  estimatedDeliveryTime?: string;
  actualDeliveryTime?: string;
}

interface DeliveryStopCardProps {
  stop: DeliveryStop;
  stopIndex: number;
  onMarkDelivered?: (stopId: string) => void;
  onNavigate?: (stop: DeliveryStop) => void;
  onCall?: (phone: string) => void;
  isLoading?: boolean;
  showPhotoCapture?: boolean;
  onPhotoUploaded?: (stopId: string, photoUrl: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  pending: { label: 'Pending', variant: 'outline', icon: <Clock className="h-3 w-3 mr-1" /> },
  loading: { label: 'Loading', variant: 'secondary', icon: <Package className="h-3 w-3 mr-1" /> },
  in_transit: { label: 'In Transit', variant: 'secondary', icon: <Navigation className="h-3 w-3 mr-1" /> },
  delivered: { label: 'Delivered', variant: 'default', icon: <CheckCircle2 className="h-3 w-3 mr-1" /> },
  failed: { label: 'Failed', variant: 'destructive', icon: null },
  rescheduled: { label: 'Rescheduled', variant: 'outline', icon: <Clock className="h-3 w-3 mr-1" /> },
};

export default function DeliveryStopCard({
  stop,
  stopIndex,
  onMarkDelivered,
  onNavigate,
  onCall,
  isLoading,
  showPhotoCapture = true,
  onPhotoUploaded,
}: DeliveryStopCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const color = getStopColor(stopIndex);
  const statusConfig = STATUS_CONFIG[stop.status];
  const isDelivered = stop.status === 'delivered';
  const isPending = stop.status === 'pending' || stop.status === 'in_transit';

  const formatAddress = () => {
    if (!stop.address) return null;
    const parts = [
      stop.address.line1,
      stop.address.line2,
      stop.address.city,
      stop.address.county,
      stop.address.eircode,
    ].filter(Boolean);
    return parts.join(', ');
  };

  const handleNavigate = () => {
    if (stop.address) {
      const addressString = formatAddress();
      if (addressString) {
        // Try to open in maps app
        const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(addressString)}`;
        window.open(mapsUrl, '_blank');
      }
    }
    onNavigate?.(stop);
  };

  const handleCall = () => {
    if (stop.customerPhone) {
      window.location.href = `tel:${stop.customerPhone}`;
      onCall?.(stop.customerPhone);
    }
  };

  return (
    <Card
      className={cn(
        'transition-colors',
        isDelivered && 'opacity-75 border-green-200 bg-green-50/30',
        !isDelivered && `border-l-4`,
        !isDelivered && color.bg.replace('bg-', 'border-l-')
      )}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3">
            {/* Stop number badge */}
            <div
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold',
                isDelivered ? 'bg-green-500' : color.bg
              )}
            >
              {isDelivered ? <CheckCircle2 className="h-4 w-4" /> : stop.sequenceNumber}
            </div>

            <div>
              <div className="font-semibold">{stop.customerName}</div>
              <div className="text-sm text-muted-foreground">
                Order #{stop.orderNumber}
              </div>
            </div>
          </div>

          <Badge variant={statusConfig.variant} className={isDelivered ? 'bg-green-600' : ''}>
            {statusConfig.icon}
            {statusConfig.label}
          </Badge>
        </div>

        {/* Address */}
        {stop.address && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground mb-3">
            <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{formatAddress()}</span>
          </div>
        )}

        {/* Trolley info */}
        <div className="flex items-center gap-4 text-sm mb-3">
          <span className="flex items-center gap-1">
            <Package className="h-4 w-4 text-muted-foreground" />
            {stop.trolleysDelivered} trolleys
          </span>
          {stop.trolleysOutstanding > 0 && (
            <Badge variant="secondary" className="text-xs">
              {stop.trolleysOutstanding} to return
            </Badge>
          )}
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <>
            <Separator className="my-3" />
            <div className="space-y-2 text-sm">
              {stop.deliveryNotes && (
                <div>
                  <span className="font-medium">Notes: </span>
                  <span className="text-muted-foreground">{stop.deliveryNotes}</span>
                </div>
              )}
              {stop.estimatedDeliveryTime && (
                <div>
                  <span className="font-medium">ETA: </span>
                  <span className="text-muted-foreground">{stop.estimatedDeliveryTime}</span>
                </div>
              )}
              {stop.actualDeliveryTime && (
                <div>
                  <span className="font-medium">Delivered at: </span>
                  <span className="text-muted-foreground">{stop.actualDeliveryTime}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Actions */}
        {isPending && (
          <>
            <Separator className="my-3" />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleNavigate}
                className="flex-1"
              >
                <Navigation className="h-4 w-4 mr-1" />
                Navigate
              </Button>
              {stop.customerPhone && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCall}
                >
                  <Phone className="h-4 w-4" />
                </Button>
              )}
              {showPhotoCapture ? (
                <DeliveryCompletionDialog
                  deliveryItemId={stop.id}
                  customerName={stop.customerName}
                  orderNumber={stop.orderNumber}
                  trolleysDelivered={stop.trolleysDelivered}
                  onCompleted={({ photoUrl, trolleysReturned }) => {
                    if (photoUrl) {
                      onPhotoUploaded?.(stop.id, photoUrl);
                    }
                    onMarkDelivered?.(stop.id);
                  }}
                  trigger={
                    <Button
                      size="sm"
                      disabled={isLoading}
                      className="flex-1"
                    >
                      <Camera className="h-4 w-4 mr-1" />
                      Deliver
                    </Button>
                  }
                />
              ) : (
                <Button
                  size="sm"
                  onClick={() => onMarkDelivered?.(stop.id)}
                  disabled={isLoading}
                  className="flex-1"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Delivered
                </Button>
              )}
            </div>
          </>
        )}

        {/* Expand/collapse toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center pt-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </CardContent>
    </Card>
  );
}

// List view variant for desktop
interface DeliveryStopListItemProps extends DeliveryStopCardProps {
  compact?: boolean;
}

export function DeliveryStopListItem({
  stop,
  stopIndex,
  onMarkDelivered,
  onNavigate,
  onCall,
  isLoading,
  compact = false,
}: DeliveryStopListItemProps) {
  const color = getStopColor(stopIndex);
  const statusConfig = STATUS_CONFIG[stop.status];
  const isDelivered = stop.status === 'delivered';
  const isPending = stop.status === 'pending' || stop.status === 'in_transit';

  const formatAddress = () => {
    if (!stop.address) return null;
    return [stop.address.city || stop.address.county, stop.address.eircode]
      .filter(Boolean)
      .join(', ');
  };

  const handleNavigate = () => {
    if (stop.address) {
      const parts = [
        stop.address.line1,
        stop.address.line2,
        stop.address.city,
        stop.address.county,
        stop.address.eircode,
      ].filter(Boolean);
      const addressString = parts.join(', ');
      const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(addressString)}`;
      window.open(mapsUrl, '_blank');
    }
    onNavigate?.(stop);
  };

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-3 rounded-lg border transition-colors',
        isDelivered && 'bg-green-50/50 border-green-200',
        !isDelivered && 'hover:bg-slate-50'
      )}
    >
      {/* Stop number */}
      <div
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold shrink-0',
          isDelivered ? 'bg-green-500' : color.bg
        )}
      >
        {isDelivered ? <CheckCircle2 className="h-4 w-4" /> : stop.sequenceNumber}
      </div>

      {/* Customer & Order info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{stop.customerName}</span>
          <span className="text-sm text-muted-foreground">#{stop.orderNumber}</span>
        </div>
        {!compact && stop.address && (
          <div className="text-sm text-muted-foreground truncate">
            {formatAddress()}
          </div>
        )}
      </div>

      {/* Trolleys */}
      <div className="text-sm text-muted-foreground shrink-0">
        {stop.trolleysDelivered} trolleys
      </div>

      {/* Status */}
      <Badge variant={statusConfig.variant} className={cn('shrink-0', isDelivered && 'bg-green-600')}>
        {statusConfig.label}
      </Badge>

      {/* Actions */}
      {isPending && (
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="ghost" onClick={handleNavigate}>
            <Navigation className="h-4 w-4" />
          </Button>
          {stop.customerPhone && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                window.location.href = `tel:${stop.customerPhone}`;
                onCall?.(stop.customerPhone!);
              }}
            >
              <Phone className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => onMarkDelivered?.(stop.id)}
            disabled={isLoading}
          >
            <CheckCircle2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

