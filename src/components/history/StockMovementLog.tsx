"use client";

import * as React from "react";
import Link from "next/link";
import type { StockMovement } from "@/lib/history-types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowDownLeft, ArrowUpRight, Clock, ExternalLink } from "lucide-react";

const TYPE_META: Record<string, {
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
  icon: 'in' | 'out' | 'reserved' | null;
}> = {
  initial: { label: "Initial", variant: "default", icon: 'in' },
  checkin: { label: "Check In", variant: "default", icon: 'in' },
  create: { label: "Created", variant: "default", icon: 'in' },
  transplant_in: { label: "Transplant In", variant: "default", icon: 'in' },
  transplant_from: { label: "Transplant In", variant: "default", icon: 'in' },
  propagation_in: { label: "Propagation In", variant: "default", icon: 'in' },
  transplant_out: { label: "Transplant Out", variant: "secondary", icon: 'out' },
  transplant_to: { label: "Transplant Out", variant: "secondary", icon: 'out' },
  allocated: { label: "Reserved", variant: "outline", icon: 'reserved' },
  picked: { label: "Sold", variant: "destructive", icon: 'out' },
  sale: { label: "Sold", variant: "destructive", icon: 'out' },
  dispatch: { label: "Dispatched", variant: "destructive", icon: 'out' },
  loss: { label: "Loss", variant: "destructive", icon: 'out' },
  dump: { label: "Dumped", variant: "destructive", icon: 'out' },
  adjustment: { label: "Adjustment", variant: "outline", icon: null },
};

interface StockMovementLogProps {
  movements: StockMovement[];
  compact?: boolean;
}

export function StockMovementLog({ movements, compact = false }: StockMovementLogProps) {
  const [q, setQ] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("");

  const filtered = movements.filter(m => {
    const typeMatch = typeFilter ? m.type === typeFilter : true;
    const searchMatch = q
      ? (m.title?.toLowerCase().includes(q.toLowerCase()) ||
         m.details?.toLowerCase().includes(q.toLowerCase()) ||
         m.destination?.customerName?.toLowerCase().includes(q.toLowerCase()) ||
         m.destination?.batchNumber?.toLowerCase().includes(q.toLowerCase()))
      : true;
    return typeMatch && searchMatch;
  });

  // Get unique types from movements for filter dropdown
  const uniqueTypes = [...new Set(movements.map(m => m.type))];

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex flex-wrap gap-2 items-center">
          <input
            placeholder="Search movements..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm flex-1 min-w-[150px]"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm"
          >
            <option value="">All types</option>
            {uniqueTypes.map(type => {
              const meta = TYPE_META[type] || { label: type };
              return <option key={type} value={type}>{meta.label}</option>;
            })}
          </select>
          <div className="text-xs text-muted-foreground">{filtered.length} movements</div>
        </div>
      )}

      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[90px]">Date</TableHead>
                <TableHead className="w-[110px]">Type</TableHead>
                <TableHead className="w-[70px] text-right text-emerald-600">In</TableHead>
                <TableHead className="w-[70px] text-right text-rose-600">Out</TableHead>
                <TableHead className="w-[80px] text-right font-semibold">Balance</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No stock movements found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m) => {
                  const meta = TYPE_META[m.type] || { label: m.type, variant: "outline" as const, icon: null };
                  const isAllocation = m.type === 'allocated';
                  const isIn = m.quantity > 0;
                  const isOut = m.quantity < 0 && !isAllocation; // Allocations are not real outflows

                  return (
                    <TableRow key={m.id} className={isAllocation ? "bg-amber-50/30" : isOut ? "bg-rose-50/30" : isIn ? "bg-emerald-50/30" : ""}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(m.at).toLocaleDateString()}
                        <br />
                        <span className="text-[10px]">
                          {new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {meta.icon === 'in' && <ArrowDownLeft className="h-3 w-3 text-emerald-600" />}
                          {meta.icon === 'out' && <ArrowUpRight className="h-3 w-3 text-rose-600" />}
                          {meta.icon === 'reserved' && <Clock className="h-3 w-3 text-amber-600" />}
                          <Badge variant={meta.variant} className={`text-xs ${isAllocation ? 'bg-amber-100 text-amber-800 border-amber-300' : ''}`}>
                            {meta.label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium text-emerald-600">
                        {isIn ? `+${m.quantity.toLocaleString()}` : ''}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-medium ${isAllocation ? 'text-amber-600' : 'text-rose-600'}`}>
                        {isAllocation ? `(${Math.abs(m.quantity).toLocaleString()})` : isOut ? m.quantity.toLocaleString() : ''}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {m.runningBalance != null ? m.runningBalance.toLocaleString() : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="text-sm">{m.title}</div>
                          {m.destination && (
                            <DestinationLink destination={m.destination} />
                          )}
                          {m.details && !m.destination && (
                            <div className="text-xs text-muted-foreground">{m.details}</div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Summary footer */}
      {filtered.length > 0 && (
        <div className="flex gap-4 text-xs text-muted-foreground justify-end flex-wrap">
          <span>
            Total In: <span className="font-semibold text-emerald-600">
              +{filtered.filter(m => m.quantity > 0).reduce((sum, m) => sum + m.quantity, 0).toLocaleString()}
            </span>
          </span>
          <span>
            Total Out: <span className="font-semibold text-rose-600">
              {filtered.filter(m => m.quantity < 0 && m.type !== 'allocated').reduce((sum, m) => sum + m.quantity, 0).toLocaleString()}
            </span>
          </span>
          {filtered.some(m => m.type === 'allocated') && (
            <span>
              Reserved: <span className="font-semibold text-amber-600">
                ({filtered.filter(m => m.type === 'allocated').reduce((sum, m) => sum + Math.abs(m.quantity), 0).toLocaleString()})
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function DestinationLink({ destination }: { destination: StockMovement['destination'] }) {
  if (!destination) return null;

  switch (destination.type) {
    case 'order':
      return (
        <Link
          href={`/sales/orders/${destination.orderId}`}
          className="text-xs text-sky-600 hover:underline flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3" />
          Order #{destination.orderNumber} - {destination.customerName}
        </Link>
      );
    case 'batch':
      return (
        <Link
          href={`/production/batches/${destination.batchId}`}
          className="text-xs text-violet-600 hover:underline flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3" />
          Batch {destination.batchNumber}
        </Link>
      );
    case 'loss':
      return (
        <span className="text-xs text-rose-600">
          Reason: {destination.lossReason}
        </span>
      );
    case 'supplier':
      return (
        <span className="text-xs text-muted-foreground">
          From: {destination.supplierName}
        </span>
      );
    default:
      return null;
  }
}
