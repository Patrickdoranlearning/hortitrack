import { getUserAndOrg } from '@/server/auth/org';
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { getPickListsForOrg, getPickingTeams } from '@/server/sales/picking';
import PickManagementClient from './PickManagementClient';
import { Card } from '@/components/ui/card';

export default async function PickManagementPage() {
    let orgId: string;
    
    try {
        const result = await getUserAndOrg();
        orgId = result.orgId;
    } catch (e) {
        return (
            <PageFrame companyName="Doran Nurseries" moduleKey="dispatch">
                <div className="space-y-6">
                    <ModulePageHeader
                        title="Pick Management"
                        description="Manage teams, assign orders, and set pick sequence"
                    />
                    <Card className="p-6 text-center">
                        <p className="text-muted-foreground">Please log in to access pick management.</p>
                    </Card>
                </div>
            </PageFrame>
        );
    }
    
    // Get all teams
    const teams = await getPickingTeams(orgId);
    
    // Get all pick lists
    const pickLists = await getPickListsForOrg(orgId, {
        statuses: ['pending', 'in_progress'],
    });

    return (
        <PageFrame companyName="Doran Nurseries" moduleKey="dispatch">
            <div className="space-y-6">
                <ModulePageHeader
                    title="Pick Management"
                    description="Manage teams, assign orders, and set pick sequence"
                />

                <PickManagementClient 
                    initialPickLists={pickLists}
                    teams={teams}
                    orgId={orgId}
                />
            </div>
        </PageFrame>
    );
}



