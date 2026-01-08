'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Printer,
  MapPin,
  Sprout,
  Package,
  Calendar,
  ChevronRight,
  ShieldAlert,
  Clock,
  SprayCan,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  Bug,
} from 'lucide-react';
import type { NurseryLocation, Batch } from '@/lib/types';
import { useBatchDetailDialog } from '@/stores/useBatchDetailDialog';
import { TreatmentDialog, MeasurementDialog, SpotTreatmentDialog } from '@/components/plant-health';
import { getLocationHealthLogs, clearLocation } from '@/app/actions/plant-health';
import { listIpmAssignments, listIpmSpotTreatments, type IpmAssignment, type IpmSpotTreatment } from '@/app/actions/ipm';
import { toast } from 'sonner';

type LocationWithBatches = NurseryLocation & {
  batches: Batch[];
  batchCount: number;
  totalQuantity: number;
};

type LocationDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: LocationWithBatches | null;
  onPrintLabel: (location: LocationWithBatches) => void;
};

// Health log type for display
type HealthLog = {
  id: string;
  event_type: string;
  event_at: string;
  product_name?: string;
  rate?: number;
  unit?: string;
  method?: string;
  ec_reading?: number;
  ph_reading?: number;
  issue_reason?: string;
  severity?: string;
  notes?: string;
};

export function LocationDetailDialog({
  open,
  onOpenChange,
  location,
  onPrintLabel,
}: LocationDetailDialogProps) {
  const batchDialog = useBatchDetailDialog();
  const locationBatches = location?.batches ?? [];
  const [healthLogs, setHealthLogs] = React.useState<HealthLog[]>([]);
  const [loadingLogs, setLoadingLogs] = React.useState(false);
  const [clearingLocation, setClearingLocation] = React.useState(false);
  const [ipmAssignments, setIpmAssignments] = React.useState<IpmAssignment[]>([]);
  const [spotTreatments, setSpotTreatments] = React.useState<IpmSpotTreatment[]>([]);

  // Fetch health logs and IPM data when dialog opens
  React.useEffect(() => {
    if (open && location?.id) {
      setLoadingLogs(true);
      
      // Fetch health logs
      getLocationHealthLogs(location.id)
        .then((result) => {
          if (result.success && result.data) {
            setHealthLogs(result.data as HealthLog[]);
          }
        })
        .finally(() => setLoadingLogs(false));

      // Fetch IPM assignments for this location
      listIpmAssignments({ locationId: location.id, activeOnly: true })
        .then((result) => {
          if (result.success && result.data) {
            setIpmAssignments(result.data);
          }
        });

      // Fetch spot treatments for this location
      listIpmSpotTreatments({ locationId: location.id })
        .then((result) => {
          if (result.success && result.data) {
            setSpotTreatments(result.data.filter(t => t.status !== 'completed' && t.status !== 'cancelled'));
          }
        });
    }
  }, [open, location?.id]);

  // Calculate restriction time remaining
  const restrictionInfo = React.useMemo(() => {
    if (!location?.restrictedUntil) return null;
    const until = new Date(location.restrictedUntil);
    const now = new Date();
    if (until <= now) return null;
    
    const diffMs = until.getTime() - now.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return {
      until,
      hoursRemaining: hours,
      minutesRemaining: minutes,
      text: hours > 0 ? `${hours}h ${minutes}m remaining` : `${minutes}m remaining`,
    };
  }, [location?.restrictedUntil]);

  const handleClearLocation = async () => {
    if (!location?.id) return;
    setClearingLocation(true);
    try {
      const result = await clearLocation({ locationId: location.id });
      if (result.success) {
        toast.success('Location cleared', { description: 'Health status set to clean' });
        // Refresh logs
        const logsResult = await getLocationHealthLogs(location.id);
        if (logsResult.success && logsResult.data) {
          setHealthLogs(logsResult.data as HealthLog[]);
        }
      } else {
        toast.error(result.error);
      }
    } finally {
      setClearingLocation(false);
    }
  };

  const refreshHealthLogs = async () => {
    if (!location?.id) return;
    const result = await getLocationHealthLogs(location.id);
    if (result.success && result.data) {
      setHealthLogs(result.data as HealthLog[]);
    }
  };

  // Group batches by status
  const batchesByStatus = React.useMemo(() => {
    const groups: Record<string, Batch[]> = {};
    locationBatches.forEach((batch) => {
      const status = batch.status || 'Unknown';
      if (!groups[status]) groups[status] = [];
      groups[status].push(batch);
    });
    return groups;
  }, [locationBatches]);

  // Get variety breakdown
  const varietyBreakdown = React.useMemo(() => {
    const counts: Record<string, { name: string; family?: string; count: number; batches: number }> = {};
    locationBatches.forEach((batch) => {
      const name = batch.plantVariety || 'Unknown';
      if (!counts[name]) {
        counts[name] = { name, family: batch.plantFamily, count: 0, batches: 0 };
      }
      counts[name].count += batch.quantity ?? 0;
      counts[name].batches += 1;
    });
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [locationBatches]);

  // Get potting date summary
  const pottingDates = React.useMemo(() => {
    const dates: { date: string; count: number }[] = [];
    const dateCounts: Record<string, number> = {};
    locationBatches.forEach((batch) => {
      const date = batch.plantedAt || batch.plantingDate;
      if (date) {
        const dateStr = new Date(date).toLocaleDateString();
        dateCounts[dateStr] = (dateCounts[dateStr] || 0) + (batch.quantity ?? 0);
      }
    });
    Object.entries(dateCounts)
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .forEach(([date, count]) => {
        dates.push({ date, count });
      });
    return dates.slice(0, 5);
  }, [locationBatches]);

  if (!location) return null;

  const handleViewBatch = (batch: Batch) => {
    onOpenChange(false);
    setTimeout(() => {
      batchDialog.open(batch.id!);
    }, 100);
  };

  const getTypeIcon = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'tunnel':
        return '🏕️';
      case 'glasshouse':
        return '🏠';
      case 'outdoor':
        return '🌳';
      case 'polytunnel':
        return '🌿';
      default:
        return '📍';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] grid-rows-[auto_1fr]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{getTypeIcon(location.type)}</span>
              <div>
                <DialogTitle className="font-headline text-2xl">{location.name}</DialogTitle>
                <DialogDescription>
                  {location.nurserySite || 'Main'} • {location.type || 'Section'}
                  {location.siteId && ` • ID: ${location.siteId}`}
                </DialogDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.open(`/production/locations/${location.id}/print`, '_blank', 'noopener')}
              >
                <Printer className="mr-2 h-4 w-4" />
                Desktop (A4)
              </Button>
              <Button variant="outline" size="sm" onClick={() => onPrintLabel(location)}>
                <Printer className="mr-2 h-4 w-4" />
                Label Printer
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto pr-2 -mr-2">
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <Package className="h-6 w-6 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold">{location.batchCount}</p>
              <p className="text-xs text-muted-foreground">Batches</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <Sprout className="h-6 w-6 mx-auto text-emerald-600 mb-2" />
              <p className="text-2xl font-bold">{location.totalQuantity.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Plants</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <MapPin className="h-6 w-6 mx-auto text-blue-600 mb-2" />
              <p className="text-2xl font-bold">{location.area ? `${location.area}m²` : '—'}</p>
              <p className="text-xs text-muted-foreground">Area</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <Calendar className="h-6 w-6 mx-auto text-amber-600 mb-2" />
              <p className="text-2xl font-bold">{varietyBreakdown.length}</p>
              <p className="text-xs text-muted-foreground">Varieties</p>
            </div>
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant={location.covered ? 'default' : 'outline'}>
              {location.covered ? '🏠 Covered' : '☀️ Uncovered'}
            </Badge>
            {/* Health Status Badge */}
            {location.healthStatus === 'restricted' && restrictionInfo && (
              <Badge variant="destructive" className="gap-1">
                <ShieldAlert className="h-3 w-3" />
                Restricted — {restrictionInfo.text}
              </Badge>
            )}
            {location.healthStatus === 'infested' && (
              <Badge variant="destructive" className="gap-1">
                <Bug className="h-3 w-3" />
                Infested
              </Badge>
            )}
            {location.healthStatus === 'clean' && (
              <Badge variant="outline" className="gap-1 text-green-700 border-green-300 bg-green-50 dark:bg-green-950/30">
                <CheckCircle2 className="h-3 w-3" />
                Clean
              </Badge>
            )}
            {Object.entries(batchesByStatus).map(([status, batches]) => (
              <Badge key={status} variant="secondary">
                {status}: {batches.length}
              </Badge>
            ))}
          </div>

          <Tabs defaultValue="batches">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="batches">Batches</TabsTrigger>
              <TabsTrigger value="varieties">Varieties</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="health" className="gap-1">
                <SprayCan className="h-3 w-3" />
                Health
              </TabsTrigger>
            </TabsList>

            <TabsContent value="batches" className="mt-4">
              {location.batches.length > 0 ? (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Batch #</TableHead>
                        <TableHead>Variety</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Potted</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {location.batches.map((batch) => (
                        <TableRow
                          key={batch.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleViewBatch(batch)}
                        >
                          <TableCell className="font-mono text-sm">
                            {batch.batchNumber}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{batch.plantVariety || '—'}</div>
                              {batch.plantFamily && (
                                <div className="text-xs text-muted-foreground">
                                  {batch.plantFamily}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{batch.size || '—'}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {(batch.quantity ?? 0).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {batch.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {batch.plantedAt || batch.plantingDate
                              ? new Date(batch.plantedAt || batch.plantingDate!).toLocaleDateString()
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">No batches in this location</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="varieties" className="mt-4 space-y-4">
              {varietyBreakdown.length > 0 ? (
                varietyBreakdown.map((variety) => (
                  <div key={variety.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{variety.name}</span>
                        {variety.family && (
                          <span className="text-sm text-muted-foreground ml-2">
                            ({variety.family})
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">{variety.count.toLocaleString()}</span>
                        <span className="text-sm text-muted-foreground ml-1">plants</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {variety.batches} batch{variety.batches !== 1 ? 'es' : ''}
                        </Badge>
                      </div>
                    </div>
                    <Progress
                      value={(variety.count / location.totalQuantity) * 100}
                      className="h-2"
                    />
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <Sprout className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">No varieties in this location</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="mt-4">
              {pottingDates.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Recent potting activity in this location:
                  </p>
                  {pottingDates.map(({ date, count }) => (
                    <div
                      key={date}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">{date}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">{count.toLocaleString()}</span>
                        <span className="text-sm text-muted-foreground ml-1">plants potted</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">No potting dates recorded</p>
                </div>
              )}
            </TabsContent>

            {/* Plant Health Tab */}
            <TabsContent value="health" className="mt-4 space-y-4">
              {/* Restriction Warning */}
              {restrictionInfo && (
                <div className="rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 p-4">
                  <div className="flex items-center gap-2 text-orange-800 dark:text-orange-200 font-semibold mb-2">
                    <ShieldAlert className="h-5 w-5" />
                    Location Restricted
                  </div>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    This location is under a re-entry restriction until{' '}
                    <strong>{restrictionInfo.until.toLocaleString()}</strong>.
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-sm text-orange-600 dark:text-orange-400">
                    <Clock className="h-4 w-4" />
                    {restrictionInfo.text}
                  </div>
                </div>
              )}

              {/* IPM Programs Assigned */}
              {ipmAssignments.length > 0 && (
                <div className="rounded-lg border p-3 bg-muted/30">
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Active IPM Programs
                  </h4>
                  <div className="space-y-2">
                    {ipmAssignments.map((assignment) => (
                      <div key={assignment.id} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{assignment.program?.name}</span>
                        <div className="flex items-center gap-2">
                          {assignment.program && (
                            <Badge variant="outline" className="text-xs">
                              Every {assignment.program.intervalDays}d
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            Started {new Date(assignment.startsAt).toLocaleDateString()}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scheduled Spot Treatments */}
              {spotTreatments.length > 0 && (
                <div className="rounded-lg border p-3 bg-blue-50 dark:bg-blue-950/30">
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <SprayCan className="h-4 w-4 text-blue-600" />
                    Upcoming Spot Treatments
                  </h4>
                  <div className="space-y-2">
                    {spotTreatments.map((treatment) => (
                      <div key={treatment.id} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{treatment.product?.name}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {treatment.nextApplicationDate
                              ? new Date(treatment.nextApplicationDate).toLocaleDateString()
                              : 'TBD'}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {treatment.applicationsCompleted + 1}/{treatment.applicationsTotal}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <TreatmentDialog
                  locationId={location.id!}
                  locationName={location.name}
                  onSuccess={() => refreshHealthLogs()}
                />
                <MeasurementDialog
                  locationId={location.id!}
                  locationName={location.name}
                  onSuccess={() => refreshHealthLogs()}
                />
                <SpotTreatmentDialog
                  targetType="location"
                  targetId={location.id!}
                  targetName={location.name}
                  onSuccess={() => refreshHealthLogs()}
                />
                {(location.healthStatus === 'infested' || location.healthStatus === 'restricted') && (
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={handleClearLocation}
                    disabled={clearingLocation}
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    {clearingLocation ? 'Clearing...' : 'Clear Location'}
                  </Button>
                )}
              </div>

              {/* Health Log History */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">Recent Activity</h4>
                {loadingLogs ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : healthLogs.length > 0 ? (
                  <div className="space-y-2">
                    {healthLogs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-lg border p-3 bg-card"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {log.event_type === 'treatment' && (
                              <SprayCan className="h-4 w-4 text-red-500" />
                            )}
                            {log.event_type === 'measurement' && (
                              <Gauge className="h-4 w-4 text-blue-500" />
                            )}
                            {log.event_type === 'scout_flag' && (
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                            )}
                            {log.event_type === 'clearance' && (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )}
                            <span className="font-medium capitalize">
                              {log.event_type.replace('_', ' ')}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.event_at).toLocaleString()}
                          </span>
                        </div>
                        
                        {/* Treatment details */}
                        {log.event_type === 'treatment' && log.product_name && (
                          <div className="mt-2 text-sm">
                            <span className="font-medium">{log.product_name}</span>
                            {log.rate && log.unit && (
                              <span className="text-muted-foreground">
                                {' '}@ {log.rate} {log.unit}
                              </span>
                            )}
                            {log.method && (
                              <span className="text-muted-foreground"> via {log.method}</span>
                            )}
                          </div>
                        )}

                        {/* Measurement details */}
                        {log.event_type === 'measurement' && (
                          <div className="mt-2 text-sm flex gap-4">
                            {log.ec_reading !== null && log.ec_reading !== undefined && (
                              <span>
                                <span className="text-muted-foreground">EC:</span>{' '}
                                <span className="font-medium">{log.ec_reading}</span>
                              </span>
                            )}
                            {log.ph_reading !== null && log.ph_reading !== undefined && (
                              <span>
                                <span className="text-muted-foreground">pH:</span>{' '}
                                <span className="font-medium">{log.ph_reading}</span>
                              </span>
                            )}
                          </div>
                        )}

                        {/* Scout flag details */}
                        {log.event_type === 'scout_flag' && (
                          <div className="mt-2 text-sm">
                            {log.issue_reason && (
                              <span className="font-medium">{log.issue_reason}</span>
                            )}
                            {log.severity && (
                              <Badge
                                variant={
                                  log.severity === 'critical'
                                    ? 'destructive'
                                    : log.severity === 'medium'
                                    ? 'secondary'
                                    : 'outline'
                                }
                                className="ml-2 text-xs"
                              >
                                {log.severity}
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Notes */}
                        {log.notes && (
                          <p className="mt-2 text-xs text-muted-foreground">{log.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <SprayCan className="h-12 w-12 mx-auto text-muted-foreground/50" />
                    <p className="mt-4 text-muted-foreground">No plant health records yet</p>
                    <p className="text-sm text-muted-foreground">
                      Apply a treatment or log a measurement to get started
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

