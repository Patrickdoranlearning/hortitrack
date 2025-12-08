'use client';

import { useRouter } from 'next/navigation';
import PickingWizard from '@/components/dispatch/PickingWizard';
import type { PickList, PickItem } from '@/server/sales/picking';

interface WorkflowPageClientProps {
  pickList: PickList;
  initialItems: PickItem[];
}

export default function WorkflowPageClient({
  pickList,
  initialItems,
}: WorkflowPageClientProps) {
  const router = useRouter();

  const handleComplete = () => {
    router.push('/dispatch/picking');
  };

  const handleExit = () => {
    router.push('/dispatch/picking');
  };

  return (
    <PickingWizard
      pickList={pickList}
      initialItems={initialItems}
      onComplete={handleComplete}
      onExit={handleExit}
    />
  );
}

