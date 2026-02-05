'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, UserCheck, Beaker, FlaskConical, MapPin, Leaf } from 'lucide-react';
import { toast } from 'sonner';
import type { IpmJob, JobPriority } from '@/types/ipm-jobs';
import { assignJob } from '@/app/actions/ipm-tasks';
import { createClient } from '@/lib/supabase/client';

type Props = {
  job: IpmJob | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
};

type TeamMember = {
  id: string;
  displayName: string;
  email: string;
};

export function AssignJobSheet({ job, open, onOpenChange, onAssigned }: Props) {
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [priority, setPriority] = useState<JobPriority>('normal');
  const [scoutNotes, setScoutNotes] = useState('');

  // Load team members
  useEffect(() => {
    async function loadTeam() {
      const supabase = createClient();
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.user.id)
        .single();

      if (!profile?.org_id) return;

      const { data: members } = await supabase
        .from('profiles')
        .select('id, display_name, email')
        .eq('org_id', profile.org_id);

      setTeamMembers(
        (members || []).map((m) => ({
          id: m.id,
          displayName: m.display_name || m.email?.split('@')[0] || 'Unknown',
          email: m.email || '',
        }))
      );
    }
    if (open) {
      loadTeam();
    }
  }, [open]);

  // Reset form when job changes
  useEffect(() => {
    if (job) {
      setSelectedMember(job.assignedTo || '');
      setPriority(job.priority || 'normal');
      setScoutNotes(job.scoutNotes || '');
    }
  }, [job]);

  const handleAssign = async () => {
    if (!job || !selectedMember) return;

    setLoading(true);
    const result = await assignJob({
      jobId: job.id,
      assignedTo: selectedMember,
      priority,
      scoutNotes: scoutNotes || undefined,
    });

    if (result.success) {
      toast.success('Job assigned successfully');
      onAssigned();
    } else {
      toast.error(result.error || 'Failed to assign job');
    }
    setLoading(false);
  };

  if (!job) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Assign Job
          </SheetTitle>
          <SheetDescription>Assign this spray job to an applicator</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Job summary */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              {job.product.isTankMix ? (
                <Beaker className="h-4 w-4 text-purple-600" />
              ) : (
                <FlaskConical className="h-4 w-4 text-primary" />
              )}
              <span className="font-medium">{job.name}</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {job.locationCount} locations
              </span>
              <span className="flex items-center gap-1">
                <Leaf className="h-3 w-3" />
                {job.batchCount} batches
              </span>
            </div>
            {job.product.rate && (
              <p className="mt-2 text-sm text-muted-foreground">
                {job.product.method} @ {job.product.rate} {job.product.rateUnit}
              </p>
            )}
          </div>

          {/* Assign to */}
          <div className="space-y-2">
            <Label>Assign To *</Label>
            <Select value={selectedMember} onValueChange={setSelectedMember}>
              <SelectTrigger>
                <SelectValue placeholder="Select team member..." />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as JobPriority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Scout notes */}
          <div className="space-y-2">
            <Label>Notes for Applicator</Label>
            <Textarea
              placeholder="Any special instructions or observations..."
              value={scoutNotes}
              onChange={(e) => setScoutNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={loading || !selectedMember}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <UserCheck className="mr-2 h-4 w-4" />
                Assign Job
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
