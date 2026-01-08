'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Download,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BatchData {
  id: string;
  batchNumber: string;
  variety: string;
  varietyId: string;
  family: string;
  status: string;
  quantity: number;
  available: number;
  reserved: number;
  locationId: string;
  location: string;
  plantedAt: string | null;
}

interface BatchTableProps {
  data: BatchData[];
  pageSize?: number;
}

type SortField = 'batchNumber' | 'variety' | 'family' | 'status' | 'quantity' | 'available' | 'location' | 'plantedAt';
type SortDirection = 'asc' | 'desc';

const STATUS_COLORS: Record<string, string> = {
  'Propagation': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'Plugs/Liners': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  'Potted': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  'Growing': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  'Ready for Sale': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'Ready': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'Looking Good': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

export default function BatchTable({ data, pageSize = 10 }: BatchTableProps) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('batchNumber');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(0);

  // Filter by search
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    
    const searchLower = search.toLowerCase();
    return data.filter(batch => 
      batch.batchNumber.toLowerCase().includes(searchLower) ||
      batch.variety.toLowerCase().includes(searchLower) ||
      batch.family.toLowerCase().includes(searchLower) ||
      batch.location.toLowerCase().includes(searchLower)
    );
  }, [data, search]);

  // Sort data
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let aVal: string | number | null = a[sortField];
      let bVal: string | number | null = b[sortField];

      // Handle null dates
      if (sortField === 'plantedAt') {
        aVal = a.plantedAt ?? '';
        bVal = b.plantedAt ?? '';
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });
  }, [filteredData, sortField, sortDirection]);

  // Paginate
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = sortedData.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setPage(0);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const exportCSV = () => {
    const headers = ['Batch #', 'Variety', 'Family', 'Status', 'Quantity', 'Available', 'Reserved', 'Location', 'Planted At'];
    const rows = sortedData.map(b => [
      b.batchNumber,
      b.variety,
      b.family,
      b.status,
      b.quantity,
      b.available,
      b.reserved,
      b.location,
      b.plantedAt ?? '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(v => `"${v}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batches-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search batches..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {filteredData.length.toLocaleString()} batch{filteredData.length !== 1 ? 'es' : ''}
          </span>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="cursor-pointer select-none"
                onClick={() => handleSort('batchNumber')}
              >
                <div className="flex items-center">
                  Batch #
                  <SortIcon field="batchNumber" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer select-none"
                onClick={() => handleSort('variety')}
              >
                <div className="flex items-center">
                  Variety
                  <SortIcon field="variety" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer select-none"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center">
                  Status
                  <SortIcon field="status" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer select-none text-right"
                onClick={() => handleSort('quantity')}
              >
                <div className="flex items-center justify-end">
                  Qty
                  <SortIcon field="quantity" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer select-none text-right"
                onClick={() => handleSort('available')}
              >
                <div className="flex items-center justify-end">
                  Available
                  <SortIcon field="available" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer select-none"
                onClick={() => handleSort('location')}
              >
                <div className="flex items-center">
                  Location
                  <SortIcon field="location" />
                </div>
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {search ? 'No batches match your search' : 'No batches found'}
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell className="font-mono text-sm">
                    {batch.batchNumber}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{batch.variety}</div>
                      <div className="text-xs text-muted-foreground">{batch.family}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="secondary"
                      className={cn(
                        "text-xs",
                        STATUS_COLORS[batch.status] ?? 'bg-gray-100 text-gray-800'
                      )}
                    >
                      {batch.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {batch.quantity.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={batch.available > 0 ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                      {batch.available.toLocaleString()}
                    </span>
                    {batch.reserved > 0 && (
                      <span className="text-xs text-amber-600 ml-1">
                        ({batch.reserved} res)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {batch.location}
                  </TableCell>
                  <TableCell>
                    <Link href={`/production/batches/${batch.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, sortedData.length)} of {sortedData.length}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(0)}
              disabled={page === 0}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-sm">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

