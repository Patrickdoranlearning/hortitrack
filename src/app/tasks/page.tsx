import { PageFrame } from "@/ui/templates/PageFrame";
import TasksOverviewClient from "./TasksOverviewClient";
import { getTasks, getAssignableStaff } from "@/server/tasks/service";
import { getProductionJobs } from "@/server/production/jobs";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TasksOverviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // Fetch data in parallel
  const [allTasks, myTasks, jobs, staff] = await Promise.all([
    getTasks({ status: ["pending", "assigned", "in_progress"] }),
    user ? getTasks({ assignedTo: user.id, status: ["assigned", "in_progress"] }) : Promise.resolve([]),
    getProductionJobs({ status: ["unassigned", "assigned", "in_progress"] }),
    getAssignableStaff(),
  ]);

  return (
    <PageFrame moduleKey="tasks">
      <TasksOverviewClient
        allTasks={allTasks}
        myTasks={myTasks}
        jobs={jobs}
        staff={staff}
        currentUserId={user?.id ?? null}
      />
    </PageFrame>
  );
}
