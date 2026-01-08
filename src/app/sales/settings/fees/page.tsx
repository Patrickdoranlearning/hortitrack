import { getOrgFees, initializeDefaultFees } from './actions';
import { FeeSettingsClient } from './FeeSettingsClient';

export const metadata = {
  title: 'Fee Settings | Sales',
  description: 'Manage pre-pricing, delivery, and other fee configurations',
};

export default async function FeeSettingsPage() {
  // Initialize default fees if needed
  await initializeDefaultFees();
  
  const fees = await getOrgFees();

  return (
    <div className="container py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fee Settings</h1>
        <p className="text-muted-foreground">
          Configure pre-pricing, delivery charges, and other fees for your orders.
        </p>
      </div>

      <FeeSettingsClient initialFees={fees} />
    </div>
  );
}

