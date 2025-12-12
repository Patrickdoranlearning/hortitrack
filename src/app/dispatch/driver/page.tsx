import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { getActiveDeliveryRuns } from '@/server/dispatch/queries.server';
import { getUserAndOrg } from '@/server/auth/org';
import DriverViewClient from './DriverViewClient';
import { Card, CardContent } from '@/components/ui/card';
import { Truck } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface PageProps {
  searchParams: Promise<{ runId?: string }>;
}

export default async function DriverPage({ searchParams }: PageProps) {
  const params = await searchParams;
  let activeRuns: any[] = [];

  try {
    await getUserAndOrg();
    activeRuns = await getActiveDeliveryRuns();
  } catch (error) {
    console.error('Error fetching driver data:', error);
  }

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
          <DriverViewClient activeRuns={activeRuns} initialRunId={params.runId} />
        )}
      </div>
    </PageFrame>
  );
}



