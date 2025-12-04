'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Truck, Package, AlertCircle, Plus } from 'lucide-react';
import DeliveryRunCard from '@/components/dispatch/DeliveryRunCard';
import OrderReadyCard from '@/components/dispatch/OrderReadyCard';
import TrolleyBalanceCard from '@/components/dispatch/TrolleyBalanceCard';
import type {
  ActiveDeliveryRunSummary,
  OrderReadyForDispatch,
  CustomerTrolleySummary,
} from '@/lib/dispatch/types';
import Link from 'next/link';

interface DispatchClientProps {
  activeRuns: ActiveDeliveryRunSummary[];
  ordersReady: OrderReadyForDispatch[];
  trolleyBalances: CustomerTrolleySummary[];
}

export default function DispatchClient({
  activeRuns,
  ordersReady,
  trolleyBalances,
}: DispatchClientProps) {
  const overdueCustomers = trolleyBalances.filter(
    (b) => b.daysOutstanding !== undefined && b.daysOutstanding > 14
  );

  return (
    <div className="space-y-6">
      {/* Active Delivery Runs */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Truck className="text-primary" />
                Active Delivery Runs
              </CardTitle>
              <CardDescription>
                Routes currently in progress or scheduled for today
              </CardDescription>
            </div>
            <Link href="/dispatch/deliveries">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Run
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {activeRuns.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <p>No active delivery runs. Create a new run to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeRuns.map((run) => (
                <DeliveryRunCard
                  key={run.id}
                  run={run}
                  onClick={() => {
                    window.location.href = `/dispatch/deliveries/${run.id}`;
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders Ready for Dispatch */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="text-primary" />
                  Ready for Dispatch
                </CardTitle>
                <CardDescription>
                  Orders packed and ready to be scheduled
                </CardDescription>
              </div>
              <Link href="/dispatch/packing">
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {ordersReady.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <p>No orders ready for dispatch.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {ordersReady.slice(0, 10).map((order) => (
                  <OrderReadyCard
                    key={order.id}
                    order={order}
                    onClick={() => {
                      window.location.href = `/dispatch/packing?orderId=${order.id}`;
                    }}
                  />
                ))}
                {ordersReady.length > 10 && (
                  <div className="text-center pt-2">
                    <Link href="/dispatch/packing">
                      <Button variant="link" size="sm">
                        View {ordersReady.length - 10} more orders
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trolley Alerts */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="text-orange-500" />
                  Trolley Alerts
                </CardTitle>
                <CardDescription>
                  Customers with overdue trolley returns
                </CardDescription>
              </div>
              <Link href="/dispatch/trolleys">
                <Button variant="outline" size="sm">
                  Manage Trolleys
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {overdueCustomers.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <p>No overdue trolleys. Great!</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {overdueCustomers.slice(0, 10).map((balance) => (
                  <TrolleyBalanceCard
                    key={balance.customerId}
                    balance={balance}
                    onClick={() => {
                      window.location.href = `/sales/customers/${balance.customerId}`;
                    }}
                  />
                ))}
                {overdueCustomers.length > 10 && (
                  <div className="text-center pt-2">
                    <Link href="/dispatch/trolleys">
                      <Button variant="link" size="sm">
                        View {overdueCustomers.length - 10} more customers
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{activeRuns.length}</div>
            <div className="text-xs text-muted-foreground">Active Runs</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{ordersReady.length}</div>
            <div className="text-xs text-muted-foreground">Orders Ready</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{trolleyBalances.length}</div>
            <div className="text-xs text-muted-foreground">Customers with Trolleys</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">
              {trolleyBalances.reduce((sum, b) => sum + b.trolleysOutstanding, 0)}
            </div>
            <div className="text-xs text-muted-foreground">Total Trolleys Out</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
