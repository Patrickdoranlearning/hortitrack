
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { Plus, ListChecks, Flag, AlertTriangle, CheckCircle, Shield } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useCollection } from '@/hooks/useCollection';
import type { NurseryLocation } from '@/lib/types';
import FlagBatchDialog from '@/components/flag-batch-dialog';
import { Batch } from '@/lib/types';
import Link from 'next/link';

export default function ActionsPage() {
  const [isFlagBatchOpen, setIsFlagBatchOpen] = React.useState(false);
  const [selectedBatch, setSelectedBatch] = React.useState<Batch | null>(null);

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="plantHealth">
      <div className="space-y-6">
        <ModulePageHeader 
            title="IPM Dashboard"
            description="Assign and track plant health tasks, log activities, and flag batches needing attention."
            actionsSlot={
              <>
                <Button variant="outline" asChild>
                    <Link href="/ipm/programs">
                        <Shield />
                        Manage IPM Programs
                    </Link>
                </Button>
                <Button onClick={() => setIsFlagBatchOpen(true)}>
                    <Flag />
                    Flag a Batch
                </Button>
              </>
            }
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="text-destructive" />
                        IPM Tasks To Do
                    </CardTitle>
                    <CardDescription>
                        Tasks generated from active IPM programs that need to be completed.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center text-muted-foreground py-12">
                        <p>Task list coming soon.</p>
                        <p className="text-xs">This will show assigned tasks like 'Spray batch X for aphids'.</p>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="text-primary" />
                        Recently Completed IPM Actions
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
