"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Truck,
  RotateCcw,
  XCircle,
  FileText,
  Download,
  ShoppingCart,
  Package,
  Calendar,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { format } from "date-fns";

type Movement = {
  id: string;
  movement_date: string;
  movement_type: "delivered" | "returned" | "not_returned" | "adjustment";
  trolleys: number;
  shelves: number;
  delivery_run_id: string | null;
  notes: string | null;
  signed_docket_url: string | null;
  recorded_by: string | null;
  delivery_runs: {
    id: string;
    run_number: string;
    driver_name: string | null;
  } | null;
};

type CustomerTrolleyLedgerClientProps = {
  customer: {
    id: string;
    name: string;
  };
  movements: Movement[];
  currentBalance: {
    trolleysOut: number;
    shelvesOut: number;
    lastDeliveryDate: string | null;
    lastReturnDate: string | null;
  };
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return format(new Date(value), "dd MMM yyyy HH:mm");
  } catch {
    return value;
  }
}

function formatDateShort(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return format(new Date(value), "dd MMM yyyy");
  } catch {
    return value;
  }
}

export function CustomerTrolleyLedgerClient({
  customer,
  movements,
  currentBalance,
}: CustomerTrolleyLedgerClientProps) {
  // Calculate running balance (newest first, so work backwards)
  const movementsWithBalance = [...movements].reverse().reduce<
    (Movement & { runningBalance: number })[]
  >((acc, m) => {
    const prevBalance = acc.length > 0 ? acc[acc.length - 1].runningBalance : 0;
    let newBalance = prevBalance;

    if (m.movement_type === "delivered") {
      newBalance = prevBalance + m.trolleys;
    } else if (m.movement_type === "returned") {
      newBalance = prevBalance - m.trolleys;
    } else if (m.movement_type === "adjustment") {
      newBalance = prevBalance - m.trolleys; // Adjustments reduce balance
    }
    // not_returned doesn't change balance (it's recorded but already counted in delivered)

    acc.push({ ...m, runningBalance: Math.max(0, newBalance) });
    return acc;
  }, []);

  // Reverse back to newest first
  const ledgerEntries = movementsWithBalance.reverse();

  // Calculate totals
  const totalDelivered = movements
    .filter((m) => m.movement_type === "delivered")
    .reduce((sum, m) => sum + m.trolleys, 0);
  const totalReturned = movements
    .filter((m) => m.movement_type === "returned")
    .reduce((sum, m) => sum + m.trolleys, 0);
  const totalNotReturned = movements.filter(
    (m) => m.movement_type === "not_returned"
  ).length;

  // Export to CSV
  const exportToCSV = () => {
    const headers = ["Date", "Type", "Trolleys", "Shelves", "Run", "Driver", "Notes", "Balance"];
    const rows = ledgerEntries.map((m) => [
      formatDate(m.movement_date),
      m.movement_type,
      m.trolleys,
      m.shelves,
      m.delivery_runs?.run_number || "",
      m.delivery_runs?.driver_name || "",
      m.notes || "",
      m.runningBalance,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trolley-ledger-${customer.name.replace(/\s+/g, "-")}-${format(
      new Date(),
      "yyyy-MM-dd"
    )}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dispatch/trolleys">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{customer.name}</h1>
            <p className="text-muted-foreground">Trolley & Shelf Ledger</p>
          </div>
        </div>
        <Button variant="outline" onClick={exportToCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <ShoppingCart className="h-4 w-4 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-purple-600">
              {currentBalance.trolleysOut}
            </p>
            <p className="text-xs text-muted-foreground">trolleys outstanding</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Shelves Out</p>
              <Package className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {currentBalance.shelvesOut}
            </p>
            <p className="text-xs text-muted-foreground">shelves outstanding</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Total Delivered</p>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-2xl font-bold">{totalDelivered}</p>
            <p className="text-xs text-muted-foreground">all time</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Total Returned</p>
              <TrendingDown className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-2xl font-bold">{totalReturned}</p>
            <p className="text-xs text-muted-foreground">all time</p>
          </CardContent>
        </Card>

        <Card className={totalNotReturned > 0 ? "border-red-200 bg-red-50" : ""}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Not Returned</p>
              <XCircle className="h-4 w-4 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-600">{totalNotReturned}</p>
            <p className="text-xs text-muted-foreground">incidents logged</p>
          </CardContent>
        </Card>
      </div>

      {/* Last Activity */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Last Delivery:</span>
              <span className="font-medium">
                {formatDateShort(currentBalance.lastDeliveryDate)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Last Return:</span>
              <span className="font-medium">
                {formatDateShort(currentBalance.lastReturnDate)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ledger Table */}
      <Card>
        <CardHeader>
          <CardTitle>Movement History</CardTitle>
          <CardDescription>
            Complete history of trolley movements for this customer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Trolleys</TableHead>
                <TableHead className="text-right">Shelves</TableHead>
                <TableHead>Run / Driver</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Docket</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledgerEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    No movements recorded for this customer.
                  </TableCell>
                </TableRow>
              ) : (
                ledgerEntries.map((m) => (
                  <TableRow
                    key={m.id}
                    className={m.movement_type === "not_returned" ? "bg-red-50" : ""}
                  >
                    <TableCell className="text-sm">{formatDate(m.movement_date)}</TableCell>
                    <TableCell>
                      {m.movement_type === "delivered" && (
                        <Badge className="bg-purple-100 text-purple-700">
                          <Truck className="h-3 w-3 mr-1" />
                          Delivered
                        </Badge>
                      )}
                      {m.movement_type === "returned" && (
                        <Badge className="bg-green-100 text-green-700">
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Returned
                        </Badge>
                      )}
                      {m.movement_type === "not_returned" && (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Not Returned
                        </Badge>
                      )}
                      {m.movement_type === "adjustment" && (
                        <Badge variant="outline">Adjustment</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {m.movement_type === "delivered" && (
                        <span className="text-purple-600">+{m.trolleys}</span>
                      )}
                      {m.movement_type === "returned" && (
                        <span className="text-green-600">-{m.trolleys}</span>
                      )}
                      {m.movement_type === "adjustment" && (
                        <span className="text-muted-foreground">-{m.trolleys}</span>
                      )}
                      {m.movement_type === "not_returned" && (
                        <span className="text-red-600">{m.trolleys}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {m.shelves > 0 ? m.shelves : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.delivery_runs?.run_number && <div>{m.delivery_runs.run_number}</div>}
                      {m.delivery_runs?.driver_name && (
                        <div className="text-xs">{m.delivery_runs.driver_name}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {m.notes || "—"}
                    </TableCell>
                    <TableCell>
                      {m.signed_docket_url ? (
                        <a
                          href={m.signed_docket_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          <FileText className="h-3 w-3" />
                          View
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {m.runningBalance}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
