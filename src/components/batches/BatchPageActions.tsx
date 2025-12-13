'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ActionMenuButton } from '@/components/actions/ActionMenuButton';
import { ActionDialog } from '@/components/actions/ActionDialog';
import type { ActionMode } from '@/components/actions/types';
import { TransplantMenuButton } from '@/components/horti/TransplantMenuButton';
import EditBatchForm from '@/components/batches/EditBatchForm';
import type { Batch, NurseryLocation } from '@/lib/types';
import { useCollection } from '@/hooks/useCollection';

type Props = {
  batch: Batch;
};

/**
 * Action bar for the batch detail page. Uses existing dialogs/components so
 * buttons don’t point to missing routes.
 */
export function BatchPageActions({ batch }: Props) {
  const [isLogActionOpen, setIsLogActionOpen] = React.useState(false);
  const [logMode, setLogMode] = React.useState<ActionMode>('MOVE');
  const [isEditOpen, setIsEditOpen] = React.useState(false);

  const { data: locations = [] } = useCollection<NurseryLocation>('nursery_locations');

  return (
    <div className="flex flex-wrap gap-2">
      <TransplantMenuButton className="w-full sm:w-auto" />

      <ActionMenuButton
        batch={batch}
        onSelect={(mode) => {
          setLogMode(mode);
          setIsLogActionOpen(true);
        }}
        size="sm"
        label="Log Action"
      />

      <Button
        size="sm"
        variant="secondary"
        onClick={() => setIsEditOpen(true)}
        className="shrink-0"
      >
        Edit
      </Button>

      <ActionDialog
        open={isLogActionOpen}
        onOpenChange={setIsLogActionOpen}
        batch={batch}
        locations={locations}
        mode={logMode}
      />

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Batch</DialogTitle>
            <DialogDescription className="sr-only">
              Update batch details such as size, location, and status.
            </DialogDescription>
          </DialogHeader>
          <EditBatchForm
            batch={batch as any}
            onSubmitSuccess={() => setIsEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
