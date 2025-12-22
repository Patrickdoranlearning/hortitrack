'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ClipboardList, ExternalLink, CheckCircle2, Clock, Play, AlertCircle } from 'lucide-react';
import type { OrderPickList } from './OrderDetailPage';

interface OrderPickingPanelProps {
  orderId: string;
  pickLists: OrderPickList[];
  orderStatus: string;
}

export default function OrderPickingPanel({ orderId, pickLists, orderStatus }: OrderPickingPanelProps) {
  const hasPickList = pickLists.length > 0;
  const latestPickList = pickLists[0];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'in_progress':
        return <Play className="h-5 w-5 text-blue-500" />;
      case 'cancelled':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'in_progress':
        return 'secondary';
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'In Progress';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  // Calculate mock progress (in a real app, this would come from pick_items)
  const getProgress = (pickList: OrderPickList) => {
    if (pickList.status === 'completed') return 100;
    if (pickList.status === 'cancelled') return 0;
    if (pickList.status === 'pending') return 0;
    // For in_progress, we'd calculate from actual pick items
    return 50; // Mock value
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Pick List Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Pick List
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasPickList ? (
            <div className="space-y-6">
              {pickLists.map((pickList) => (
                <div key={pickList.id} className="space-y-4">
                  {/* Status Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(pickList.status)}
                      <div>
                        <p className="font-semibold">Pick List #{pickList.sequence}</p>
                        <p className="text-sm text-muted-foreground">
                          Created for order processing
                        </p>
                      </div>
                    </div>
                    <Badge variant={getStatusVariant(pickList.status)}>
                      {getStatusLabel(pickList.status)}
                    </Badge>
                  </div>

                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{getProgress(pickList)}%</span>
                    </div>
                    <Progress value={getProgress(pickList)} className="h-2" />
                  </div>

                  {/* Timestamps */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {pickList.started_at && (
                      <div>
                        <p className="text-muted-foreground">Started</p>
                        <p className="font-medium">
                          {format(new Date(pickList.started_at), 'PPp')}
                        </p>
                      </div>
                    )}
                    {pickList.completed_at && (
                      <div>
                        <p className="text-muted-foreground">Completed</p>
                        <p className="font-medium">
                          {format(new Date(pickList.completed_at), 'PPp')}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {pickList.notes && (
                    <div>
                      <p className="text-sm text-muted-foreground">Notes</p>
                      <p className="text-sm mt-1">{pickList.notes}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/sales/picking/${pickList.id}`}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Pick List
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">
                No pick list created yet
              </p>
              <p className="text-sm text-muted-foreground">
                {orderStatus === 'draft' 
                  ? 'Confirm the order to create a pick list'
                  : 'A pick list will be created when the order is confirmed'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Picking Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Picking Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-semibold">
                1
              </div>
              <div>
                <p className="font-medium">Locate Items</p>
                <p className="text-sm text-muted-foreground">
                  Find items in the specified locations in the nursery
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-semibold">
                2
              </div>
              <div>
                <p className="font-medium">Verify Quality</p>
                <p className="text-sm text-muted-foreground">
                  Check each item for quality before picking
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-semibold">
                3
              </div>
              <div>
                <p className="font-medium">Record Quantities</p>
                <p className="text-sm text-muted-foreground">
                  Mark items as picked and note any shortages or substitutions
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-semibold">
                4
              </div>
              <div>
                <p className="font-medium">Complete Pick List</p>
                <p className="text-sm text-muted-foreground">
                  Mark the pick list as complete when all items are gathered
                </p>
              </div>
            </div>
          </div>

          {hasPickList && latestPickList.status !== 'completed' && (
            <Button asChild className="w-full mt-4">
              <Link href={`/sales/picking/${latestPickList.id}`}>
                {latestPickList.status === 'pending' ? 'Start Picking' : 'Continue Picking'}
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}




