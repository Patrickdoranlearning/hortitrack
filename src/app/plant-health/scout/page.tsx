'use client';

import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { ScoutWizard } from '@/components/plant-health/scout';

export default function ScoutPage() {
  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="plantHealth">
      <div className="space-y-6">
        <ModulePageHeader
          title="Scout Mode"
          description="Scan locations to log issues, readings, and schedule treatments"
        />

        <div className="max-w-2xl mx-auto">
          <ScoutWizard />
        </div>
      </div>
    </PageFrame>
  );
}
