import { getUserAndOrg } from '@/server/auth/org';
import { PageFrame } from '@/ui/templates';
import { ModulePageHeader } from '@/ui/templates';
import PickingQueueClient from './PickingQueueClient';
import { getOrdersForPicking, getUserTeams, getPickingTeams } from '@/server/sales/picking';
import { Card } from '@/components/ui/card';

export default async function PickingQueuePage() {
    let user: any;
    let orgId: string;
    
    try {
        const result = await getUserAndOrg();
        user = result.user;
        orgId = result.orgId;
    } catch (e) {
        return (
            <PageFrame moduleKey="dispatch">
                <div className="space-y-6">
                    <ModulePageHeader
                        title="Picking Queue"
                        description="Orders ready to be picked"
                    />
                    <Card className="p-6 text-center">
                        <p className="text-muted-foreground">Please log in to access the picking queue.</p>
                    </Card>
                </div>
            </PageFrame>
        );
    }
    
    // Get user's teams
    const userTeams = await getUserTeams(user.id);
    const teamIds = userTeams.map((t: any) => t.id);
    
    // Get all teams (for filter dropdown)
    const allTeams = await getPickingTeams(orgId);
    
    // Get ALL orders that need picking - includes orders without pick lists
    const pickLists = await getOrdersForPicking(orgId);

    return (
        <PageFrame moduleKey="dispatch">
            <div className="space-y-6">
                <ModulePageHeader
                    title="Picking Queue"
                    description="Orders ready to be picked"
                />

                <PickingQueueClient 
                    initialPickLists={pickLists}
                    teams={allTeams}
                    userTeamIds={teamIds}
                    userId={user.id}
                />
            </div>
        </PageFrame>
    );
}
