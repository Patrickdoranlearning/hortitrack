import { PageFrame } from '@/ui/templates';
import { GuidePlansClient } from './GuidePlansClient';

export const dynamic = 'force-dynamic';

export default async function GuidePlansPage() {
  return (
    <PageFrame moduleKey="production">
      <GuidePlansClient />
    </PageFrame>
  );
}
