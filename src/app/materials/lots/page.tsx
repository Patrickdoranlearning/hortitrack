'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Boxes,
  Search,
  Filter,
  ScanLine,
  Printer,
  ArrowUpDown,
  MoreHorizontal,
  ChevronRight,
  Package,
  MapPin,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { PageFrame, ModulePageHeader } from '@/ui/templates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MaterialLotWithMaterial, MaterialLotStatus } from '@/lib/types/material-lots';

const STATUS_COLORS: Record<MaterialLotStatus, string> = {
  available: 'bg-green-100 text-green-800',
  depleted: 'bg-gray-100 text-gray-800',
  quarantine: 'bg-yellow-100 text-yellow-800',
  damaged: 'bg-red-100 text-red-800',
  expired: 'bg-orange-100 text-orange-800',
};

export default function MaterialLotsPage() {
  const router = useRouter();
  const [lots, setLots] = useState<MaterialLotWithMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('available');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    async function fetchLots() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchQuery) params.set('search', searchQuery);
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
        params.set('sortField', 'receivedAt');
        params.set('sortOrder', 'asc');
        params.set('limit', '50');

        const res = await fetch(`/api/materials/lots?${params}`);
        if (!res.ok) throw new Error('Failed to fetch lots');

        const data = await res.json();
        setLots(data.lots);
        setTotal(data.total);
      } catch {
        // Lot fetch failed silently
      } finally {
        setLoading(false);
      }
    }

    fetchLots();
  }, [searchQuery, statusFilter]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const isExpiringSoon = (expiryDate: string | null | undefined) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return expiry <= thirtyDaysFromNow;
  };

  const getQuantityPercentage = (current: number, initial: number) => {
    return Math.round((current / initial) * 100);
  };

  return (
    <PageFrame moduleKey="materials">
      <div className="space-y-6">
        <ModulePageHeader
          title="Material Lots"
          description="Track individual boxes, bags, and pallets of materials with scannable barcodes."
          actions={
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/materials/lots">
                  <ScanLine className="mr-2 h-4 w-4" />
                  Scan Lot
                </Link>
              </Button>
              <Button asChild>
                <Link href="/materials/receive">
                  <Boxes className="mr-2 h-4 w-4" />
                  Receive Materials
                </Link>
              </Button>
            </div>
          }
        />

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by lot number, material name..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="depleted">Depleted</SelectItem>
                  <SelectItem value="quarantine">Quarantine</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Lots Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Lots ({total})</span>
              <span className="text-sm font-normal text-muted-foreground">
                Sorted by received date (oldest first - FIFO)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : lots.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Boxes className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No lots found.</p>
                <p className="text-sm">Receive materials to create lots.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lot Number</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lots.map((lot) => (
                    <TableRow
                      key={lot.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/materials/lots/${lot.id}`)}
                    >
                      <TableCell className="font-mono font-medium">
                        {lot.lotNumber}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{lot.material?.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {lot.material?.partNumber}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {lot.currentQuantity} / {lot.initialQuantity} {lot.uom}
                          </div>
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{
                                width: `${getQuantityPercentage(lot.currentQuantity, lot.initialQuantity)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[lot.status]}>
                          {lot.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {lot.location ? (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3" />
                            {lot.location.name}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {formatDate(lot.receivedAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {lot.expiryDate ? (
                          <div
                            className={`flex items-center gap-1 text-sm ${
                              isExpiringSoon(lot.expiryDate) ? 'text-orange-600 font-medium' : ''
                            }`}
                          >
                            {isExpiringSoon(lot.expiryDate) && (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            {formatDate(lot.expiryDate)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/materials/lots/${lot.id}`);
                              }}
                            >
                              <ChevronRight className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                // TODO: Print label
                              }}
                            >
                              <Printer className="mr-2 h-4 w-4" />
                              Print Label
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </PageFrame>
  );
}
