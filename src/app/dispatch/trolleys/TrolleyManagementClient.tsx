"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Loader2,
  ShoppingCart,
  PackageCheck,
  RotateCcw,
  AlertTriangle,
  Search,
  Truck,
} from "lucide-react";

type Trolley = {
  id: string;
  trolleyNumber: string;
  trolleyType: string;
  status: "available" | "loaded" | "at_customer" | "returned" | "damaged" | "lost";
  currentLocation?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  deliveryRunId?: string | null;
  runNumber?: string | null;
  conditionNotes?: string | null;
  lastInspectionDate?: string | null;
  createdAt: string;
  updatedAt: string;
};

type CustomerBalance = {
  customerId: string;
  customerName: string;
  trolleysOut: number;
  lastDeliveryDate?: string | null;
  lastReturnDate?: string | null;
  daysOutstanding?: number | null;
};

const STATUS_COLORS: Record<string, string> = {
  available: "bg-green-100 text-green-700",
  loaded: "bg-blue-100 text-blue-700",
  at_customer: "bg-purple-100 text-purple-700",
  returned: "bg-slate-100 text-slate-700",
  damaged: "bg-orange-100 text-orange-700",
  lost: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  loaded: "Loaded",
  at_customer: "At Customer",
  returned: "Returned",
  damaged: "Damaged",
  lost: "Lost",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

export default function TrolleyManagementClient() {
  const { toast } = useToast();
  const [trolleys, setTrolleys] = useState<Trolley[]>([]);
  const [balances, setBalances] = useState<CustomerBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTrolley, setNewTrolley] = useState({ trolleyNumber: "", trolleyType: "danish" });
  const [isAdding, setIsAdding] = useState(false);

  // Fetch data
  useEffect(() => {
    fetchTrolleys();
    fetchBalances();
  }, []);

  const fetchTrolleys = async () => {
    try {
      const response = await fetch("/api/dispatch/trolleys");
      const data = await response.json();
      if (data.trolleys) {
        setTrolleys(data.trolleys);
      }
    } catch (error) {
      console.error("Failed to fetch trolleys:", error);
      toast({ variant: "destructive", title: "Failed to load trolleys" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBalances = async () => {
    try {
      const response = await fetch("/api/dispatch/trolleys/balances");
      const data = await response.json();
      if (data.balances) {
        setBalances(data.balances);
      }
    } catch (error) {
      console.error("Failed to fetch balances:", error);
    }
  };

  const handleAddTrolley = async () => {
    if (!newTrolley.trolleyNumber) {
      toast({ variant: "destructive", title: "Please enter a trolley number" });
      return;
    }

    setIsAdding(true);
    try {
      const response = await fetch("/api/dispatch/trolleys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTrolley),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to add trolley");
      }

      toast({ title: "Trolley added", description: `Trolley ${newTrolley.trolleyNumber} added successfully.` });
      setNewTrolley({ trolleyNumber: "", trolleyType: "danish" });
      setIsAddDialogOpen(false);
      fetchTrolleys();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to add trolley", description: error.message });
    } finally {
      setIsAdding(false);
    }
  };

  // Filter trolleys
  const filteredTrolleys = trolleys.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (!search) return true;
    const query = search.toLowerCase();
    return (
      t.trolleyNumber.toLowerCase().includes(query) ||
      (t.customerName?.toLowerCase().includes(query) ?? false)
    );
  });

  // Stats
  const stats = {
    total: trolleys.length,
    available: trolleys.filter((t) => t.status === "available").length,
    atCustomer: trolleys.filter((t) => t.status === "at_customer").length,
    loaded: trolleys.filter((t) => t.status === "loaded").length,
    damaged: trolleys.filter((t) => t.status === "damaged" || t.status === "lost").length,
  };

  const totalTrolleysOut = balances.reduce((sum, b) => sum + b.trolleysOut, 0);
  const customersWithTrolleys = balances.filter((b) => b.trolleysOut > 0).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trolley Management</h1>
          <p className="text-muted-foreground mt-1">
            Track trolley inventory, customer balances, and returns.
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Trolley
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Trolley</DialogTitle>
              <DialogDescription>
                Register a new trolley in the system.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="trolleyNumber">Trolley Number</Label>
                <Input
                  id="trolleyNumber"
                  placeholder="e.g., T001"
                  value={newTrolley.trolleyNumber}
                  onChange={(e) => setNewTrolley({ ...newTrolley, trolleyNumber: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="trolleyType">Trolley Type</Label>
                <Select
                  value={newTrolley.trolleyType}
                  onValueChange={(v) => setNewTrolley({ ...newTrolley, trolleyType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="danish">Danish Trolley</SelectItem>
                    <SelectItem value="dutch">Dutch Trolley</SelectItem>
                    <SelectItem value="cc">CC Container</SelectItem>
                    <SelectItem value="half">Half Trolley</SelectItem>
                    <SelectItem value="pallet">Pallet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddTrolley} disabled={isAdding}>
                {isAdding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Add Trolley
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Total Fleet</p>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Available</p>
              <PackageCheck className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.available}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">At Customers</p>
              <ShoppingCart className="h-4 w-4 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-purple-600">{stats.atCustomer}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Loaded/Transit</p>
              <Truck className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-600">{stats.loaded}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Damaged/Lost</p>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </div>
            <p className="text-2xl font-bold text-orange-600">{stats.damaged}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory">Trolley Inventory</TabsTrigger>
          <TabsTrigger value="balances">Customer Balances</TabsTrigger>
        </TabsList>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by trolley number or customer..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Trolley Table */}
          <Card>
            <CardHeader>
              <CardTitle>Trolley List</CardTitle>
              <CardDescription>
                {filteredTrolleys.length} of {trolleys.length} trolleys
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trolley #</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Delivery Run</TableHead>
                    <TableHead>Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrolleys.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        No trolleys found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTrolleys.map((trolley) => (
                      <TableRow key={trolley.id}>
                        <TableCell className="font-medium">{trolley.trolleyNumber}</TableCell>
                        <TableCell className="capitalize">{trolley.trolleyType}</TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[trolley.status]}>
                            {STATUS_LABELS[trolley.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>{trolley.customerName ?? "—"}</TableCell>
                        <TableCell>{trolley.runNumber ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(trolley.updatedAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balances Tab */}
        <TabsContent value="balances" className="space-y-4">
          {/* Summary */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Total Outstanding</p>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold">{totalTrolleysOut} trolleys</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Customers with Trolleys</p>
                  <RotateCcw className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold">{customersWithTrolleys}</p>
              </CardContent>
            </Card>
          </div>

          {/* Balance Table */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Trolley Balances</CardTitle>
              <CardDescription>
                Track trolleys outstanding at each customer location.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Trolleys Out</TableHead>
                    <TableHead>Last Delivery</TableHead>
                    <TableHead>Last Return</TableHead>
                    <TableHead className="text-right">Days Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                        No outstanding trolleys.
                      </TableCell>
                    </TableRow>
                  ) : (
                    balances.map((balance) => (
                      <TableRow key={balance.customerId}>
                        <TableCell className="font-medium">{balance.customerName}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={balance.trolleysOut > 5 ? "destructive" : "secondary"}>
                            {balance.trolleysOut}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(balance.lastDeliveryDate)}</TableCell>
                        <TableCell>{formatDate(balance.lastReturnDate)}</TableCell>
                        <TableCell className="text-right">
                          {balance.daysOutstanding != null ? (
                            <span className={balance.daysOutstanding > 14 ? "text-orange-600 font-medium" : ""}>
                              {balance.daysOutstanding} days
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}



