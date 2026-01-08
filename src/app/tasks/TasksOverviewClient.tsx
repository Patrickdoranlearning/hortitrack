"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowRight,
  Calendar,
  Clock,
  Play,
  Sprout,
  ShieldCheck,
  Truck,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ModulePageHeader } from '@/ui/templates';
import { EmployeeSchedule } from "./components/EmployeeSchedule";
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/http/fetchJson";
import type { Task, StaffMember } from "@/server/tasks/service";
import type { ProductionJob } from "@/server/production/jobs";

type Props = {
  allTasks: Task[];
  myTasks: Task[];
  jobs: ProductionJob[];
  staff: StaffMember[]; // for future use
  currentUserId: string | null;
};

export default function TasksOverviewClient({
  allTasks,
  myTasks,
  jobs,
  currentUserId,
}: Props) {
  const { toast } = useToast();

  // Calculate stats
  const stats = React.useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    
    return {
      myTasksToday: myTasks.filter((t) => t.scheduledDate === todayStr).length,
      myInProgress: myTasks.filter((t) => t.status === "in_progress").length,
      totalPending: allTasks.filter((t) => t.status === "pending" || t.status === "assigned").length,
      unassignedJobs: jobs.filter((j) => j.status === "unassigned").length,
      productionTasks: allTasks.filter((t) => t.sourceModule === "production").length,
      dispatchTasks: allTasks.filter((t) => t.sourceModule === "dispatch").length,
      healthTasks: allTasks.filter((t) => t.sourceModule === "plant_health").length,
    };
  }, [allTasks, myTasks, jobs]);

  // Module links
  const moduleLinks = [
    {
      title: "Production Tasks",
      href: "/tasks/production",
      icon: Sprout,
      count: stats.productionTasks,
      unassigned: jobs.filter((j) => j.status === "unassigned").length,
      description: "Potting, propagation, and growing tasks",
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/30",
    },
    {
      title: "Plant Health Tasks",
      href: "/tasks/plant-health",
      icon: ShieldCheck,
      count: stats.healthTasks,
      unassigned: 0,
      description: "IPM, inspections, and treatments",
      color: "text-amber-600",
      bgColor: "bg-amber-50 dark:bg-amber-950/30",
    },
    {
      title: "Dispatch Tasks",
      href: "/tasks/dispatch",
      icon: Truck,
      count: stats.dispatchTasks,
      unassigned: 0,
      description: "Picking, packing, and loading",
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
    },
  ];

  const handleStartTask = async (task: Task) => {
    try {
      await fetchJson(`/api/tasks/${task.id}/start`, { method: "POST" });
      toast({ title: "Task started" });
      // In a real app, we'd refresh data here
    } catch (error) {
      toast({
        title: "Failed to start task",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Tasks Overview"
        description="Your central hub for managing work across all modules."
      />

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              My Tasks Today
            </CardDescription>
            <CardTitle className="text-3xl">{stats.myTasksToday}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Play className="h-4 w-4" />
              In Progress
            </CardDescription>
            <CardTitle className="text-3xl text-amber-600">{stats.myInProgress}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              Pending Tasks
            </CardDescription>
            <CardTitle className="text-3xl">{stats.totalPending}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" />
              Unassigned Jobs
            </CardDescription>
            <CardTitle className="text-3xl text-red-600">{stats.unassignedJobs}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        {/* My Schedule */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>My Schedule</CardTitle>
                <CardDescription>Your assigned tasks for today and upcoming.</CardDescription>
              </div>
              {myTasks.length > 0 && (
                <Badge variant="secondary">{myTasks.length} tasks</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {currentUserId ? (
              <EmployeeSchedule
                tasks={myTasks}
                onStartTask={handleStartTask}
                onOpenTask={() => {}}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="mx-auto h-12 w-12 mb-4" />
                <p>Sign in to view your schedule</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Module Quick Links */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Task Categories</h3>
          {moduleLinks.map((module) => (
            <Link key={module.href} href={module.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${module.bgColor}`}>
                      <module.icon className={`h-6 w-6 ${module.color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{module.title}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-xs text-muted-foreground">{module.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {module.count} active
                        </Badge>
                        {module.unassigned > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {module.unassigned} unassigned
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Unassigned Jobs Alert */}
      {stats.unassignedJobs > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Jobs Awaiting Assignment
            </CardTitle>
            <CardDescription>
              {stats.unassignedJobs} production job{stats.unassignedJobs !== 1 ? "s" : ""} need to be assigned to staff.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {jobs
                .filter((j) => j.status === "unassigned")
                .slice(0, 5)
                .map((job) => (
                  <Badge key={job.id} variant="outline" className="text-sm py-1">
                    {job.name}
                    <span className="ml-1.5 text-muted-foreground">
                      ({job.totalPlants.toLocaleString()} plants)
                    </span>
                  </Badge>
                ))}
              {stats.unassignedJobs > 5 && (
                <Badge variant="outline" className="text-sm py-1">
                  +{stats.unassignedJobs - 5} more
                </Badge>
              )}
            </div>
            <div className="mt-4">
              <Link href="/tasks/production">
                <Button>
                  View Production Tasks
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

