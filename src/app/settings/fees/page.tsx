import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageFrame } from '@/ui/templates';
import { getOrgFees, initializeDefaultFees } from './actions';
import { FeeSettingsClient } from './FeeSettingsClient';

export const metadata = {
  title: 'Order Fees | Settings',
  description: 'Manage pre-pricing, delivery, and other fee configurations',
};

export default async function FeeSettingsPage() {
  // Initialize default fees if needed (non-blocking — don't break page on failure)
  await initializeDefaultFees().catch(() => {});

  const fees = await getOrgFees();

  return (
    <PageFrame moduleKey="production">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-headline text-4xl">Order Fees</h1>
            <p className="text-muted-foreground">
              Configure pre-pricing, delivery charges, and other fees for your orders.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/settings">
              <ArrowLeft />
              Back to Settings
            </Link>
          </Button>
        </div>

        <FeeSettingsClient initialFees={fees} />
      </div>
    </PageFrame>
  );
}
