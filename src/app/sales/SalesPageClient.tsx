
"use client";

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import {
  Grid,
  LogOut,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import OrderCard from '@/components/sales/OrderCard';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import NewSalesOrderPage from './orders/new/page';
import { useEffect, useState } from "react";

type Order = {
  id: string;
  customerName: string;
  total: number;
  status: "draft" | "open" | "fulfilled" | "cancelled";
  createdAt: string;
};

export default function SalesPageClient() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading, signOut: signOutSupabase } = useAuth();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [orders, setOrders] = React.useState<Order[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [filters, setFilters] = React.useState({
    status: 'all',
  });
  const [searchQuery, setSearchQuery] = React.useState('');

  React.useEffect(() => {
    let alive = true;
    setError(null);
    fetch("/api/sales/orders", { cache: "no-store" })
      .then((r) => r.json())
      .then((res) => {
        if (!alive) return;
        if (res.ok) setOrders(res.orders as Order[]);
        else setError(res.error ?? "Failed to load orders");
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.message ?? "Network error");
      });
    return () => {
      alive = false;
    };
  }, []);

  const filteredOrders = React.useMemo(() => {
    return (orders || [])
      .filter((order) => {
        if (filters.status === 'all') return true;
        return order.status === filters.status;
      })
      .filter((order) => {
        const q = searchQuery.toLowerCase();
        if (!q) return true;
        return (
          order.id?.toLowerCase().includes(q) ||
          order.customerName?.toLowerCase().includes(q)
        );
      });
  }, [orders, filters, searchQuery]);

  const handleSignOut = async () => {
    await signOutSupabase();
    router.push('/login');
    toast({
      title: 'Signed Out',
      description: 'You have been successfully signed out.',
    });
  };
  
  React.useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);
  
  const handleOpenDetail = (orderId: string) => {
    router.push(`/sales/orders/${orderId}`);
  };
  
  if (authLoading || orders === null) {
    return (
        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
    );
  }

  if (error) {
    return (
        <div className="p-3 rounded-md bg-red-50 text-red-700">
            {error}
        </div>
    );
  }

  return (
    <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-headline text-3xl sm:text-4xl truncate">Sales Orders</h1>
            <p className="text-muted-foreground">
              Create and manage customer sales orders.
            </p>
          </div>
          <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-2">
            <Button onClick={() => setIsFormOpen(true)} className="w-full sm:w-auto">
              <Plus /> Create Order
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Select
            value={filters.status}
            onValueChange={(value) =>
              setFilters((f) => ({ ...f, status: value }))
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="picking">Picking</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="dispatched">Dispatched</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="void">Void</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onOpen={() => handleOpenDetail(order.id!)}
            />
          ))}
        </div>
        {filteredOrders.length === 0 && !authLoading && (
          <div className="text-center col-span-full py-20">
            <Grid className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No Orders Found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Try adjusting your filters or create a new order.
            </p>
          </div>
        )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl">
          <NewSalesOrderPage customers={[]} onOrderCreated={() => setIsFormOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
