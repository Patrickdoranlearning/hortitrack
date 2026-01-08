import { PageFrame } from '@/ui/templates';
import { ModulePageHeader } from '@/ui/templates';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft, Plus, Truck, AlertTriangle, UserPlus, TrendingUp, Route, Target } from 'lucide-react';
import { TargetsClient } from '@/components/sales/targeting';
import {
  getSmartTargets,
  getActiveDeliveryZones,
  getScheduledDeliveries,
} from '../actions';

export default async function SalesTargetsPage() {
  // Fetch all targeting data in parallel
  const [targetsResult, zonesResult, deliveriesResult] = await Promise.all([
    getSmartTargets(),
    getActiveDeliveryZones(),
    getScheduledDeliveries(),
  ]);

  const targets = targetsResult.targets;
  const zones = zonesResult.zones;
  const scheduledDeliveries = deliveriesResult.deliveries;

  // Calculate summary stats
  const routeMatches = targets.filter(t => t.target_reason === 'route_match').length;
  const nearbyRoute = targets.filter(t => t.target_reason === 'nearby_route').length;
  const likelyToOrder = targets.filter(t => t.target_reason === 'likely_to_order').length;
  const churnRisks = targets.filter(t => t.target_reason === 'churn_risk').length;
  const newCustomers = targets.filter(t => t.target_reason === 'new_customer').length;

  // Calculate van fill opportunity
  const vanOpportunity = zones.reduce((acc, z) => acc + Math.max(0, 10 - z.total_trolleys), 0);

  return (
    <PageFrame moduleKey="sales">
      <div className="space-y-6">
        <ModulePageHeader
          title="Smart Sales Targets"
          description="AI-powered customer targeting based on order patterns and route optimization."
          actionsSlot={
            <div className="flex gap-2">
              <Button variant="ghost" asChild>
                <Link href="/sales">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Operations
                </Link>
              </Button>
              <Button asChild>
                <Link href="/sales/orders/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New Order
                </Link>
              </Button>
            </div>
          }
        />

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Route Match</CardTitle>
              <Truck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{routeMatches}</div>
              <p className="text-xs text-muted-foreground">
                On active routes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Nearby Route</CardTitle>
              <Route className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{nearbyRoute}</div>
              <p className="text-xs text-muted-foreground">
                Adjacent zones
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Likely to Order</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{likelyToOrder}</div>
              <p className="text-xs text-muted-foreground">
                Based on patterns
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Churn Risks</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{churnRisks}</div>
              <p className="text-xs text-muted-foreground">
                6+ weeks inactive
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New Customers</CardTitle>
              <UserPlus className="h-4 w-4 text-sky-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-sky-600">{newCustomers}</div>
              <p className="text-xs text-muted-foreground">
                No orders yet
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Van Capacity</CardTitle>
              <Target className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{vanOpportunity}</div>
              <p className="text-xs text-muted-foreground">
                Trolleys to fill
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Van Filling Context Banner */}
        {vanOpportunity > 0 && zones.length > 0 && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Truck className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-green-800">
                  {vanOpportunity} trolley slots available across {zones.length} active routes
                </h3>
                <p className="text-sm text-green-700 mt-1">
                  Target customers in these zones to maximize van utilization. Customers marked as
                  &quot;Route Match&quot; are in zones with scheduled deliveries this week.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Targets Client Component */}
        <TargetsClient
          targets={targets}
          zones={zones}
          scheduledDeliveries={scheduledDeliveries}
        />
      </div>
    </PageFrame>
  );
}




