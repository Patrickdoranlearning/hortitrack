
'use client';

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
import { auth } from '@/lib/firebase';
import type { Order } from '@/server/sales/queries';
import { signOut } from 'firebase/auth';
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

type Props = { initialOrders: Order[], initialCustomers: any[] };

export default function SalesPageClient({ initialOrders, initialCustomers }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const [isFormOpen, setIsFormOpen] = React.useState(false);

  const [filters, setFilters] = React.useState({
    status: 'all',
  });
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredOrders = React.useMemo(() => {
    return (initialOrders || [])
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
  }, [initialOrders, filters, searchQuery]);

  const handleSignOut = async () => {
    await signOut(auth);
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
  
  if (authLoading) {
    return (
        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
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
          <NewSalesOrderPage customers={initialCustomers || []} onOrderCreated={() => setIsFormOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
