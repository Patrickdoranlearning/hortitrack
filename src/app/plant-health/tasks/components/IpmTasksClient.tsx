'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserCircle, Eye, Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { ModulePageHeader } from '@/ui/templates';
import {
  getJobsForWeek,
  getMyJobs,
  markOverdueTasks,
  type TaskGroup,
} from '@/app/actions/ipm-tasks';
import type { IpmJob, JobsByStatus } from '@/types/ipm-jobs';
import { ScoutCommandCenter } from './ScoutCommandCenter';
import { ApplicatorDashboard } from './ApplicatorDashboard';

// Helper: Get current ISO week number
function getCurrentWeek(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function IpmTasksClient() {
  const [view, setView] = useState<'scout' | 'applicator'>('scout');
  const [loading, setLoading] = useState(true);
  const [calendarWeek, setCalendarWeek] = useState(getCurrentWeek());

  // Scout view data
  const [jobsByStatus, setJobsByStatus] = useState<JobsByStatus>({
    pending: [],
    assigned: [],
    inProgress: [],
    completed: [],
  });
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);

  // Applicator view data
  const [myJobs, setMyJobs] = useState<IpmJob[]>([]);

  const fetchScoutData = useCallback(async () => {
    setLoading(true);
    await markOverdueTasks();

    const result = await getJobsForWeek(calendarWeek);
    if (result.success && result.data) {
      setJobsByStatus(result.data.jobs);
      setTaskGroups(result.data.taskGroups);
    } else {
      toast.error('Failed to load jobs');
    }
    setLoading(false);
  }, [calendarWeek]);

  const fetchApplicatorData = useCallback(async () => {
    setLoading(true);
    const result = await getMyJobs();
    if (result.success && result.data) {
      setMyJobs(result.data.jobs);
    } else {
      toast.error('Failed to load your jobs');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (view === 'scout') {
      fetchScoutData();
    } else {
      fetchApplicatorData();
    }
  }, [view, fetchScoutData, fetchApplicatorData]);

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="IPM Applications"
        description={
          view === 'scout'
            ? 'Create and assign spray jobs to applicators'
            : 'View and execute your assigned spray jobs'
        }
      />

      <Tabs value={view} onValueChange={(v) => setView(v as 'scout' | 'applicator')}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="scout" className="gap-2">
            <Eye className="h-4 w-4" />
            Scout View
          </TabsTrigger>
          <TabsTrigger value="applicator" className="gap-2">
            <UserCircle className="h-4 w-4" />
            My Jobs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scout" className="mt-6">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">Loading applications...</p>
            </div>
          ) : (
            <ScoutCommandCenter
              jobsByStatus={jobsByStatus}
              taskGroups={taskGroups}
              calendarWeek={calendarWeek}
              onWeekChange={setCalendarWeek}
              onRefresh={fetchScoutData}
            />
          )}
        </TabsContent>

        <TabsContent value="applicator" className="mt-6">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">Loading your jobs...</p>
            </div>
          ) : (
            <ApplicatorDashboard jobs={myJobs} onRefresh={fetchApplicatorData} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
