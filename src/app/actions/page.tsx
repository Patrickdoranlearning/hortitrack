
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { ActionDialog } from '@/components/actions/ActionDialog';
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { Plus, ListChecks } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useCollection } from '@/hooks/useCollection';
import type { NurseryLocation } from '@/lib/types';


const TABS = [
    { label: "Production", href: "/", exact: true },
    { label: "Sales", href: "/sales" },
    { label: "Plant Health", href: "/actions" },
];

export default function ActionsPage() {
  const [isActionLogOpen, setIsActionLogOpen] = React.useState(false);
  const { data: locations, loading: locationsLoading } = useCollection<NurseryLocation>('locations');

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="plantHealth" moduleTabs={TABS}>
      <div className="space-y-6">
        <ModulePageHeader 
            title="Plant Health"
            description="Log and manage activities related to plant health, such as treatments, inspections, and notes."
            actionsSlot={
                <Button onClick={() => setIsActionLogOpen(true)}>
                    <Plus />
                    Log New Action
                </Button>
            }
        />

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ListChecks />
                    Recent Activity
                </CardTitle>
                <CardDescription>
                    A live feed of all plant health actions logged across the nursery will be displayed here.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-center text-muted-foreground py-12">
                    <p>Recent actions log coming soon.</p>
                </div>
            </CardContent>
        </Card>
      </div>

       <ActionDialog
        open={isActionLogOpen}
        onOpenChange={setIsActionLogOpen}
        defaultBatchIds={[]} // No default batch on this page
        locations={locations || []}
      />
    </PageFrame>
  );
}
