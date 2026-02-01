"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Package,
  Calendar,
  MapPin,
  User,
  Phone,
  Mail,
  FileText,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
// cn utility not currently used but available for future styling needs

interface OrderLine {
  id: string;
  description: string | null;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  vatRate: number | null;
  skuCode?: string;
  varietyName?: string;
  sizeName?: string;
  productName?: string;
  productGroupName?: string;
  isProductGroup: boolean;
}

interface OrderData {
  id: string;
  orderNumber: string;
  status: string;
  requestedDeliveryDate: string | null;
  deliveryInstructions: string | null;
  internalNotes: string | null;
  subTotalExVat: number | null;
  discountAmount: number | null;
  vatAmount: number | null;
  totalIncVat: number | null;
  createdAt: string;
  customer: {
    id: string;
    name: string;
    accountNumber?: string;
    phone?: string;
    email?: string;
  } | null;
  deliveryAddress: {
    line1: string;
    line2?: string;
    city?: string;
    county?: string;
    eircode?: string;
    country?: string;
  } | null;
  lines: OrderLine[];
  pickList: {
    id: string;
    status: string;
    startedAt?: string;
    completedAt?: string;
  } | null;
}

interface OrderViewPageProps {
  params: Promise<{ orderId: string }>;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: FileText },
  confirmed: { label: "Confirmed", color: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
  picking: { label: "Picking", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  ready: { label: "Ready", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  packed: { label: "Packed", color: "bg-green-100 text-green-700", icon: Package },
  dispatched: { label: "Dispatched", color: "bg-purple-100 text-purple-700", icon: Package },
  delivered: { label: "Delivered", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700", icon: AlertTriangle },
  void: { label: "Void", color: "bg-red-100 text-red-700", icon: AlertTriangle },
};

const pickStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Not Started", color: "bg-gray-100 text-gray-700" },
  in_progress: { label: "In Progress", color: "bg-yellow-100 text-yellow-700" },
  completed: { label: "Completed", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700" },
};

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "-";
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export default function OrderViewPage({ params }: OrderViewPageProps) {
  const { orderId } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/worker/orders/${orderId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to fetch order");
        }
        const data = await res.json();
        setOrder(data.order);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load order";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="px-4 py-8 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <p className="text-muted-foreground mb-4">{error || "Order not found"}</p>
        <Button onClick={() => router.back()} variant="outline">
          Go Back
        </Button>
      </div>
    );
  }

  const statusInfo = statusConfig[order.status] || statusConfig.draft;
  const StatusIcon = statusInfo.icon;
  const pickStatusInfo = order.pickList
    ? pickStatusConfig[order.pickList.status] || pickStatusConfig.pending
    : null;

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="min-h-[44px] min-w-[44px] shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">
              Order #{order.orderNumber}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge className={statusInfo.color}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusInfo.label}
              </Badge>
              {pickStatusInfo && (
                <Badge variant="outline" className={pickStatusInfo.color}>
                  Pick: {pickStatusInfo.label}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Customer Info */}
        {order.customer && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="font-medium text-lg">{order.customer.name}</div>
              {order.customer.accountNumber && (
                <div className="text-sm text-muted-foreground">
                  Account: {order.customer.accountNumber}
                </div>
              )}
              {order.customer.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${order.customer.phone}`} className="text-primary">
                    {order.customer.phone}
                  </a>
                </div>
              )}
              {order.customer.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${order.customer.email}`} className="text-primary truncate">
                    {order.customer.email}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Delivery Address */}
        {order.deliveryAddress && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Delivery Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-0.5">
                <div>{order.deliveryAddress.line1}</div>
                {order.deliveryAddress.line2 && (
                  <div>{order.deliveryAddress.line2}</div>
                )}
                {(order.deliveryAddress.city || order.deliveryAddress.county) && (
                  <div>
                    {[order.deliveryAddress.city, order.deliveryAddress.county]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                )}
                {order.deliveryAddress.eircode && (
                  <div className="font-mono text-muted-foreground">
                    {order.deliveryAddress.eircode}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delivery Date & Instructions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Delivery Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.requestedDeliveryDate ? (
              <div>
                <div className="text-sm text-muted-foreground">Requested Date</div>
                <div className="font-medium">
                  {format(parseISO(order.requestedDeliveryDate), "EEEE, MMMM d, yyyy")}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No delivery date set</div>
            )}
            {order.deliveryInstructions && (
              <div>
                <div className="text-sm text-muted-foreground">Instructions</div>
                <div className="text-sm">{order.deliveryInstructions}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pick List Status */}
        {order.pickList && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Pick Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge className={pickStatusInfo?.color || ""}>
                  {pickStatusInfo?.label || order.pickList.status}
                </Badge>
              </div>
              {order.pickList.startedAt && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Started</span>
                  <span>{format(parseISO(order.pickList.startedAt), "MMM d, h:mm a")}</span>
                </div>
              )}
              {order.pickList.completedAt && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Completed</span>
                  <span>{format(parseISO(order.pickList.completedAt), "MMM d, h:mm a")}</span>
                </div>
              )}
              {order.pickList.status === "pending" && (
                <Button
                  className="w-full mt-2"
                  onClick={() => router.push(`/worker/picking/${order.pickList?.id}`)}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Start Picking
                </Button>
              )}
              {order.pickList.status === "in_progress" && (
                <Button
                  className="w-full mt-2"
                  onClick={() => router.push(`/worker/picking/${order.pickList?.id}`)}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Continue Picking
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Order Lines */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Order Items ({order.lines.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {order.lines.map((line) => (
                <div key={line.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {line.productName ||
                          line.productGroupName ||
                          line.varietyName ||
                          line.description ||
                          "Unknown Item"}
                      </div>
                      {line.varietyName && line.sizeName && (
                        <div className="text-sm text-muted-foreground">
                          {line.varietyName} - {line.sizeName}
                        </div>
                      )}
                      {line.isProductGroup && (
                        <Badge variant="outline" className="text-xs mt-1">
                          Product Group
                        </Badge>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-medium">x{line.quantity}</div>
                      {line.unitPrice != null && (
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(line.unitPrice)} each
                        </div>
                      )}
                    </div>
                  </div>
                  {line.lineTotal != null && (
                    <div className="text-right text-sm font-medium mt-1">
                      {formatCurrency(line.lineTotal)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Order Totals */}
        {(order.subTotalExVat != null || order.totalIncVat != null) && (
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                {order.subTotalExVat != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal (ex VAT)</span>
                    <span>{formatCurrency(order.subTotalExVat)}</span>
                  </div>
                )}
                {order.discountAmount != null && order.discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(order.discountAmount)}</span>
                  </div>
                )}
                {order.vatAmount != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">VAT</span>
                    <span>{formatCurrency(order.vatAmount)}</span>
                  </div>
                )}
                <Separator />
                {order.totalIncVat != null && (
                  <div className="flex justify-between font-medium text-lg">
                    <span>Total</span>
                    <span>{formatCurrency(order.totalIncVat)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Internal Notes (if present) */}
        {order.internalNotes && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Internal Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{order.internalNotes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
