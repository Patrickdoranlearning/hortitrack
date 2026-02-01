import { PageFrame } from '@/ui/templates';
import TasksOverviewClient from "./TasksOverviewClient";
import { getTasks, getAssignableStaff } from "@/server/tasks/service";
import { getProductionJobs } from "@/server/production/jobs";
import { createClient } from "@/lib/supabase/server";
import * as Sentry from '@sentry/nextjs';

export const dynamic = "force-dynamic";

export default async function TasksOverviewPage() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('[Tasks Page] Auth error:', authError);
      Sentry.captureException(authError, { tags: { module: 'tasks', operation: 'auth' } });
      throw new Error(`Authentication failed: ${authError.message}`);
    }

    // Fetch data in parallel with individual error handling
    const [allTasks, myTasks, jobs, staff] = await Promise.all([
      getTasks({ status: ["pending", "assigned", "in_progress"] }).catch((err) => {
        console.error('[Tasks Page] Failed to fetch all tasks:', err);
        Sentry.captureException(err, { tags: { module: 'tasks', operation: 'getTasks' } });
        throw err;
      }),
      user ? getTasks({ assignedTo: user.id, status: ["assigned", "in_progress"] }).catch((err) => {
        console.error('[Tasks Page] Failed to fetch my tasks:', err);
        Sentry.captureException(err, { tags: { module: 'tasks', operation: 'getMyTasks' } });
        throw err;
      }) : Promise.resolve([]),
      getProductionJobs({ status: ["unassigned", "assigned", "in_progress"] }).catch((err) => {
        console.error('[Tasks Page] Failed to fetch production jobs:', err);
        Sentry.captureException(err, { tags: { module: 'tasks', operation: 'getProductionJobs' } });
        throw err;
      }),
      getAssignableStaff().catch((err) => {
        console.error('[Tasks Page] Failed to fetch assignable staff:', err);
        Sentry.captureException(err, { tags: { module: 'tasks', operation: 'getAssignableStaff' } });
        throw err;
      }),
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
  } catch (error) {
    console.error('[Tasks Page] Page render failed:', error);
    throw error; // Re-throw to trigger error boundary
  }
}
