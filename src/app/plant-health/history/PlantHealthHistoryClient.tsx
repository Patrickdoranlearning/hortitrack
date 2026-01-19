"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlantHealthLog } from "@/components/history/PlantHealthLog";
import type { PlantHealthEvent } from "@/lib/history-types";
import {
  Loader2,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Filter,
  X
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EVENT_TYPES = [
  { value: 'treatment', label: 'Treatments' },
  { value: 'scout_flag', label: 'Scout Flags' },
  { value: 'measurement', label: 'Measurements' },
  { value: 'clearance', label: 'Clearances' },
  { value: 'irrigation', label: 'Irrigation' },
  { value: 'fertilize', label: 'Fertilizing' },
  { value: 'pruning', label: 'Pruning' },
  { value: 'grading', label: 'Grading' },
];

const PAGE_SIZE = 50;

export function PlantHealthHistoryClient() {
  const [logs, setLogs] = React.useState<PlantHealthEvent[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Filters
  const [search, setSearch] = React.useState("");
  const [eventType, setEventType] = React.useState<string>("all");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [offset, setOffset] = React.useState(0);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch data
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (eventType && eventType !== "all") params.set('eventType', eventType);
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(offset));

    fetch(`/api/plant-health/history?${params}`)
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || res.statusText);
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setLogs(data.logs || []);
          setTotal(data.total || 0);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || String(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, eventType, fromDate, toDate, offset]);

  const handleExportCSV = () => {
    // Build CSV content
    const headers = ['Date', 'Type', 'Batch', 'Variety', 'Title', 'Product', 'Rate', 'Method', 'Signed By'];
    const rows = logs.map(log => [
      new Date(log.at).toLocaleString(),
      log.type,
      log.batchNumber || '',
      log.varietyName || '',
      log.title,
      log.productName || '',
      log.rate && log.unit ? `${log.rate} ${log.unit}` : '',
      log.method || '',
      log.signedBy || ''
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell =>
      `"${String(cell).replace(/"/g, '""')}"`
    ).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plant-health-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearch("");
    setEventType("");
    setFromDate("");
    setToDate("");
    setOffset(0);
  };

  const hasFilters = search || eventType || fromDate || toDate;

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-muted-foreground mb-1 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products, notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="w-[160px]">
              <label className="text-sm text-muted-foreground mb-1 block">Event Type</label>
              <Select value={eventType} onValueChange={(v) => { setEventType(v); setOffset(0); }}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {EVENT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[140px]">
              <label className="text-sm text-muted-foreground mb-1 block">From Date</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setOffset(0); }}
              />
            </div>

            <div className="w-[140px]">
              <label className="text-sm text-muted-foreground mb-1 block">To Date</label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setOffset(0); }}
              />
            </div>

            <div className="flex gap-2">
              {hasFilters && (
                <Button variant="ghost" size="icon" onClick={clearFilters}>
                  <X className="h-4 w-4" />
                </Button>
              )}
              <Button variant="outline" onClick={handleExportCSV} disabled={logs.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardContent className="p-4">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading health logs...
            </div>
          )}
          {error && (
            <div className="text-sm text-red-600 py-8 text-center">{error}</div>
          )}
          {!loading && !error && logs.length === 0 && (
            <div className="text-center py-12">
              <Filter className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">No health logs found</p>
              {hasFilters && (
                <Button variant="outline" onClick={clearFilters} className="mt-4">
                  Clear filters
                </Button>
              )}
            </div>
          )}
          {!loading && logs.length > 0 && (
            <>
              <PlantHealthLog logs={logs} showBatchLink compact />

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {offset + 1}-{Math.min(offset + PAGE_SIZE, total)} of {total} logs
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                    disabled={offset === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset(offset + PAGE_SIZE)}
                    disabled={offset + PAGE_SIZE >= total}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
