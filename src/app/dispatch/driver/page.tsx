import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { getActiveDeliveryRuns, getDeliveryRunWithItems } from '@/server/dispatch/queries.server';
import { getUserAndOrg } from '@/server/auth/org';
import DriverViewClient from './DriverViewClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function DriverPage() {
  let activeRuns: any[] = [];
  let userRun: any = null;

  try {
    const { user } = await getUserAndOrg();
    activeRuns = await getActiveDeliveryRuns();
    
    // TODO: In the future, auto-detect which run the driver is assigned to
    // For now, show all active runs to select from
  } catch (error) {
    console.error('Error fetching driver data:', error);
  }

  // If only one active run, could auto-load it
  // For now, let the driver select their run

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="dispatch">
      <div className="space-y-6">
        <ModulePageHeader
          title="Driver View"
          description="Your delivery route and stops for today"
        />

        {activeRuns.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">No Active Routes</h3>
              <p className="text-muted-foreground mb-4">
                There are no delivery runs scheduled for today.
              </p>
              <Link href="/dispatch">
                <Button variant="outline">Go to Dispatch Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <DriverViewClient activeRuns={activeRuns} />
        )}
      </div>
    </PageFrame>
  );
}

