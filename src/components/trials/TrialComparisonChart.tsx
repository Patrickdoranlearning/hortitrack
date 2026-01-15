'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState } from 'react';
import type { TrialMeasurement, TrialGroupWithSubjects } from '@/types/trial';

type MetricKey = 'heightCm' | 'leafCount' | 'vigorScore' | 'overallHealthScore' | 'ec' | 'ph';

const METRICS: { key: MetricKey; label: string; unit: string }[] = [
  { key: 'heightCm', label: 'Stem Length', unit: 'cm' },
  { key: 'leafCount', label: 'Leaf Count', unit: '' },
  { key: 'vigorScore', label: 'Vigor Score', unit: '/5' },
  { key: 'overallHealthScore', label: 'Health Score', unit: '/5' },
  { key: 'ec', label: 'EC', unit: 'mS/cm' },
  { key: 'ph', label: 'pH', unit: '' },
];

interface TrialComparisonChartProps {
  groups: TrialGroupWithSubjects[];
  measurements: TrialMeasurement[];
}

export function TrialComparisonChart({ groups, measurements }: TrialComparisonChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('heightCm');

  // Build a map of subjectId -> groupId for quick lookup
  const subjectToGroup = useMemo(() => {
    const map = new Map<string, string>();
    groups.forEach((group) => {
      group.subjects?.forEach((subject) => {
        if (subject.id && group.id) {
          map.set(subject.id, group.id);
        }
      });
    });
    return map;
  }, [groups]);

  // Group measurements by week and calculate averages per group
  const chartData = useMemo(() => {
    // Group measurements by week number
    const byWeek = new Map<number, Map<string, number[]>>();

    measurements.forEach((m) => {
      const groupId = subjectToGroup.get(m.subjectId);
      if (!groupId) return;

      const value = m[selectedMetric];
      if (value === null || value === undefined) return;

      if (!byWeek.has(m.weekNumber)) {
        byWeek.set(m.weekNumber, new Map());
      }

      const weekData = byWeek.get(m.weekNumber)!;
      if (!weekData.has(groupId)) {
        weekData.set(groupId, []);
      }
      weekData.get(groupId)!.push(value as number);
    });

    // Convert to chart format
    const data: Array<{ week: number; [key: string]: number }> = [];

    Array.from(byWeek.entries())
      .sort(([a], [b]) => a - b)
      .forEach(([week, groupData]) => {
        const point: { week: number; [key: string]: number } = { week };

        groups.forEach((group) => {
          if (!group.id) return;
          const values = groupData.get(group.id);
          if (values && values.length > 0) {
            const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
            point[group.id] = Math.round(avg * 10) / 10;
          }
        });

        data.push(point);
      });

    return data;
  }, [measurements, groups, subjectToGroup, selectedMetric]);

  const metric = METRICS.find((m) => m.key === selectedMetric)!;

  // Check if we have any data for the selected metric
  const hasData = chartData.some((point) =>
    groups.some((group) => group.id && point[group.id] !== undefined)
  );

  if (measurements.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Group Comparison</CardTitle>
            <CardDescription>Compare treatment groups over time</CardDescription>
          </div>
          <Select value={selectedMetric} onValueChange={(v) => setSelectedMetric(v as MetricKey)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METRICS.map((m) => (
                <SelectItem key={m.key} value={m.key}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No {metric.label.toLowerCase()} data recorded yet
          </div>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="week"
                  tickFormatter={(v) => `W${v}`}
                  className="text-xs"
                />
                <YAxis
                  className="text-xs"
                  tickFormatter={(v) => `${v}${metric.unit}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelFormatter={(label) => `Week ${label}`}
                  formatter={(value: number, name: string) => {
                    const group = groups.find((g) => g.id === name);
                    return [`${value}${metric.unit}`, group?.name || name];
                  }}
                />
                <Legend
                  formatter={(value) => {
                    const group = groups.find((g) => g.id === value);
                    return group?.name || value;
                  }}
                />
                {groups.map((group) => (
                  <Line
                    key={group.id}
                    type="monotone"
                    dataKey={group.id!}
                    name={group.id!}
                    stroke={group.labelColor || '#6B7280'}
                    strokeWidth={2}
                    dot={{ fill: group.labelColor || '#6B7280', strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
