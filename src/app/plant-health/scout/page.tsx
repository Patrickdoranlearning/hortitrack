'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageFrame } from '@/ui/templates';
import { ModulePageHeader } from '@/ui/templates';
import { ScoutWizard } from '@/components/plant-health/scout';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  ScanLine, 
  ListTodo, 
  AlertTriangle, 
  Droplets, 
  MapPin, 
  Package,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { listScoutLogs, type ScoutLogEntry } from '@/app/actions/plant-health';
import { formatDistanceToNow } from 'date-fns';

export default function ScoutPage() {
  const [activeTab, setActiveTab] = useState<string>('scout');
  const [logs, setLogs] = useState<ScoutLogEntry[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const result = await listScoutLogs({
      limit: pageSize,
      offset: page * pageSize,
    });
    if (result.success && result.data) {
      setLogs(result.data.logs);
      setTotalLogs(result.data.total);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab, fetchLogs]);

  const handleScoutComplete = useCallback(() => {
    // Switch to logs tab after completing a scout
    setActiveTab('logs');
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(totalLogs / pageSize);

  const getSeverityBadge = (severity: string | null) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'medium':
        return <Badge variant="default" className="bg-amber-500">Medium</Badge>;
      case 'low':
        return <Badge variant="secondary">Low</Badge>;
      default:
        return null;
    }
  };

  const formatEventTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return dateStr;
    }
  };

  return (
    <PageFrame moduleKey="plantHealth">
      <ErrorBoundary>
      <div className="space-y-6">
        <ModulePageHeader
          title="Scout Mode"
          description="Scan locations to log issues, readings, and schedule treatments"
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="scout" className="gap-2">
              <ScanLine className="h-4 w-4" />
              New Scout
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <ListTodo className="h-4 w-4" />
              Scout Logs
              {totalLogs > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {totalLogs}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scout">
            <div className="max-w-2xl mx-auto">
              <ScoutWizard onComplete={handleScoutComplete} />
            </div>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Scout Logs</CardTitle>
                    <CardDescription>
                      History of all scouting activities and measurements
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchLogs}
                    disabled={loading}
                    className="gap-2"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading && logs.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-12">
                    <ScanLine className="h-12 w-12 mx-auto text-muted-foreground/50" />
                    <p className="mt-4 text-muted-foreground">No scout logs yet</p>
                    <p className="text-sm text-muted-foreground">
                      Start scouting to record issues and measurements
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setActiveTab('scout')}
                    >
                      Start Scouting
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Location / Batch</TableHead>
                            <TableHead className="hidden md:table-cell">Details</TableHead>
                            <TableHead className="hidden lg:table-cell">Recorded By</TableHead>
                            <TableHead>When</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {logs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {log.logType === 'issue' ? (
                                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                                    </div>
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                      <Droplets className="h-4 w-4 text-blue-600" />
                                    </div>
                                  )}
                                  <span className="text-sm font-medium">
                                    {log.logType === 'issue' ? 'Issue' : 'Reading'}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-sm">
                                  {log.locationName ? (
                                    <>
                                      <MapPin className="h-3 w-3 text-muted-foreground" />
                                      <span>{log.locationName}</span>
                                    </>
                                  ) : log.batchNumber ? (
                                    <>
                                      <Package className="h-3 w-3 text-muted-foreground" />
                                      <span>{log.batchNumber}</span>
                                    </>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {log.logType === 'issue' ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm">{log.issueReason}</span>
                                    {getSeverityBadge(log.severity)}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3 text-sm">
                                    {log.ecReading !== null && (
                                      <span>
                                        <span className="text-muted-foreground">EC:</span>{' '}
                                        {log.ecReading}
                                      </span>
                                    )}
                                    {log.phReading !== null && (
                                      <span>
                                        <span className="text-muted-foreground">pH:</span>{' '}
                                        {log.phReading}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="hidden lg:table-cell">
                                <span className="text-sm text-muted-foreground">
                                  {log.recordedByName || 'Unknown'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">
                                  {formatEventTime(log.eventAt)}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <p className="text-sm text-muted-foreground">
                          Showing {page * pageSize + 1} to{' '}
                          {Math.min((page + 1) * pageSize, totalLogs)} of {totalLogs} logs
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0}
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      </ErrorBoundary>
    </PageFrame>
  );
}
