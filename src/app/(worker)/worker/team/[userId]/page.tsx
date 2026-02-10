"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  Clock,
  CheckCircle2,
  Activity,
  User,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PullToRefresh } from "@/components/worker/PullToRefresh";
import { vibrateTap, vibrateSuccess } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import type { TeamMemberDetail } from "@/types/worker";

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default function WorkerTeamMemberPage({ params }: PageProps) {
  const { userId } = use(params);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [member, setMember] = useState<TeamMemberDetail | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/worker/team/${userId}`);
      if (res.ok) {
        const json = await res.json();
        setMember(json);
      }
    } catch {
      // Error handled by empty state UI
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = async () => {
    vibrateTap();
    setRefreshing(true);
    await fetchData();
    vibrateSuccess();
    setRefreshing(false);
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatTime = (isoString: string | null): string => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-6 w-48" />
        </div>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="px-4 py-4">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/worker/team">
            <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h2 className="text-lg font-semibold">Team Member Not Found</h2>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>This team member could not be found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh} refreshing={refreshing}>
      <div className="px-4 py-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Link href="/worker/team">
            <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            className="min-h-[44px] min-w-[44px]"
          >
            <RefreshCw className={cn("h-5 w-5", refreshing && "animate-spin")} />
          </Button>
        </div>

        {/* Profile Card */}
        <Card>
          <CardContent className="p-6 text-center">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center font-bold text-2xl text-primary mx-auto mb-4">
              {member.avatarInitials}
            </div>

            {/* Name */}
            <h2 className="text-xl font-semibold mb-1">{member.name}</h2>

            {/* Stats */}
            <div className="flex justify-center gap-6 mt-4">
              <div>
                <div className="text-2xl font-bold text-primary">
                  {member.tasksCompletedToday}
                </div>
                <div className="text-sm text-muted-foreground">Tasks Today</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Task */}
        {member.currentTask && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-500" />
              <h3 className="font-medium">Currently Working On</h3>
            </div>
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{member.currentTask.title}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Started at {formatTime(member.currentTask.startedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1 rounded-full">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">
                      {formatDuration(member.currentTask.durationMinutes)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent Tasks */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            <h3 className="font-medium">Recent Tasks</h3>
          </div>

          {member.recentTasks.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No recent tasks</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 divide-y">
                {member.recentTasks.map((task) => (
                  <div key={task.id} className="p-4 flex items-center gap-3">
                    {task.status === "completed" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <Loader2 className="h-5 w-5 text-blue-500 animate-spin flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{task.title}</div>
                    </div>
                    {task.completedAt && (
                      <div className="text-sm text-muted-foreground flex-shrink-0">
                        {formatTime(task.completedAt)}
                      </div>
                    )}
                    {task.status === "in_progress" && (
                      <Badge
                        variant="outline"
                        className="text-blue-600 border-blue-600 flex-shrink-0"
                      >
                        Active
                      </Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}
