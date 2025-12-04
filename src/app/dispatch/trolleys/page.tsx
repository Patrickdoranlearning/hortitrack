import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Plus, AlertCircle } from 'lucide-react';
import TrolleyBalanceCard from '@/components/dispatch/TrolleyBalanceCard';
import { getCustomerTrolleyBalances } from '@/server/dispatch/queries.server';

export default async function TrolleysPage() {
  const balances = await getCustomerTrolleyBalances().catch(() => []);

  // Filter by overdue status
  const overdue = balances.filter((b) => b.daysOutstanding !== undefined && b.daysOutstanding > 14);
  const recent = balances.filter((b) => b.daysOutstanding !== undefined && b.daysOutstanding <= 14);

  const totalTrolleysOut = balances.reduce((sum, b) => sum + b.trolleysOutstanding, 0);

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="dispatch">
      <div className="space-y-6">
        <ModulePageHeader
          title="Trolley Management"
          description="Track danish trolleys and customer returns"
          actionsSlot={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Trolley
            </Button>
          }
        />

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{balances.length}</div>
              <div className="text-xs text-muted-foreground">Customers with Trolleys</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-orange-600">{totalTrolleysOut}</div>
              <div className="text-xs text-muted-foreground">Total Trolleys Out</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">{overdue.length}</div>
              <div className="text-xs text-muted-foreground">Overdue Customers</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{recent.length}</div>
              <div className="text-xs text-muted-foreground">Recent Deliveries</div>
            </CardContent>
          </Card>
        </div>

        {/* Overdue Trolleys */}
        {overdue.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="text-orange-500" />
                Overdue Returns (14+ days)
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({overdue.length})
                </span>
              </CardTitle>
              <CardDescription>
                Customers who have had trolleys for more than 14 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {overdue.map((balance) => (
                  <TrolleyBalanceCard
                    key={balance.customerId}
                    balance={balance}
                    onClick={() => {
                      window.location.href = `/sales/customers/${balance.customerId}`;
                    }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Deliveries */}
        {recent.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Recent Deliveries
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({recent.length})
                </span>
              </CardTitle>
              <CardDescription>Trolleys out for less than 14 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recent.map((balance) => (
                  <TrolleyBalanceCard
                    key={balance.customerId}
                    balance={balance}
                    onClick={() => {
                      window.location.href = `/sales/customers/${balance.customerId}`;
                    }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {balances.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">
                No trolleys currently out with customers.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </PageFrame>
  );
}
