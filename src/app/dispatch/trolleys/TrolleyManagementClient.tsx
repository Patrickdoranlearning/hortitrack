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
  RotateCcw,
  AlertTriangle,
  Truck,
  Search,
  FileWarning,
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Package,
  Minus,
  Camera,
  FileText,
} from "lucide-react";
import { format } from "date-fns";

type CustomerBalance = {
  customerId: string;
  customerName: string;
  trolleysOut: number;
  shelvesOut: number;
  lastDeliveryDate?: string | null;
  lastReturnDate?: string | null;
  daysOutstanding?: number | null;
  hasOverdueItems: boolean;
};

type HaulierBalance = {
  haulierId: string;
  haulierName: string;
  driverName?: string;
  vehicleReg?: string;
  trolleysLoaded: number;
  shelvesLoaded: number;
  currentRunId?: string;
  currentRunNumber?: string;
};

type TrolleyTransaction = {
  id: string;
  date: string;
  type: "delivered" | "returned" | "not_returned";
  customerId: string;
  customerName: string;
  trolleys: number;
  shelves: number;
  deliveryRunNumber?: string;
  driverName?: string;
  signedDocketUrl?: string;
  notes?: string;
  recordedBy?: string;
};

type RecordMovementForm = {
  type: "delivered" | "returned" | "not_returned";
  customerId: string;
  trolleys: number;
  shelves: number;
  notes: string;
  requiresSignedDocket: boolean;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return format(new Date(value), "dd MMM yyyy");
  } catch {
    return value;
  }
}

export default function TrolleyManagementClient() {
  const { toast } = useToast();
  const [customerBalances, setCustomerBalances] = useState<CustomerBalance[]>([]);
  const [haulierBalances, setHaulierBalances] = useState<HaulierBalance[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<TrolleyTransaction[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Record movement dialog
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [movementForm, setMovementForm] = useState<RecordMovementForm>({
    type: "delivered",
    customerId: "",
    trolleys: 0,
    shelves: 0,
    notes: "",
    requiresSignedDocket: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch customer balances
      const balancesRes = await fetch("/api/dispatch/trolleys/balances");
      const balancesData = await balancesRes.json();
      if (balancesData.balances) {
        setCustomerBalances(balancesData.balances);
      }

      // Fetch haulier balances
      const hauliersRes = await fetch("/api/dispatch/trolleys/haulier-balances");
      const hauliersData = await hauliersRes.json();
      if (hauliersData.balances) {
        setHaulierBalances(hauliersData.balances);
      }

      // Fetch recent transactions
      const transactionsRes = await fetch("/api/dispatch/trolleys/transactions?limit=50");
      const transactionsData = await transactionsRes.json();
      if (transactionsData.transactions) {
        setRecentTransactions(transactionsData.transactions);
      }

      // Fetch customers for dropdown
      const customersRes = await fetch("/api/customers?limit=500");
      const customersData = await customersRes.json();
      if (customersData.customers) {
        setCustomers(customersData.customers.map((c: any) => ({ id: c.id, name: c.name })));
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast({ variant: "destructive", title: "Failed to load data" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecordMovement = async () => {
    if (!movementForm.customerId) {
      toast({ variant: "destructive", title: "Please select a customer" });
      return;
    }

    if (movementForm.trolleys === 0 && movementForm.shelves === 0) {
      toast({ variant: "destructive", title: "Please enter trolley or shelf quantity" });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/dispatch/trolleys/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(movementForm),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to record movement");
      }

      const typeLabels = {
        delivered: "Delivered",
        returned: "Returned",
        not_returned: "Not Returned (logged)",
      };

      toast({
        title: "Movement Recorded",
        description: `${typeLabels[movementForm.type]}: ${movementForm.trolleys} trolleys, ${movementForm.shelves} shelves`,
      });

      setIsRecordDialogOpen(false);
      setMovementForm({
        type: "delivered",
        customerId: "",
        trolleys: 0,
        shelves: 0,
        notes: "",
        requiresSignedDocket: false,
      });
      fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to record", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Stats
  const totalTrolleysOut = customerBalances.reduce((sum, b) => sum + b.trolleysOut, 0);
  const totalShelvesOut = customerBalances.reduce((sum, b) => sum + b.shelvesOut, 0);
  const customersWithOutstanding = customerBalances.filter(
    (b) => b.trolleysOut > 0 || b.shelvesOut > 0
  ).length;
  const overdueCustomers = customerBalances.filter((b) => b.hasOverdueItems).length;
  const trolleysOnTrucks = haulierBalances.reduce((sum, h) => sum + h.trolleysLoaded, 0);
  const notReturnedCount = recentTransactions.filter((t) => t.type === "not_returned").length;

  // Filter balances
  const filteredCustomerBalances = customerBalances.filter((b) => {
    if (!search) return true;
    return b.customerName.toLowerCase().includes(search.toLowerCase());
  });

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
          <h1 className="text-3xl font-bold tracking-tight">Trolley & Shelf Tracking</h1>
          <p className="text-muted-foreground mt-1">
            Track customer balances, haulier loads, and equipment returns.
          </p>
        </div>
        <Button onClick={() => setIsRecordDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Record Movement
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Trolleys Out</p>
              <ShoppingCart className="h-4 w-4 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-purple-600">{totalTrolleysOut}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Shelves Out</p>
              <Package className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-600">{totalShelvesOut}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Customers Owing</p>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{customersWithOutstanding}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">On Trucks</p>
              <Truck className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-600">{trolleysOnTrucks}</p>
          </CardContent>
        </Card>
        <Card className={overdueCustomers > 0 ? "border-orange-300 bg-orange-50" : ""}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Overdue</p>
              <Clock className="h-4 w-4 text-orange-600" />
            </div>
            <p className="text-2xl font-bold text-orange-600">{overdueCustomers}</p>
          </CardContent>
        </Card>
        <Card className={notReturnedCount > 0 ? "border-red-300 bg-red-50" : ""}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Not Returned</p>
              <FileWarning className="h-4 w-4 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-600">{notReturnedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="customers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="customers">Customer Balances</TabsTrigger>
          <TabsTrigger value="hauliers">Haulier Loads</TabsTrigger>
          <TabsTrigger value="history">Transaction History</TabsTrigger>
        </TabsList>

        {/* Customer Balances Tab */}
        <TabsContent value="customers" className="space-y-4">
          {/* Search */}
          <Card>
            <CardContent className="pt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search customers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardContent>
          </Card>

          {/* Balance Table */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Equipment Balances</CardTitle>
              <CardDescription>
                Equipment currently held by customers. Collect on next delivery.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Trolleys</TableHead>
                    <TableHead className="text-right">Shelves</TableHead>
                    <TableHead>Last Delivery</TableHead>
                    <TableHead>Last Return</TableHead>
                    <TableHead className="text-right">Days Out</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomerBalances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                        {search ? "No matching customers found." : "No outstanding equipment."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomerBalances.map((balance) => (
                      <TableRow
                        key={balance.customerId}
                        className={balance.hasOverdueItems ? "bg-orange-50" : ""}
                      >
                        <TableCell className="font-medium">{balance.customerName}</TableCell>
                        <TableCell className="text-right">
                          {balance.trolleysOut > 0 ? (
                            <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                              {balance.trolleysOut}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {balance.shelvesOut > 0 ? (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                              {balance.shelvesOut}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(balance.lastDeliveryDate)}</TableCell>
                        <TableCell>{formatDate(balance.lastReturnDate)}</TableCell>
                        <TableCell className="text-right">
                          {balance.daysOutstanding != null ? (
                            <span
                              className={
                                balance.daysOutstanding > 14 ? "text-orange-600 font-medium" : ""
                              }
                            >
                              {balance.daysOutstanding}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {balance.hasOverdueItems ? (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Overdue
                            </Badge>
                          ) : balance.trolleysOut > 0 || balance.shelvesOut > 0 ? (
                            <Badge variant="secondary">Outstanding</Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Clear
                            </Badge>
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

        {/* Haulier Loads Tab */}
        <TabsContent value="hauliers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Current Haulier & Driver Loads</CardTitle>
              <CardDescription>
                Equipment currently loaded on trucks for delivery.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {haulierBalances.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active loads.</p>
                  <p className="text-sm">Equipment will appear here when delivery runs are loaded.</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {haulierBalances.map((haulier) => (
                    <Card key={haulier.haulierId} className="border-2">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold">{haulier.haulierName}</p>
                            {haulier.driverName && (
                              <p className="text-sm text-muted-foreground">
                                Driver: {haulier.driverName}
                              </p>
                            )}
                            {haulier.vehicleReg && (
                              <p className="text-sm text-muted-foreground">{haulier.vehicleReg}</p>
                            )}
                          </div>
                          {haulier.currentRunNumber && (
                            <Badge variant="outline">{haulier.currentRunNumber}</Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-3 bg-purple-50 rounded-lg text-center">
                            <p className="text-2xl font-bold text-purple-700">
                              {haulier.trolleysLoaded}
                            </p>
                            <p className="text-xs text-purple-600">Trolleys</p>
                          </div>
                          <div className="p-3 bg-blue-50 rounded-lg text-center">
                            <p className="text-2xl font-bold text-blue-700">
                              {haulier.shelvesLoaded}
                            </p>
                            <p className="text-xs text-blue-600">Shelves</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transaction History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>
                History of deliveries, returns, and non-return incidents.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Trolleys</TableHead>
                    <TableHead className="text-right">Shelves</TableHead>
                    <TableHead>Run / Driver</TableHead>
                    <TableHead>Docket</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                        No transactions recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentTransactions.map((tx) => (
                      <TableRow
                        key={tx.id}
                        className={tx.type === "not_returned" ? "bg-red-50" : ""}
                      >
                        <TableCell>{formatDate(tx.date)}</TableCell>
                        <TableCell>
                          {tx.type === "delivered" && (
                            <Badge className="bg-purple-100 text-purple-700">
                              <Truck className="h-3 w-3 mr-1" />
                              Delivered
                            </Badge>
                          )}
                          {tx.type === "returned" && (
                            <Badge className="bg-green-100 text-green-700">
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Returned
                            </Badge>
                          )}
                          {tx.type === "not_returned" && (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Not Returned
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{tx.customerName}</TableCell>
                        <TableCell className="text-right">{tx.trolleys || "—"}</TableCell>
                        <TableCell className="text-right">{tx.shelves || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tx.deliveryRunNumber && <div>{tx.deliveryRunNumber}</div>}
                          {tx.driverName && <div>{tx.driverName}</div>}
                        </TableCell>
                        <TableCell>
                          {tx.signedDocketUrl ? (
                            <a
                              href={tx.signedDocketUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              <FileText className="h-3 w-3" />
                              View
                            </a>
                          ) : tx.type === "not_returned" ? (
                            <Badge variant="outline" className="text-orange-600">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Needed
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {tx.notes || "—"}
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

      {/* Record Movement Dialog */}
      <Dialog open={isRecordDialogOpen} onOpenChange={setIsRecordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Equipment Movement</DialogTitle>
            <DialogDescription>
              Log trolleys and shelves delivered, returned, or not returned.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Movement Type */}
            <div className="grid gap-2">
              <Label>Movement Type</Label>
              <Select
                value={movementForm.type}
                onValueChange={(v: "delivered" | "returned" | "not_returned") =>
                  setMovementForm({ ...movementForm, type: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="delivered">
                    <span className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-purple-600" />
                      Delivered to Customer
                    </span>
                  </SelectItem>
                  <SelectItem value="returned">
                    <span className="flex items-center gap-2">
                      <RotateCcw className="h-4 w-4 text-green-600" />
                      Returned by Customer
                    </span>
                  </SelectItem>
                  <SelectItem value="not_returned">
                    <span className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      Not Returned (Log Incident)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Customer */}
            <div className="grid gap-2">
              <Label>Customer</Label>
              <Select
                value={movementForm.customerId}
                onValueChange={(v) => setMovementForm({ ...movementForm, customerId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantities */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Trolleys</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setMovementForm({
                        ...movementForm,
                        trolleys: Math.max(0, movementForm.trolleys - 1),
                      })
                    }
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    min={0}
                    className="text-center"
                    value={movementForm.trolleys}
                    onChange={(e) =>
                      setMovementForm({
                        ...movementForm,
                        trolleys: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setMovementForm({
                        ...movementForm,
                        trolleys: movementForm.trolleys + 1,
                      })
                    }
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Shelves</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setMovementForm({
                        ...movementForm,
                        shelves: Math.max(0, movementForm.shelves - 1),
                      })
                    }
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    min={0}
                    className="text-center"
                    value={movementForm.shelves}
                    onChange={(e) =>
                      setMovementForm({
                        ...movementForm,
                        shelves: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setMovementForm({
                        ...movementForm,
                        shelves: movementForm.shelves + 1,
                      })
                    }
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                placeholder={
                  movementForm.type === "not_returned"
                    ? "Describe the situation - why weren't they returned?"
                    : "Optional notes..."
                }
                value={movementForm.notes}
                onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })}
                rows={3}
              />
            </div>

            {/* Not returned warning */}
            {movementForm.type === "not_returned" && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-red-800">Signed Docket Required</p>
                    <p className="text-red-700">
                      A signed delivery docket confirming non-return should be uploaded as proof.
                    </p>
                    <Button variant="outline" size="sm" className="mt-2" disabled>
                      <Camera className="h-4 w-4 mr-2" />
                      Upload Signed Docket (Coming Soon)
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRecordDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRecordMovement}
              disabled={isSaving}
              variant={movementForm.type === "not_returned" ? "destructive" : "default"}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {movementForm.type === "not_returned" ? "Log Non-Return" : "Record Movement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
