'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Truck, 
  MapPin, 
  Phone, 
  CheckCircle2, 
  Clock, 
  Package,
  Navigation,
  ChevronRight
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { ActiveDeliveryRunSummary } from '@/lib/dispatch/types';
import { toast } from 'sonner';

interface DriverViewClientProps {
  activeRuns: ActiveDeliveryRunSummary[];
}

export default function DriverViewClient({ activeRuns }: DriverViewClientProps) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [deliveryStatuses, setDeliveryStatuses] = useState<Record<string, 'pending' | 'delivered'>>({});

  const selectedRun = activeRuns.find(r => r.id === selectedRunId);

  const handleMarkDelivered = async (deliveryItemId: string) => {
    // Optimistic update
    setDeliveryStatuses(prev => ({ ...prev, [deliveryItemId]: 'delivered' }));
    
    // TODO: Call server action to mark as delivered
    toast.success('Marked as delivered');
  };

  // Run Selection View
  if (!selectedRunId) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Select Your Route</h2>
        <div className="grid gap-4">
          {activeRuns.map(run => (
            <Card 
              key={run.id} 
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => setSelectedRunId(run.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Truck className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold">{run.runNumber}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(parseISO(run.runDate), 'EEEE, MMM d')}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={run.status === 'in_transit' ? 'default' : 'secondary'}>
                      {run.status.replace('_', ' ')}
                    </Badge>
                    <div className="text-sm text-muted-foreground mt-1">
                      {run.pendingDeliveries} stops
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Route View (when run is selected)
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setSelectedRunId(null)}
        >
          ← Back to routes
        </Button>
        <Badge variant="outline" className="text-lg px-3 py-1">
          {selectedRun?.runNumber}
        </Badge>
      </div>

      {/* Progress Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">
                {selectedRun?.completedDeliveries || 0}
              </div>
              <div className="text-xs text-muted-foreground">Delivered</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {selectedRun?.pendingDeliveries || 0}
              </div>
              <div className="text-xs text-muted-foreground">Remaining</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {selectedRun?.totalDeliveries || 0}
              </div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Stops */}
      <div className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Delivery Stops
        </h3>

        {/* Placeholder stops - in production, these would come from getDeliveryRunWithItems */}
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-semibold">Stop 1 - Example Customer</div>
                <div className="text-sm text-muted-foreground">
                  123 Main Street, Dublin 2
                </div>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Delivered
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-semibold">Stop 2 - Another Customer</div>
                <div className="text-sm text-muted-foreground">
                  456 Oak Avenue, Dublin 4
                </div>
              </div>
              <Badge variant="secondary">
                <Clock className="h-3 w-3 mr-1" />
                Pending
              </Badge>
            </div>
            <Separator className="my-3" />
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  2 trolleys
                </span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline">
                  <Navigation className="h-4 w-4 mr-1" />
                  Navigate
                </Button>
                <Button size="sm" onClick={() => handleMarkDelivered('example-id')}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Delivered
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Empty state message */}
        <div className="text-center text-muted-foreground py-8 border rounded-lg bg-slate-50">
          <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            Delivery stops will appear here once the route is loaded.
          </p>
          <p className="text-xs mt-1">
            This view will show real data from the selected delivery run.
          </p>
        </div>
      </div>
    </div>
  );
}



