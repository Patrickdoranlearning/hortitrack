"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  RefreshCw,
  Printer,
  CheckCircle2,
  XCircle,
  Clock,
  Tag,
  Package,
  MapPin,
  RotateCcw,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

type PrintJob = {
  id: string;
  label_type: string;
  template_id?: string;
  printer_id?: string;
  copies: number;
  status: string;
  error_message?: string;
  payload_json: Record<string, unknown>;
  created_at: string;
  template?: { id: string; name: string } | null;
  printer?: { id: string; name: string } | null;
};

const LABEL_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  sale: { label: "Sale", icon: Tag, color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  batch: { label: "Batch", icon: Package, color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  location: { label: "Location", icon: MapPin, color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  completed: { label: "Completed", icon: CheckCircle2, color: "text-green-600" },
  failed: { label: "Failed", icon: XCircle, color: "text-red-600" },
  pending: { label: "Pending", icon: Clock, color: "text-amber-600" },
};

export default function PrintHistory() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [reprintingJob, setReprintingJob] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const url = filterType === "all"
        ? "/api/print-jobs?limit=100"
        : `/api/print-jobs?type=${filterType}&limit=100`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.data) {
        setJobs(json.data);
      }
    } catch (e) {
      console.error("Failed to fetch print jobs:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load print history",
      });
    } finally {
      setLoading(false);
    }
  }, [filterType, toast]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleReprint = async (job: PrintJob) => {
    setReprintingJob(job.id);
    try {
      // Determine the correct API endpoint based on label type
      let endpoint = "/api/labels/print";
      if (job.label_type === "sale") {
        endpoint = "/api/labels/print-sale";
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...job.payload_json,
          printerId: job.printer_id,
          templateId: job.template_id,
          copies: job.copies,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error || "Reprint failed");
      }

      toast({
        title: "Reprint Sent",
        description: `${job.copies} label(s) sent to printer`,
      });

      // Log the reprint as a new job
      await fetch("/api/print-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label_type: job.label_type,
          template_id: job.template_id,
          printer_id: job.printer_id,
          copies: job.copies,
          status: "completed",
          payload_json: job.payload_json,
        }),
      });

      fetchJobs();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Reprint Failed",
        description: e.message,
      });
    } finally {
      setReprintingJob(null);
    }
  };

  const getPayloadSummary = (payload: Record<string, unknown>): string => {
    if (payload.productTitle) return String(payload.productTitle);
    if (payload.variety) return String(payload.variety);
    if (payload.batchNumber) return `Batch #${payload.batchNumber}`;
    return "Label";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="sale">Sale Labels</SelectItem>
              <SelectItem value="batch">Batch Labels</SelectItem>
              <SelectItem value="location">Location Labels</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={fetchJobs} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Jobs Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Printer className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No print history</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Print jobs will appear here once you start printing labels
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Date/Time</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Printer</TableHead>
                <TableHead className="text-center">Copies</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => {
                const typeConfig = LABEL_TYPE_CONFIG[job.label_type] || {
                  label: job.label_type,
                  icon: Tag,
                  color: "bg-gray-100 text-gray-700",
                };
                const TypeIcon = typeConfig.icon;
                const statusConfig = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusConfig.icon;

                return (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-xs">
                      <div>{format(new Date(job.created_at), "MMM d, yyyy")}</div>
                      <div className="text-muted-foreground">
                        {format(new Date(job.created_at), "HH:mm:ss")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium truncate max-w-[200px] block">
                        {getPayloadSummary(job.payload_json)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={typeConfig.color}>
                        <TypeIcon className="h-3 w-3 mr-1" />
                        {typeConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {job.template?.name || "Default"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {job.printer?.name || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{job.copies}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className={`flex items-center gap-1 ${statusConfig.color}`}>
                        <StatusIcon className="h-4 w-4" />
                        <span className="text-sm">{statusConfig.label}</span>
                      </div>
                      {job.error_message && (
                        <p className="text-xs text-red-500 mt-1 truncate max-w-[150px]">
                          {job.error_message}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReprint(job)}
                        disabled={reprintingJob === job.id}
                      >
                        {reprintingJob === job.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Reprint
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Summary */}
      {jobs.length > 0 && (
        <div className="text-sm text-muted-foreground">
          Showing {jobs.length} print job{jobs.length !== 1 ? "s" : ""}
          {filterType !== "all" && ` (filtered by ${filterType})`}
        </div>
      )}
    </div>
  );
}







