"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  RefreshCw,
  Clock,
  CheckCircle2,
  ChevronRight,
  Activity,
  TrendingUp,
  User,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PullToRefresh } from "@/components/worker/PullToRefresh";
import { vibrateTap, vibrateSuccess } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import type { TeamActivityResponse } from "@/types/worker";

export default function WorkerTeamPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<TeamActivityResponse | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/worker/team");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Error handled by empty state UI
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

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

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <PullToRefresh onRefresh={handleRefresh} refreshing={refreshing}>
      <div className="px-4 py-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Team Activity
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="min-h-[44px] min-w-[44px]"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : data ? (
          <>
            {/* My Stats Comparison */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">
                        My Tasks Today
                      </div>
                      <div className="text-2xl font-bold">
                        {data.myStats.completedToday}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Team Avg</div>
                    <div className="text-2xl font-bold text-muted-foreground">
                      {data.myStats.teamAverage}
                    </div>
                  </div>
                </div>
                {data.myStats.completedToday > data.myStats.teamAverage && (
                  <div className="mt-3 text-sm text-green-600 flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" />
                    Above team average!
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right Now - Active Workers */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-500" />
                <h3 className="font-medium">Right Now</h3>
                {data.rightNow.length > 0 && (
                  <Badge
                    variant="outline"
                    className="text-green-600 border-green-600"
                  >
                    {data.rightNow.length} active
                  </Badge>
                )}
              </div>

              {data.rightNow.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No one is working on a task right now</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {data.rightNow.map((member) => (
                    <Link key={member.id} href={`/worker/team/${member.id}`}>
                      <Card className="transition-all active:scale-[0.99]">
                        <CardContent className="p-4 flex items-center gap-3">
                          {/* Avatar */}
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary flex-shrink-0">
                            {member.avatarInitials}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {member.name}
                            </div>
                            {member.currentTask && (
                              <div className="text-sm text-muted-foreground truncate">
                                {member.currentTask.title}
                              </div>
                            )}
                          </div>

                          {/* Duration */}
                          {member.currentTask && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground flex-shrink-0">
                              <Clock className="h-4 w-4" />
                              {formatDuration(member.currentTask.durationMinutes)}
                            </div>
                          )}

                          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Completed Today */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <h3 className="font-medium">Completed Today</h3>
                <Badge variant="secondary">
                  {data.completedToday.length}
                </Badge>
              </div>

              {data.completedToday.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No tasks completed yet today</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-0 divide-y">
                    {data.completedToday.map((task) => (
                      <div
                        key={task.id}
                        className="p-4 flex items-center gap-3"
                      >
                        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{task.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {task.completedByName}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground flex-shrink-0">
                          {formatTime(task.completedAt)}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Unable to load team activity</p>
              <Button variant="outline" className="mt-4" onClick={handleRefresh}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </PullToRefresh>
  );
}
