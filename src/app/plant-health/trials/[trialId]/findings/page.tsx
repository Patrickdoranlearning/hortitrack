'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageFrame } from '@/ui/templates';
import { ModulePageHeader } from '@/ui/templates';
import { toast } from '@/lib/toast';
import {
  ChevronLeft,
  Plus,
  Lightbulb,
  CheckCircle,
  AlertCircle,
  Target,
  ClipboardList,
  Loader2,
} from 'lucide-react';
import { getTrial, createFinding, updateFindingStatus } from '@/app/actions/trials';
import type { TrialWithRelations, TrialFinding, FindingType, FindingStatus } from '@/types/trial';

const FINDING_TYPE_CONFIG: Record<FindingType, { label: string; icon: React.ReactNode; color: string }> = {
  observation: { label: 'Observation', icon: <AlertCircle className="h-4 w-4" />, color: 'text-blue-600' },
  conclusion: { label: 'Conclusion', icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-600' },
  recommendation: { label: 'Recommendation', icon: <Target className="h-4 w-4" />, color: 'text-purple-600' },
  action_item: { label: 'Action Item', icon: <ClipboardList className="h-4 w-4" />, color: 'text-orange-600' },
};

const STATUS_CONFIG: Record<FindingStatus, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  reviewed: { label: 'Reviewed', variant: 'outline' },
  approved: { label: 'Approved', variant: 'default' },
  implemented: { label: 'Implemented', variant: 'default' },
};

export default function FindingsPage() {
  const params = useParams();
  const router = useRouter();
  const trialId = params.trialId as string;

  const [trial, setTrial] = useState<TrialWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [findingType, setFindingType] = useState<FindingType>('observation');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [recommendation, setRecommendation] = useState('');

  const fetchTrial = useCallback(async () => {
    setLoading(true);
    const result = await getTrial(trialId);
    if (result.success && result.data) {
      setTrial(result.data);
    } else {
      toast.error('Failed to load trial');
    }
    setLoading(false);
  }, [trialId]);

  useEffect(() => {
    fetchTrial();
  }, [fetchTrial]);

  const resetForm = () => {
    setFindingType('observation');
    setTitle('');
    setDescription('');
    setRecommendation('');
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error('Please fill in title and description');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createFinding({
        trialId,
        findingType,
        title: title.trim(),
        description: description.trim(),
        recommendedProtocolChanges: recommendation.trim() ? { notes: recommendation } : undefined,
      });

      if (result.success) {
        toast.success('Finding added');
        setDialogOpen(false);
        resetForm();
        fetchTrial();
      } else {
        toast.error(result.error || 'Failed to add finding');
      }
    } catch (error) {
      toast.error('Failed to add finding');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusUpdate = async (findingId: string, status: FindingStatus) => {
    const result = await updateFindingStatus(findingId, status);
    if (result.success) {
      toast.success(`Status updated to ${status}`);
      fetchTrial();
    } else {
      toast.error(result.error || 'Failed to update status');
    }
  };

  if (loading) {
    return (
      <PageFrame moduleKey="plantHealth">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageFrame>
    );
  }

  if (!trial) {
    return (
      <PageFrame moduleKey="plantHealth">
        <div className="text-center py-20">
          <Lightbulb className="h-16 w-16 mx-auto text-muted-foreground/50" />
          <p className="mt-4 text-lg text-muted-foreground">Trial not found</p>
        </div>
      </PageFrame>
    );
  }

  const findings = trial.findings || [];
  const groupedFindings = {
    observation: findings.filter((f) => f.findingType === 'observation'),
    conclusion: findings.filter((f) => f.findingType === 'conclusion'),
    recommendation: findings.filter((f) => f.findingType === 'recommendation'),
    action_item: findings.filter((f) => f.findingType === 'action_item'),
  };

  return (
    <PageFrame moduleKey="plantHealth">
      <div className="space-y-6">
        <ModulePageHeader
          title="Trial Findings"
          description={trial.name}
          actionsSlot={
            <div className="flex items-center gap-2">
              <Link href={`/plant-health/trials/${trialId}`}>
                <Button variant="outline" size="sm">
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back to Trial
                </Button>
              </Link>
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Finding
              </Button>
            </div>
          }
        />

        {findings.length === 0 ? (
          <Card className="p-12 text-center">
            <Lightbulb className="h-16 w-16 mx-auto text-muted-foreground/50" />
            <p className="mt-4 text-lg text-muted-foreground">No findings documented yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Document observations, conclusions, and recommendations from your trial.
            </p>
            <Button className="mt-6" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Finding
            </Button>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Observations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-600">
                  <AlertCircle className="h-5 w-5" />
                  Observations ({groupedFindings.observation.length})
                </CardTitle>
                <CardDescription>Notable observations during the trial</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {groupedFindings.observation.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No observations yet</p>
                ) : (
                  groupedFindings.observation.map((finding) => (
                    <FindingCard
                      key={finding.id}
                      finding={finding}
                      onStatusUpdate={handleStatusUpdate}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            {/* Conclusions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  Conclusions ({groupedFindings.conclusion.length})
                </CardTitle>
                <CardDescription>Key conclusions from the trial data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {groupedFindings.conclusion.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No conclusions yet</p>
                ) : (
                  groupedFindings.conclusion.map((finding) => (
                    <FindingCard
                      key={finding.id}
                      finding={finding}
                      onStatusUpdate={handleStatusUpdate}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-600">
                  <Target className="h-5 w-5" />
                  Recommendations ({groupedFindings.recommendation.length})
                </CardTitle>
                <CardDescription>Suggested changes to protocols or processes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {groupedFindings.recommendation.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recommendations yet</p>
                ) : (
                  groupedFindings.recommendation.map((finding) => (
                    <FindingCard
                      key={finding.id}
                      finding={finding}
                      onStatusUpdate={handleStatusUpdate}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            {/* Action Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-600">
                  <ClipboardList className="h-5 w-5" />
                  Action Items ({groupedFindings.action_item.length})
                </CardTitle>
                <CardDescription>Tasks to implement findings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {groupedFindings.action_item.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No action items yet</p>
                ) : (
                  groupedFindings.action_item.map((finding) => (
                    <FindingCard
                      key={finding.id}
                      finding={finding}
                      onStatusUpdate={handleStatusUpdate}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Add Finding Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Finding</DialogTitle>
              <DialogDescription>
                Document an observation, conclusion, or recommendation from this trial.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Finding Type</Label>
                <Select
                  value={findingType}
                  onValueChange={(v) => setFindingType(v as FindingType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FINDING_TYPE_CONFIG).map(([type, config]) => (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center gap-2">
                          {config.icon}
                          {config.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief summary of the finding"
                />
              </div>

              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed description of what was observed or concluded..."
                  className="min-h-[100px]"
                />
              </div>

              {(findingType === 'recommendation' || findingType === 'action_item') && (
                <div className="space-y-2">
                  <Label>Protocol Changes (optional)</Label>
                  <Textarea
                    value={recommendation}
                    onChange={(e) => setRecommendation(e.target.value)}
                    placeholder="What changes should be made to production protocols based on this finding?"
                    className="min-h-[80px]"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Finding'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageFrame>
  );
}

function FindingCard({
  finding,
  onStatusUpdate,
}: {
  finding: TrialFinding;
  onStatusUpdate: (id: string, status: FindingStatus) => void;
}) {
  const statusConfig = STATUS_CONFIG[finding.status];

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-sm">{finding.title}</h4>
        <Badge variant={statusConfig.variant} className="text-xs">
          {statusConfig.label}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{finding.description}</p>
      {finding.recommendedProtocolChanges && (
        <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
          <span className="font-medium">Protocol changes: </span>
          {typeof finding.recommendedProtocolChanges === 'object' &&
          'notes' in finding.recommendedProtocolChanges
            ? finding.recommendedProtocolChanges.notes
            : JSON.stringify(finding.recommendedProtocolChanges)}
        </div>
      )}
      {finding.status !== 'implemented' && (
        <div className="mt-2 flex gap-1">
          {finding.status === 'draft' && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => onStatusUpdate(finding.id!, 'reviewed')}
            >
              Mark Reviewed
            </Button>
          )}
          {finding.status === 'reviewed' && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => onStatusUpdate(finding.id!, 'approved')}
            >
              Approve
            </Button>
          )}
          {finding.status === 'approved' && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => onStatusUpdate(finding.id!, 'implemented')}
            >
              Mark Implemented
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
