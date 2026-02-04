'use client';

import { useState, useEffect, useRef } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ShoppingCart,
  TrendingUp,
  Package,
  Calendar,
  Star,
  Clock,
  MapPin,
  Phone,
  Mail,
  Printer,
  User,
  AlertCircle,
  Gift,
} from 'lucide-react';
import { getCustomerFollowUpsAction, getUpcomingMilestonesAction } from '@/app/sales/customers/actions';
import type { CustomerSummary } from '@/app/sales/customers/types';
import type { CustomerOrder, FavouriteProduct, CustomerStats, CustomerInteraction, CustomerFollowUp, CustomerMilestone } from '@/app/sales/customers/[customerId]/types';

interface VisitPrepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: CustomerSummary;
  orders: CustomerOrder[];
  favouriteProducts: FavouriteProduct[];
  interactions: CustomerInteraction[];
  stats: CustomerStats;
}

function StatBox({ icon: Icon, label, value }: { icon: typeof ShoppingCart; label: string; value: string | number }) {
  return (
    <div className="text-center p-3 bg-muted/50 rounded-lg">
      <Icon className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function VisitPrepDialog({
  open,
  onOpenChange,
  customer,
  orders,
  favouriteProducts,
  interactions,
  stats,
}: VisitPrepDialogProps) {
  const [followUps, setFollowUps] = useState<CustomerFollowUp[]>([]);
  const [milestones, setMilestones] = useState<CustomerMilestone[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, customer.id]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [followUpsResult, milestonesResult] = await Promise.all([
        getCustomerFollowUpsAction(customer.id, false),
        getUpcomingMilestonesAction(customer.id, 30),
      ]);

      if (followUpsResult.success) {
        setFollowUps(followUpsResult.followUps);
      }
      if (milestonesResult.success) {
        setMilestones(milestonesResult.milestones);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: customer.currency || 'EUR',
    }).format(value);
  };

  // Derived data
  const topProducts = favouriteProducts.slice(0, 5);
  const recentInteractions = interactions.slice(0, 3);
  const lastOrder = orders[0];
  const daysSinceLastOrder = lastOrder
    ? differenceInDays(new Date(), new Date(lastOrder.createdAt))
    : null;
  const defaultAddress = customer.addresses.find((a) => a.isDefaultShipping) ?? customer.addresses[0];
  const primaryContact = customer.contacts.find((c) => c.isPrimary) ?? customer.contacts[0];

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Visit Prep - ${customer.name}</title>
          <style>
            @media print {
              body { margin: 0; padding: 20px; font-family: system-ui, -apple-system, sans-serif; font-size: 12px; }
              * { box-sizing: border-box; }
            }
            body { margin: 0; padding: 20px; font-family: system-ui, -apple-system, sans-serif; font-size: 12px; max-width: 800px; }
            .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
            .header h1 { margin: 0 0 5px 0; font-size: 18px; }
            .header p { margin: 0; color: #666; font-size: 11px; }
            .section { margin-bottom: 15px; }
            .section-title { font-weight: bold; font-size: 13px; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin-bottom: 8px; }
            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
            .stat-box { text-align: center; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
            .stat-box .value { font-size: 16px; font-weight: bold; }
            .stat-box .label { font-size: 10px; color: #666; }
            .product-item { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #eee; }
            .contact-info { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
            .contact-info p { margin: 2px 0; }
            .follow-up { padding: 5px; background: #fff3cd; border-radius: 4px; margin-bottom: 5px; }
            .interaction { padding: 5px; border-left: 2px solid #ccc; margin-bottom: 5px; padding-left: 10px; }
            .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 10px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <div class="footer">
            Printed on ${format(new Date(), 'dd MMM yyyy HH:mm')} | HortiTrack
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">Visit Preparation</DialogTitle>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </DialogHeader>

        <div ref={printRef} className="space-y-6">
          {/* Header */}
          <div className="header">
            <h1 className="text-xl font-bold">{customer.name}</h1>
            {customer.code && <p className="text-sm text-muted-foreground">Code: {customer.code}</p>}
          </div>

          {/* Quick Stats */}
          <div className="section">
            <h3 className="section-title text-sm font-semibold mb-3">Quick Stats</h3>
            <div className="grid grid-cols-4 gap-3">
              <StatBox icon={ShoppingCart} label="Total Orders" value={stats.totalOrders} />
              <StatBox icon={TrendingUp} label="Total Revenue" value={formatCurrency(stats.totalRevenue)} />
              <StatBox icon={Package} label="Avg Order" value={formatCurrency(stats.averageOrderValue)} />
              <StatBox
                icon={Calendar}
                label="Last Order"
                value={daysSinceLastOrder !== null ? `${daysSinceLastOrder}d ago` : 'Never'}
              />
            </div>
          </div>

          <Separator />

          {/* Top Products */}
          <div className="section">
            <h3 className="section-title text-sm font-semibold mb-3 flex items-center gap-2">
              <Star className="h-4 w-4" />
              Top 5 Products
            </h3>
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No order history</p>
            ) : (
              <div className="space-y-2">
                {topProducts.map((product, index) => (
                  <div key={product.skuId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                        {index + 1}
                      </span>
                      <span className="truncate max-w-[200px]">{product.productName}</span>
                    </div>
                    <span className="font-medium">{product.totalQuantity} units ({product.orderCount} orders)</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Two-column layout for Activity and Follow-ups */}
          <div className="grid grid-cols-2 gap-6">
            {/* Recent Activity */}
            <div className="section">
              <h3 className="section-title text-sm font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Activity
              </h3>
              {recentInteractions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent interactions</p>
              ) : (
                <div className="space-y-3">
                  {recentInteractions.map((interaction) => (
                    <div key={interaction.id} className="text-sm border-l-2 border-muted pl-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {interaction.type}
                        </Badge>
                        {interaction.outcome && (
                          <Badge variant="secondary" className="text-xs">
                            {interaction.outcome.replace(/_/g, ' ')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs mt-1 line-clamp-2">
                        {interaction.notes}
                      </p>
                      <p className="text-muted-foreground text-xs mt-1">
                        {format(parseISO(interaction.createdAt), 'dd MMM yyyy')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending Follow-Ups */}
            <div className="section">
              <h3 className="section-title text-sm font-semibold mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Pending Follow-Ups
              </h3>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : followUps.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending follow-ups</p>
              ) : (
                <div className="space-y-2">
                  {followUps.map((followUp) => (
                    <div key={followUp.id} className="text-sm p-2 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-900">
                      <p className="font-medium">{followUp.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Due: {format(parseISO(followUp.dueDate), 'dd MMM yyyy')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Two-column layout for Milestones and Contact */}
          <div className="grid grid-cols-2 gap-6">
            {/* Upcoming Milestones */}
            <div className="section">
              <h3 className="section-title text-sm font-semibold mb-3 flex items-center gap-2">
                <Gift className="h-4 w-4" />
                Upcoming Milestones (30 days)
              </h3>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : milestones.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming milestones</p>
              ) : (
                <div className="space-y-2">
                  {milestones.map((milestone) => (
                    <div key={milestone.id} className="text-sm flex items-center gap-2">
                      <Gift className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="font-medium">{milestone.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(milestone.eventDate), 'dd MMM yyyy')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Contact Info */}
            <div className="section">
              <h3 className="section-title text-sm font-semibold mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Contact Info
              </h3>
              <div className="space-y-2 text-sm">
                {primaryContact && (
                  <div className="space-y-1">
                    <p className="font-medium">{primaryContact.name}</p>
                    {primaryContact.role && (
                      <p className="text-xs text-muted-foreground">{primaryContact.role}</p>
                    )}
                    {primaryContact.phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {primaryContact.phone}
                      </p>
                    )}
                    {primaryContact.email && (
                      <p className="flex items-center gap-2">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        {primaryContact.email}
                      </p>
                    )}
                  </div>
                )}
                {defaultAddress && (
                  <div className="pt-2 border-t">
                    <p className="flex items-start gap-2">
                      <MapPin className="h-3 w-3 text-muted-foreground mt-1 flex-shrink-0" />
                      <span>
                        {[defaultAddress.line1, defaultAddress.city, defaultAddress.county, defaultAddress.eircode]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </p>
                  </div>
                )}
                {!primaryContact && !defaultAddress && (
                  <p className="text-muted-foreground">No contact info available</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default VisitPrepDialog;
