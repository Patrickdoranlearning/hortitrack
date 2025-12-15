import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { TargetList, type SalesTarget } from '@/components/sales/dashboard/TargetList';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ArrowLeft, Plus, Truck, AlertTriangle, UserPlus, RefreshCw } from 'lucide-react';

export default async function SalesTargetsPage() {
  const supabase = await createClient();

  // Fetch targets from the view
  const { data: targetsData, error } = await supabase
    .from('v_sales_rep_targets')
    .select('*')
    .order('priority_score', { ascending: false });

  const targets = (targetsData || []) as SalesTarget[];

  // Group targets by reason for summary
  const vanOpportunities = targets.filter(t => t.target_reason === 'fill_van');
  const churnRisks = targets.filter(t => t.target_reason === 'churn_risk');
  const newCustomers = targets.filter(t => t.target_reason === 'new_customer');

  // Get unique counties with van opportunities
  const activeCounties = [...new Set(vanOpportunities.map(t => t.county).filter(Boolean))];

  return (
    <PageFrame moduleKey="sales">
      <div className="space-y-6">
        <ModulePageHeader
          title="Sales Targets"
          description="High-value opportunities and van-filling calls."
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
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Van Opportunities</CardTitle>
              <Truck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{vanOpportunities.length}</div>
              <p className="text-xs text-muted-foreground">
                {activeCounties.length > 0 
                  ? `Routes in ${activeCounties.slice(0, 3).join(', ')}${activeCounties.length > 3 ? '...' : ''}`
                  : 'No active routes this week'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Churn Risks</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{churnRisks.length}</div>
              <p className="text-xs text-muted-foreground">
                Haven&apos;t ordered in 6+ weeks
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New Customers</CardTitle>
              <UserPlus className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{newCustomers.length}</div>
              <p className="text-xs text-muted-foreground">
                No orders yet
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Targets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{targets.length}</div>
              <p className="text-xs text-muted-foreground">
                Customers to contact
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Van Filling Context */}
        {activeCounties.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Truck className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-green-800">Active Delivery Routes This Week</h3>
                <p className="text-sm text-green-700 mt-1">
                  Vans going to <span className="font-semibold">{activeCounties.join(', ')}</span>. 
                  Focus on these counties to maximize van utility.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Target List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              Customer Targets
              {targets.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({targets.length} customers)
                </span>
              )}
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sales/targets">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Link>
            </Button>
          </div>
          <TargetList targets={targets} />
        </div>
      </div>
    </PageFrame>
  );
}
