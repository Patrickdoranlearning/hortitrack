'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageFrame } from '@/ui/templates';
import { ModulePageHeader } from '@/ui/templates';
import {
  Plus,
  FlaskConical,
  Calendar,
  Users,
  BarChart3,
  Clock,
  CheckCircle2,
  PauseCircle,
  Archive,
  FileEdit,
  Loader2,
} from 'lucide-react';
import { listTrials } from '@/app/actions/trials';
import type { TrialSummary, TrialStatus } from '@/types/trial';

const STATUS_CONFIG: Record<TrialStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: React.ReactNode }> = {
  draft: { label: 'Draft', variant: 'secondary', icon: <FileEdit className="h-3 w-3" /> },
  active: { label: 'Active', variant: 'default', icon: <Clock className="h-3 w-3" /> },
  paused: { label: 'Paused', variant: 'outline', icon: <PauseCircle className="h-3 w-3" /> },
  completed: { label: 'Completed', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
  archived: { label: 'Archived', variant: 'secondary', icon: <Archive className="h-3 w-3" /> },
};

export default function TrialsPage() {
  const [trials, setTrials] = useState<TrialSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');

  const fetchTrials = useCallback(async () => {
    setLoading(true);
    const result = await listTrials();
    if (result.success && result.data) {
      setTrials(result.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTrials();
  }, [fetchTrials]);

  const filteredTrials = trials.filter((trial) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'active') return trial.status === 'active';
    if (activeTab === 'draft') return trial.status === 'draft';
    if (activeTab === 'completed') return trial.status === 'completed' || trial.status === 'archived';
    return true;
  });

  const activeCount = trials.filter((t) => t.status === 'active').length;
  const draftCount = trials.filter((t) => t.status === 'draft').length;
  const completedCount = trials.filter((t) => t.status === 'completed' || t.status === 'archived').length;

  return (
    <PageFrame moduleKey="plantHealth">
      <div className="space-y-6">
        <ModulePageHeader
          title="Scientific Trials"
          description="A/B/C comparison trials for varieties, treatments, and processes"
          actionsSlot={
            <Link href="/plant-health/trials/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Trial
              </Button>
            </Link>
          }
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All ({trials.length})</TabsTrigger>
            <TabsTrigger value="active">Active ({activeCount})</TabsTrigger>
            <TabsTrigger value="draft">Draft ({draftCount})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedCount})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTrials.length === 0 ? (
              <Card className="p-12 text-center">
                <FlaskConical className="h-16 w-16 mx-auto text-muted-foreground/50" />
                <p className="mt-4 text-lg text-muted-foreground">
                  {activeTab === 'all' ? 'No trials yet' : `No ${activeTab} trials`}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create a trial to start tracking scientific experiments on your crops.
                </p>
                <Link href="/plant-health/trials/new">
                  <Button className="mt-6">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Trial
                  </Button>
                </Link>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredTrials.map((trial) => (
                  <TrialCard key={trial.id} trial={trial} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageFrame>
  );
}

function TrialCard({ trial }: { trial: TrialSummary }) {
  const statusConfig = STATUS_CONFIG[trial.status];

  return (
    <Link href={`/plant-health/trials/${trial.id}`}>
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-mono">{trial.trialNumber}</p>
              <h3 className="font-semibold line-clamp-2">{trial.name}</h3>
            </div>
            <Badge variant={statusConfig.variant} className="gap-1 shrink-0">
              {statusConfig.icon}
              {statusConfig.label}
            </Badge>
          </div>

          {trial.varietyName && (
            <p className="text-sm text-muted-foreground line-clamp-1">
              {trial.varietyName}
            </p>
          )}

          <div className="flex flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>{trial.groupCount} groups</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <FlaskConical className="h-3 w-3" />
              <span>{trial.subjectCount} subjects</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <BarChart3 className="h-3 w-3" />
              <span>{trial.measurementCount} measurements</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            {trial.status === 'active' && (
              <Badge variant="outline" className="text-xs">
                Week {trial.currentWeek}
              </Badge>
            )}
            {trial.startDate && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>
                  {new Date(trial.startDate).toLocaleDateString('en-IE', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}
            {!trial.startDate && trial.status === 'draft' && (
              <span className="text-xs text-muted-foreground">Not started</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
