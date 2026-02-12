'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Loader2,
  ArrowLeft,
  Users,
  AlertCircle,
} from 'lucide-react';
import { PageFrame } from '@/ui/templates';
import { toast } from '@/lib/toast';
import Link from 'next/link';

// ================================================
// TYPES
// ================================================

interface TeamMember {
  id: string;
  fullName: string | null;
  displayName: string | null;
  email: string | null;
  role: string;
}

interface SizeCategory {
  id: string;
  name: string;
  color: string | null;
  display_order: number;
}

interface Specialization {
  id: string;
  user_id: string;
  category_id: string;
  proficiency: number;
  org_id: string;
  profile: {
    id: string;
    full_name: string | null;
    display_name: string | null;
    email: string | null;
  } | null;
  category: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

// Proficiency level: 0=none, 1=can do, 2=preferred, 3=expert
type ProficiencyLevel = 0 | 1 | 2 | 3;

interface ProficiencyConfig {
  label: string;
  shortLabel: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

const PROFICIENCY_CONFIG: Record<ProficiencyLevel, ProficiencyConfig> = {
  0: {
    label: 'None',
    shortLabel: '-',
    bgColor: 'bg-muted',
    textColor: 'text-muted-foreground',
    borderColor: 'border-transparent',
  },
  1: {
    label: 'Can Do',
    shortLabel: 'C',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    textColor: 'text-yellow-700 dark:text-yellow-400',
    borderColor: 'border-yellow-300 dark:border-yellow-700',
  },
  2: {
    label: 'Preferred',
    shortLabel: 'P',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-700 dark:text-blue-400',
    borderColor: 'border-blue-300 dark:border-blue-700',
  },
  3: {
    label: 'Expert',
    shortLabel: 'E',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-700 dark:text-green-400',
    borderColor: 'border-green-300 dark:border-green-700',
  },
};

// ================================================
// COMPONENT
// ================================================

export default function PickerSpecializationsPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [categories, setCategories] = useState<SizeCategory[]>([]);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCell, setSavingCell] = useState<string | null>(null);

  // Build a lookup map: "userId:categoryId" -> proficiency
  const getSpecKey = (userId: string, categoryId: string) =>
    `${userId}:${categoryId}`;

  const specMap = new Map<string, ProficiencyLevel>();
  for (const spec of specializations) {
    specMap.set(
      getSpecKey(spec.user_id, spec.category_id),
      spec.proficiency as ProficiencyLevel
    );
  }

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [membersRes, categoriesRes, specsRes] = await Promise.all([
        fetch('/api/picking/team-members'),
        fetch('/api/picking/size-categories'),
        fetch('/api/picking/specializations'),
      ]);

      const [membersData, categoriesData, specsData] = await Promise.all([
        membersRes.json(),
        categoriesRes.json(),
        specsRes.json(),
      ]);

      if (!membersRes.ok) {
        throw new Error(membersData.error || 'Failed to load team members');
      }
      if (!categoriesRes.ok) {
        throw new Error(categoriesData.error || 'Failed to load categories');
      }
      if (!specsRes.ok) {
        throw new Error(specsData.error || 'Failed to load specializations');
      }

      setMembers(membersData.members ?? []);
      setCategories(categoriesData.categories ?? []);
      setSpecializations(specsData.specializations ?? []);
    } catch (err) {
      toast.error(err, { fallback: 'Failed to load specialization data' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Cycle through proficiency levels on click
  const cycleProficiency = async (
    userId: string,
    categoryId: string
  ) => {
    const key = getSpecKey(userId, categoryId);
    const current = specMap.get(key) ?? 0;
    const next: ProficiencyLevel = ((current + 1) % 4) as ProficiencyLevel;

    setSavingCell(key);

    try {
      if (next === 0) {
        // Remove the specialization
        const res = await fetch('/api/picking/specializations', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, categoryId }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to remove specialization');
        }

        // Update local state
        setSpecializations((prev) =>
          prev.filter(
            (s) => !(s.user_id === userId && s.category_id === categoryId)
          )
        );
      } else {
        // Upsert the specialization
        const res = await fetch('/api/picking/specializations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, categoryId, proficiency: next }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to update specialization');
        }

        // Update local state
        setSpecializations((prev) => {
          const existing = prev.findIndex(
            (s) => s.user_id === userId && s.category_id === categoryId
          );
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = data.specialization;
            return updated;
          }
          return [...prev, data.specialization];
        });
      }
    } catch (err) {
      toast.error(err, { fallback: 'Failed to update proficiency' });
    } finally {
      setSavingCell(null);
    }
  };

  // Get display name for a member
  const getMemberName = (member: TeamMember): string =>
    member.displayName || member.fullName || member.email || 'Unknown';

  return (
    <PageFrame moduleKey="production">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="mb-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/settings">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back to Settings
                </Link>
              </Button>
            </div>
            <h1 className="font-headline text-3xl">Picker Specializations</h1>
            <p className="text-muted-foreground mt-1">
              Assign pickers to size categories with proficiency levels. Click a
              cell to cycle through levels. This data is used for smart task
              assignment during picking.
            </p>
          </div>
        </div>

        {/* Legend */}
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4">
            <div className="flex gap-3">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  Proficiency Levels
                </p>
                <div className="flex flex-wrap gap-3 mt-2">
                  {([0, 1, 2, 3] as ProficiencyLevel[]).map((level) => {
                    const config = PROFICIENCY_CONFIG[level];
                    return (
                      <div key={level} className="flex items-center gap-1.5">
                        <div
                          className={`h-6 w-6 rounded border text-xs font-medium flex items-center justify-center ${config.bgColor} ${config.textColor} ${config.borderColor}`}
                        >
                          {config.shortLabel}
                        </div>
                        <span className="text-blue-700 dark:text-blue-300">
                          {config.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-blue-700 dark:text-blue-300 mt-2">
                  Click any cell to cycle through proficiency levels. Changes are saved automatically.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Matrix */}
        <Card>
          <CardHeader>
            <CardTitle>Specialization Matrix</CardTitle>
            <CardDescription>
              Team members (rows) vs. size categories (columns). Click a cell to
              set the proficiency level.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : members.length === 0 || categories.length === 0 ? (
              <div className="text-center py-8 border rounded-lg bg-muted/50">
                <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {members.length === 0
                    ? 'No team members found'
                    : 'No size categories configured'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {members.length === 0
                    ? 'Invite team members in Settings > Team Members first.'
                    : 'Create size categories in Settings > Picking Categories first.'}
                </p>
                <Button asChild variant="outline" className="mt-4">
                  <Link
                    href={
                      members.length === 0
                        ? '/settings/team'
                        : '/settings/size-categories'
                    }
                  >
                    {members.length === 0
                      ? 'Manage Team'
                      : 'Manage Categories'}
                  </Link>
                </Button>
              </div>
            ) : (
              <TooltipProvider delayDuration={200}>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-card z-10 min-w-[180px]">
                          Team Member
                        </TableHead>
                        {categories.map((cat) => (
                          <TableHead
                            key={cat.id}
                            className="text-center min-w-[100px]"
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              <div
                                className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                                style={{
                                  backgroundColor: cat.color || '#64748b',
                                }}
                              />
                              <span className="text-xs">{cat.name}</span>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="sticky left-0 bg-card z-10 font-medium">
                            <div>
                              <div className="text-sm">
                                {getMemberName(member)}
                              </div>
                              {member.email && (
                                <div className="text-xs text-muted-foreground">
                                  {member.email}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          {categories.map((cat) => {
                            const key = getSpecKey(member.id, cat.id);
                            const level = specMap.get(key) ?? 0;
                            const config =
                              PROFICIENCY_CONFIG[level as ProficiencyLevel];
                            const isSaving = savingCell === key;

                            return (
                              <TableCell
                                key={cat.id}
                                className="text-center p-1"
                              >
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      disabled={isSaving}
                                      onClick={() =>
                                        cycleProficiency(member.id, cat.id)
                                      }
                                      className={`
                                        h-9 w-full min-w-[60px] rounded border text-sm font-medium
                                        transition-all cursor-pointer
                                        ${config.bgColor} ${config.textColor} ${config.borderColor}
                                        hover:opacity-80 active:scale-95
                                        disabled:opacity-50 disabled:cursor-wait
                                      `}
                                    >
                                      {isSaving ? (
                                        <Loader2 className="h-3 w-3 animate-spin mx-auto" />
                                      ) : (
                                        config.shortLabel
                                      )}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>
                                      {getMemberName(member)} - {cat.name}:{' '}
                                      <span className="font-medium">
                                        {config.label}
                                      </span>
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Click to change
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TooltipProvider>
            )}
          </CardContent>
        </Card>
      </div>
    </PageFrame>
  );
}
