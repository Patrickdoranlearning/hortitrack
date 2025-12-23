import { notFound, redirect } from 'next/navigation';
import { PageFrame } from '@/ui/templates';
import { getPickListById, getPickItems } from '@/server/sales/picking';
import PickingWorkflowClient from './PickingWorkflowClient';

interface PageProps {
  params: Promise<{ pickListId: string }>;
}

export default async function PickingWorkflowPage({ params }: PageProps) {
  const { pickListId } = await params;
  
  const pickList = await getPickListById(pickListId);
  
  if (!pickList) {
    notFound();
  }

  // If the pick list is completed, redirect back to queue
  if (pickList.status === 'completed') {
    redirect('/dispatch/picking');
  }

  const items = await getPickItems(pickListId);

  return (
    <PageFrame moduleKey="dispatch">
      <PickingWorkflowClient 
        pickList={pickList}
        initialItems={items}
      />
    </PageFrame>
  );
}

