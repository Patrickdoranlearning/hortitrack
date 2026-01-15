import { PageFrame, ModulePageHeader } from '@/ui/templates';
import { PlantHealthHistoryClient } from './PlantHealthHistoryClient';

export default function PlantHealthHistoryPage() {
  return (
    <PageFrame moduleKey="plantHealth">
      <div className="space-y-6">
        <ModulePageHeader
          title="Health History"
          description="View all plant health logs across your organization"
        />
        <PlantHealthHistoryClient />
      </div>
    </PageFrame>
  );
}
