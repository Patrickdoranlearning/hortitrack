"use client";

import * as React from "react";
import Link from "next/link";
import type { PlantHealthEvent } from "@/lib/history-types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Bug,
  Droplets,
  Ruler,
  CheckCircle,
  Scissors,
  Leaf,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";

const TYPE_META: Record<string, {
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
  icon: React.ElementType;
  color: string;
}> = {
  treatment: { label: "Treatment", variant: "destructive", icon: Bug, color: "text-rose-600" },
  scout_flag: { label: "Scout Flag", variant: "destructive", icon: Bug, color: "text-orange-600" },
  measurement: { label: "Measurement", variant: "outline", icon: Ruler, color: "text-sky-600" },
  clearance: { label: "Clearance", variant: "default", icon: CheckCircle, color: "text-emerald-600" },
  irrigation: { label: "Irrigation", variant: "outline", icon: Droplets, color: "text-blue-500" },
  fertilize: { label: "Fertilizing", variant: "secondary", icon: Leaf, color: "text-green-600" },
  pruning: { label: "Pruning", variant: "outline", icon: Scissors, color: "text-amber-600" },
  grading: { label: "Grading", variant: "outline", icon: CheckCircle, color: "text-violet-600" },
};

interface PlantHealthLogProps {
  logs: PlantHealthEvent[];
  showBatchLink?: boolean;
  compact?: boolean;
}

type GroupBy = 'none' | 'date' | 'type' | 'product';

export function PlantHealthLog({ logs, showBatchLink = false, compact = false }: PlantHealthLogProps) {
  const [q, setQ] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("");
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = React.useState<GroupBy>('none');
  const [dateRange, setDateRange] = React.useState<'all' | '7d' | '30d' | '90d'>('all');

  // Apply date range filter
  const dateFiltered = React.useMemo(() => {
    if (dateRange === 'all') return logs;
    const now = new Date();
    const daysAgo = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const cutoff = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    return logs.filter(l => new Date(l.at) >= cutoff);
  }, [logs, dateRange]);

  const filtered = dateFiltered.filter(l => {
    const typeMatch = typeFilter ? l.type === typeFilter : true;
    const searchMatch = q
      ? (l.title?.toLowerCase().includes(q.toLowerCase()) ||
         l.productName?.toLowerCase().includes(q.toLowerCase()) ||
         l.details?.toLowerCase().includes(q.toLowerCase()) ||
         l.reasonForUse?.toLowerCase().includes(q.toLowerCase()))
      : true;
    return typeMatch && searchMatch;
  });

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const uniqueTypes = [...new Set(logs.map(l => l.type))];

  // Group logs based on groupBy selection
  const groupedLogs = React.useMemo(() => {
    if (groupBy === 'none') return { '': filtered };

    return filtered.reduce((acc, log) => {
      let key: string;
      switch (groupBy) {
        case 'date':
          key = new Date(log.at).toLocaleDateString();
          break;
        case 'type':
          key = TYPE_META[log.type]?.label || log.type;
          break;
        case 'product':
          key = log.productName || 'No Product';
          break;
        default:
          key = '';
      }
      if (!acc[key]) acc[key] = [];
      acc[key].push(log);
      return acc;
    }, {} as Record<string, PlantHealthEvent[]>);
  }, [filtered, groupBy]);

  // Sort group keys (dates should be most recent first)
  const sortedGroupKeys = React.useMemo(() => {
    const keys = Object.keys(groupedLogs);
    if (groupBy === 'date') {
      return keys.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    }
    return keys.sort();
  }, [groupedLogs, groupBy]);

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex flex-wrap gap-2 items-center">
          <input
            placeholder="Search health logs..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm flex-1 min-w-[150px]"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm"
          >
            <option value="">All types</option>
            {uniqueTypes.map(type => {
              const meta = TYPE_META[type] || { label: type };
              return <option key={type} value={type}>{meta.label}</option>;
            })}
          </select>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
            className="px-3 py-2 rounded-lg border text-sm"
          >
            <option value="all">All time</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="px-3 py-2 rounded-lg border text-sm"
          >
            <option value="none">No grouping</option>
            <option value="date">Group by date</option>
            <option value="type">Group by type</option>
            <option value="product">Group by product</option>
          </select>
          <div className="text-xs text-muted-foreground">{filtered.length} logs</div>
        </div>
      )}

      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[30px]"></TableHead>
                <TableHead className="w-[90px]">Date</TableHead>
                <TableHead className="w-[110px]">Type</TableHead>
                {showBatchLink && <TableHead className="w-[100px]">Batch</TableHead>}
                <TableHead>Title / Product</TableHead>
                <TableHead className="w-[100px]">Readings</TableHead>
                <TableHead className="hidden sm:table-cell w-[80px]">By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showBatchLink ? 7 : 6} className="text-center text-muted-foreground py-8">
                    No plant health logs found.
                  </TableCell>
                </TableRow>
              ) : (
                sortedGroupKeys.map((groupKey) => (
                  <React.Fragment key={groupKey || 'ungrouped'}>
                    {/* Group header row */}
                    {groupBy !== 'none' && groupKey && (
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={showBatchLink ? 7 : 6} className="py-2 font-semibold text-sm">
                          {groupKey}
                          <span className="ml-2 font-normal text-muted-foreground">
                            ({groupedLogs[groupKey].length} {groupedLogs[groupKey].length === 1 ? 'log' : 'logs'})
                          </span>
                        </TableCell>
                      </TableRow>
                    )}
                    {/* Logs in this group */}
                    {groupedLogs[groupKey].map((log) => {
                  const meta = TYPE_META[log.type] || { label: log.type, variant: "outline" as const, icon: Leaf, color: "text-muted-foreground" };
                  const Icon = meta.icon;
                  const isExpanded = expandedRows.has(log.id);
                  const hasDetails = log.type === 'treatment' && (log.productName || log.rate || log.method);

                  return (
                    <React.Fragment key={log.id}>
                      <TableRow
                        className={hasDetails ? "cursor-pointer hover:bg-muted/50" : ""}
                        onClick={() => hasDetails && toggleRow(log.id)}
                      >
                        <TableCell className="p-2">
                          {hasDetails ? (
                            isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )
                          ) : null}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.at).toLocaleDateString()}
                          <br />
                          <span className="text-[10px]">
                            {new Date(log.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                            <Badge variant={meta.variant} className="text-xs">
                              {meta.label}
                            </Badge>
                          </div>
                        </TableCell>
                        {showBatchLink && (
                          <TableCell>
                            <Link
                              href={`/production/batches/${log.batchId}`}
                              className="text-xs text-violet-600 hover:underline flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {log.batchNumber || 'View'}
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                            {log.varietyName && (
                              <div className="text-[10px] text-muted-foreground">{log.varietyName}</div>
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="font-medium text-sm">{log.title}</div>
                            {log.productName && log.productName !== log.title && (
                              <div className="text-xs text-muted-foreground">{log.productName}</div>
                            )}
                            {log.photos && log.photos.length > 0 && (
                              <div className="flex items-center gap-1 text-xs text-sky-600">
                                <ImageIcon className="h-3 w-3" />
                                {log.photos.length} photo{log.photos.length > 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5 text-xs">
                            {log.phReading != null && (
                              <div>pH: <span className="font-mono font-medium">{log.phReading}</span></div>
                            )}
                            {log.ecReading != null && (
                              <div>EC: <span className="font-mono font-medium">{log.ecReading}</span></div>
                            )}
                            {log.phReading == null && log.ecReading == null && (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                          {log.signedBy ?? log.userName ?? "—"}
                        </TableCell>
                      </TableRow>

                      {/* Expanded details row for treatments */}
                      {hasDetails && isExpanded && (
                        <TableRow className="bg-muted/20">
                          <TableCell colSpan={showBatchLink ? 7 : 6} className="py-3">
                            <TreatmentDetails log={log} />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Summary by type */}
      {!compact && filtered.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground justify-end">
          {Object.entries(
            filtered.reduce((acc, log) => {
              acc[log.type] = (acc[log.type] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          ).map(([type, count]) => {
            const meta = TYPE_META[type] || { label: type, color: 'text-muted-foreground' };
            return (
              <span key={type} className="flex items-center gap-1">
                <span className={meta.color}>{meta.label}:</span>
                <span className="font-semibold">{count}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TreatmentDetails({ log }: { log: PlantHealthEvent }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm px-2">
      {log.productName && (
        <div>
          <div className="text-xs text-muted-foreground">Product</div>
          <div className="font-medium">{log.productName}</div>
        </div>
      )}
      {(log.rate || log.unit) && (
        <div>
          <div className="text-xs text-muted-foreground">Rate</div>
          <div className="font-medium">{log.rate} {log.unit}</div>
        </div>
      )}
      {log.method && (
        <div>
          <div className="text-xs text-muted-foreground">Method</div>
          <div className="font-medium">{log.method}</div>
        </div>
      )}
      {log.reasonForUse && (
        <div>
          <div className="text-xs text-muted-foreground">Reason</div>
          <div className="font-medium">{log.reasonForUse}</div>
        </div>
      )}
      {log.weatherConditions && (
        <div>
          <div className="text-xs text-muted-foreground">Weather</div>
          <div className="font-medium">{log.weatherConditions}</div>
        </div>
      )}
      {log.areaTreated && (
        <div>
          <div className="text-xs text-muted-foreground">Area Treated</div>
          <div className="font-medium">{log.areaTreated}</div>
        </div>
      )}
      {log.sprayerUsed && (
        <div>
          <div className="text-xs text-muted-foreground">Sprayer</div>
          <div className="font-medium">{log.sprayerUsed}</div>
        </div>
      )}
      {log.safeHarvestDate && (
        <div>
          <div className="text-xs text-muted-foreground">Safe Harvest Date</div>
          <div className="font-medium text-orange-600">
            {new Date(log.safeHarvestDate).toLocaleDateString()}
            {log.harvestIntervalDays && ` (${log.harvestIntervalDays} days)`}
          </div>
        </div>
      )}
    </div>
  );
}
