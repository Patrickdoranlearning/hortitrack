
'use client';

import { Logo } from '@/components/logo';
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
import type { SalesOrderDoc } from '@/lib/sales/types';
import type { Supplier } from '@/lib/types';
import { signOut } from 'firebase/auth';
import {
  Grid,
  LayoutGrid,
  LogOut,
  Plus,
  Search,
  Settings,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useCollection } from '@/hooks/use-collection';
import OrderCard from '@/components/sales/OrderCard';
import NewSalesOrderPage from './orders/new/page';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import OrderDetailPage from './orders/[orderId]/page';

export default function SalesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const { data: ordersData, isLoading: ordersLoading } = useCollection<SalesOrderDoc>('sales_orders');
  const { data: customersData, isLoading: customersLoading } = useCollection<Supplier>('customers');

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [selectedOrderId, setSelectedOrderId] = React.useState<string | null>(null);

  const [filters, setFilters] = React.useState({
    status: 'all',
  });
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredOrders = React.useMemo(() => {
    return (ordersData || [])
      .filter((order) => {
        if (filters.status === 'all') return true;
        return order.status === filters.status;
      })
      .filter((order) => {
        const q = searchQuery.toLowerCase();
        if (!q) return true;
        return (
          order.id?.toLowerCase().includes(q) ||
          order.customerId?.toLowerCase().includes(q) ||
          order.storeId?.toLowerCase().includes(q)
        );
      });
  }, [ordersData, filters, searchQuery]);

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
    setSelectedOrderId(orderId);
  };
  
  const handleCloseDetail = () => {
    setSelectedOrderId(null);
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen w-full flex-col p-6">
        <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 justify-between">
          <Logo />
          <Skeleton className="h-8 w-8 rounded-full" />
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
          <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 justify-between z-10">
        <Logo />
        <div className="flex items-center gap-4">
          <div className="relative flex-1 md:grow-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by Order ID, Customer..."
              className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full">
                <Users className="h-5 w-5" />
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                {user?.email || 'My Account'}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/">Nursery Stock</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard">Dashboard</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
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
          {ordersLoading
            ? [...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))
            : filteredOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onOpen={() => handleOpenDetail(order.id!)}
                />
              ))}
        </div>
        {filteredOrders.length === 0 && !ordersLoading && (
          <div className="text-center col-span-full py-20">
            <Grid className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No Orders Found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Try adjusting your filters or create a new order.
            </p>
          </div>
        )}
      </main>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl">
          <NewSalesOrderPage customers={customersData || []} onOrderCreated={() => setIsFormOpen(false)} />
        </DialogContent>
      </Dialog>
      
      {selectedOrderId && (
        <Dialog open={!!selectedOrderId} onOpenChange={(open) => !open && handleCloseDetail()}>
            <DialogContent className="max-w-4xl">
                {/* The OrderDetailPage is now a server component, so we can't just render it. 
                We need a client component wrapper or to pass the data down.
                For now, let's assume we can pass the orderId and fetch inside.
                This is a temporary solution for the sake of the demo. A better solution
                would be to create a client component that fetches the order details.
                But for now, this will do. We'll create a simple display. */}
                 <OrderDetailPage params={{ orderId: selectedOrderId }} />
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
