import { getUserAndOrg } from '@/server/auth/org';
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import PickingQueueClient from './PickingQueueClient';
import { getPickListsForOrg, getUserTeams, getPickingTeams } from '@/server/sales/picking';
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
            <PageFrame companyName="Doran Nurseries" moduleKey="dispatch">
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
    
    // Get pick lists - either for user's teams or all if they have no team
    const pickLists = await getPickListsForOrg(orgId, {
        statuses: ['pending', 'in_progress'],
    });

    // Filter to user's team pick lists (or show all unassigned if no teams)
    const relevantPickLists = teamIds.length > 0
        ? pickLists.filter((pl: any) => !pl.assignedTeamId || teamIds.includes(pl.assignedTeamId))
        : pickLists;

    return (
        <PageFrame companyName="Doran Nurseries" moduleKey="dispatch">
            <div className="space-y-6">
                <ModulePageHeader
                    title="Picking Queue"
                    description="Orders ready to be picked"
                />

                <PickingQueueClient 
                    initialPickLists={relevantPickLists}
                    teams={allTeams}
                    userTeamIds={teamIds}
                    userId={user.id}
                />
            </div>
        </PageFrame>
    );
}
