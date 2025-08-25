
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
import { auth } from '@/lib/firebase';
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
import { useEffect, useState } from "react";
import { SalesOrdersPanel } from '@/components/sales/SalesOrdersPanel';

export default function SalesLandingPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <h1 className="text-2xl font-semibold">Sales</h1>
        <Button asChild>
          <Link href="/sales/webshop">Create order</Link>
        </Button>
      </div>

      <SalesOrdersPanel />
    </div>
  );
}
