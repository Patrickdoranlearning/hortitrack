import { notFound, redirect } from 'next/navigation';
import { PageFrame } from '@/ui/templates/PageFrame';
import { getPickListById, getPickItems } from '@/server/sales/picking';
import WorkflowPageClient from './WorkflowPageClient';

interface PageProps {
  params: Promise<{ pickListId: string }>;
}

export default async function PickingWorkflowPage({ params }: PageProps) {
  const { pickListId } = await params;
  
  const pickList = await getPickListById(pickListId);
  
  if (!pickList) {
    notFound();
  }

  // If the pick list is already completed, redirect back to queue
  if (pickList.status === 'completed') {
    redirect('/dispatch/picking');
  }

  const items = await getPickItems(pickListId);

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="dispatch">
      <WorkflowPageClient 
        pickList={pickList}
        initialItems={items}
      />
    </PageFrame>
  );
}

