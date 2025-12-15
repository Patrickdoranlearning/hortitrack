import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { TrialSetupWizard } from '@/components/trials/TrialSetupWizard';
import { ReferenceDataProvider } from '@/contexts/ReferenceDataContext';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';

export default function NewTrialPage() {
  return (
    <ReferenceDataProvider>
      <PageFrame moduleKey="plantHealth">
        <div className="space-y-6">
          <ModulePageHeader
            title="Create New Trial"
            description="Set up a scientific trial to compare treatments, varieties, or processes"
            actionsSlot={
              <Link href="/plant-health/trials">
                <Button variant="outline" className="gap-2">
                  <ChevronLeft className="h-4 w-4" />
                  Back to Trials
                </Button>
              </Link>
            }
          />

          <TrialSetupWizard />
        </div>
      </PageFrame>
    </ReferenceDataProvider>
  );
}
