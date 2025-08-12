
'use client';

import * as React from 'react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  ArrowLeft
} from 'lucide-react';
import type { Batch } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';


export default function BatchesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<{
    plantFamily: string;
    status: string;
    category: string;
  }>({ plantFamily: 'all', status: 'all', category: 'all' });

  const { toast } = useToast();
  
  const loadBatches = useCallback(() => {
    if (!user) return;
    setIsDataLoading(true);
    
    const q = query(collection(db, 'batches'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const batchesData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Batch);
      setBatches(batchesData);
      setIsDataLoading(false);
    }, (error) => {
      console.error("Failed to subscribe to batch updates:", error);
      toast({ variant: 'destructive', title: 'Error loading batches', description: error.message });
      setIsDataLoading(false);
    });

    return unsubscribe;
  }, [user, toast]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (user) {
        const unsub = loadBatches();
        if (unsub) {
          unsubscribe = unsub;
        }
    }
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [loadBatches, user]);

  const plantFamilies = useMemo(() => ['all', ...Array.from(new Set(batches.map((b) => b.plantFamily)))], [batches]);
  const categories = useMemo(() => ['all', ...Array.from(new Set(batches.map((b) => b.category)))], [batches]);
  const statuses = useMemo(() => ['all', 'Propagation', 'Plugs/Liners', 'Potted', 'Ready for Sale', 'Looking Good', 'Archived'], []);

  const filteredBatches = useMemo(() => {
    return batches
      .filter((batch) =>
        `${batch.plantFamily} ${batch.plantVariety} ${batch.category} ${batch.supplier || ''} ${batch.batchNumber}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .filter(
        (batch) =>
          filters.plantFamily === 'all' || batch.plantFamily === filters.plantFamily
      )
      .filter(
        (batch) =>
          filters.category === 'all' || batch.category === filters.category
      )
      .filter((batch) => {
        if (filters.status === 'all') return true;
        return batch.status === filters.status;
      });
  }, [batches, searchQuery, filters]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    if (date.toDate) { // It's a Firestore Timestamp
      return format(date.toDate(), 'PPP');
    }
    if (typeof date === 'string') { // It's an ISO string
      return format(new Date(date), 'PPP');
    }
    return 'Invalid Date';
  };

  const getStatusVariant = (status: Batch['status']): "default" | "secondary" | "destructive" | "outline" | "accent" | "info" => {
    switch (status) {
      case 'Ready for Sale':
      case 'Looking Good':
        return 'accent';
      case 'Propagation':
      case 'Plugs/Liners':
        return 'info';
      case 'Potted':
        return 'default';
      case 'Archived':
        return 'destructive';
      default:
        return 'outline';
    }
  };


  if (authLoading || !user) {
     return (
        <div className="flex min-h-screen w-full flex-col p-6 items-center justify-center">
            <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl p-4 sm:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
                <h1 className="mb-1 font-headline text-4xl">Manage Batch Data</h1>
                <p className="text-muted-foreground">View, search, and manage all batch records.</p>
            </div>
            <Button asChild variant="outline">
                <Link href="/settings">
                    <ArrowLeft />
                    Back to Data Management
                </Link>
            </Button>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>All Batches</CardTitle>
                <CardDescription>A complete history of all batches recorded in the system.</CardDescription>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center pt-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                        placeholder="Search by number, category, family, variety..."
                        className="pl-10 w-full"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="shrink-0 w-full sm:w-auto">
                            <Filter className="mr-2" />
                            Filter
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56">
                            <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuRadioGroup value={filters.status} onValueChange={(value) => setFilters(f => ({ ...f, status: value }))}>
                            {statuses.map(status => (
                                <DropdownMenuRadioItem key={status} value={status}>{status === 'all' ? 'All Statuses' : status}</DropdownMenuRadioItem>
                            ))}
                            </DropdownMenuRadioGroup>

                            <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuRadioGroup value={filters.category} onValueChange={(value) => setFilters(f => ({ ...f, category: value }))}>
                            {categories.map(cat => (
                                <DropdownMenuRadioItem key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</DropdownMenuRadioItem>
                            ))}
                            </DropdownMenuRadioGroup>
                            
                            <DropdownMenuLabel>Filter by Plant Family</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuRadioGroup value={filters.plantFamily} onValueChange={(value) => setFilters(f => ({ ...f, plantFamily: value }))}>
                            {plantFamilies.map(fam => (
                                <DropdownMenuRadioItem key={fam} value={fam}>{fam === 'all' ? 'All Families' : fam}</DropdownMenuRadioItem>
                            ))}
                            </DropdownMenuRadioGroup>

                        </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {isDataLoading ? (
                    <div className="space-y-2">
                        {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Batch #</TableHead>
                            <TableHead>Variety</TableHead>
                            <TableHead>Family</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead className="text-right">Current Qty</TableHead>
                            <TableHead className="text-right">Initial Qty</TableHead>
                            <TableHead>Created</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {filteredBatches.map((batch) => (
                            <TableRow key={batch.id}>
                                <TableCell className="font-medium">{batch.batchNumber}</TableCell>
                                <TableCell>{batch.plantVariety}</TableCell>
                                <TableCell>{batch.plantFamily}</TableCell>
                                <TableCell>
                                    <Badge variant={getStatusVariant(batch.status)}>{batch.status}</Badge>
                                </TableCell>
                                <TableCell>{batch.location}</TableCell>
                                <TableCell>{batch.size}</TableCell>
                                <TableCell className="text-right font-semibold">{batch.quantity.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{batch.initialQuantity.toLocaleString()}</TableCell>
                                <TableCell>{formatDate(batch.createdAt)}</TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                )}
                 {filteredBatches.length === 0 && !isDataLoading && (
                    <div className="flex h-[20vh] flex-col items-center justify-center rounded-lg text-center">
                        <p className="text-lg font-medium text-muted-foreground">
                        No batches found.
                        </p>
                        <p className="text-sm text-muted-foreground">
                        Try adjusting your search or filters.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    </div>
  );
}
