
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { ActionDialog } from '@/components/actions/ActionDialog';
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { Plus, ListChecks, Flag, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useCollection } from '@/hooks/useCollection';
import type { NurseryLocation } from '@/lib/types';
import FlagBatchDialog from '@/components/flag-batch-dialog';
import { Batch } from '@/lib/types';

export default function ActionsPage() {
  const [isActionLogOpen, setIsActionLogOpen] = React.useState(false);
  const [isFlagBatchOpen, setIsFlagBatchOpen] = React.useState(false);
  const { data: locations, loading: locationsLoading } = useCollection<NurseryLocation>('nursery_locations');
  
  // Placeholder for a selected batch for the flag dialog
  const [selectedBatch, setSelectedBatch] = React.useState<Batch | null>(null);


  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="plantHealth">
      <div className="space-y-6">
        <ModulePageHeader 
            title="Plant Health Dashboard"
            description="Assign and track plant health tasks, log activities, and flag batches needing attention."
            actionsSlot={
              <>
                <Button onClick={() => setIsFlagBatchOpen(true)}>
                    <Flag />
                    Flag a Batch
                </Button>
                <Button onClick={() => setIsActionLogOpen(true)}>
                    <Plus />
                    Log New Action
                </Button>
              </>
            }
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="text-destructive" />
                        Tasks To Do
                    </CardTitle>
                    <CardDescription>
                        Tasks assigned by batch or location that need to be completed.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center text-muted-foreground py-12">
                        <p>Task list coming soon.</p>
                        <p className="text-xs">This will show assigned tasks like 'Spray batch X for aphids' or 'Check Tunnel Y for mildew'.</p>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="text-primary" />
                        Recently Completed Tasks
                    </CardTitle>
                    <CardDescription>
                        A live feed of all plant health actions logged across the nursery.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center text-muted-foreground py-12">
                        <p>Recent actions log coming soon.</p>
                    </div>
                </CardContent>
            </Card>

        </div>
      </div>

       <ActionDialog
        open={isActionLogOpen}
        onOpenChange={setIsActionLogOpen}
        batch={selectedBatch}
        locations={locations || []}
      />
      
      {/* A placeholder batch is needed for the dialog to open. 
          In a real implementation, you'd select a batch first. */}
      {selectedBatch && (
        <FlagBatchDialog
            open={isFlagBatchOpen}
            onOpenChange={setIsFlagBatchOpen}
            batch={selectedBatch}
            onDone={() => setSelectedBatch(null)}
        />
      )}
    </PageFrame>
  );
}
