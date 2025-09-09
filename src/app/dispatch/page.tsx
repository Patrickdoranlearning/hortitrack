
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Truck, Calendar, ListChecks } from 'lucide-react';

export default function DispatchPage() {

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="dispatch">
      <div className="space-y-6">
        <ModulePageHeader 
            title="Dispatch Dashboard"
            description="Manage order packing, delivery schedules, and logistics."
            actionsSlot={
              <>
                <Button>
                    <Calendar className="mr-2 h-4 w-4" />
                    Schedule Delivery
                </Button>
              </>
            }
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ListChecks className="text-primary" />
                        Ready for Dispatch
                    </CardTitle>
                    <CardDescription>
                        Orders that have been picked and are ready to be packed and scheduled.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center text-muted-foreground py-12">
                        <p>Orders ready for dispatch will appear here.</p>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Truck className="text-primary" />
                        Scheduled Deliveries
                    </CardTitle>
                    <CardDescription>
                        A timeline of upcoming deliveries and their status.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center text-muted-foreground py-12">
                        <p>Delivery schedule coming soon.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </PageFrame>
  );
}
