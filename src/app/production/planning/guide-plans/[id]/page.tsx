import { PageFrame } from '@/ui/templates';
import { GuidePlanDetailClient } from './GuidePlanDetailClient';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function GuidePlanDetailPage({ params }: Props) {
  const { id } = await params;

  return (
    <PageFrame moduleKey="production">
      <GuidePlanDetailClient guidePlanId={id} />
    </PageFrame>
  );
}
