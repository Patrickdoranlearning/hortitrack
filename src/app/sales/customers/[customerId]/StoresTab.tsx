"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  MapPin,
  ShoppingCart,
  TrendingUp,
  Calendar,
  Store,
  ChevronRight,
  Truck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { StoreWithMetricsAndPreferences } from "./types";
import { StoreDetailSheet } from "./StoreDetailSheet";

interface StoresTabProps {
  customerId: string;
  stores: StoreWithMetricsAndPreferences[];
  currency: string;
}

export function StoresTab({ customerId, stores, currency }: StoresTabProps) {
  const [selectedStore, setSelectedStore] = useState<StoreWithMetricsAndPreferences | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: currency || "EUR",
    }).format(value);
  };

  const handleStoreClick = (store: StoreWithMetricsAndPreferences) => {
    setSelectedStore(store);
    setSheetOpen(true);
  };

  if (stores.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Store className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No store locations found for this customer</p>
          <p className="text-sm text-muted-foreground mt-2">
            Add delivery addresses to track store-level metrics
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {stores.length} store location{stores.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stores.map((store) => (
          <StoreCard
            key={store.addressId}
            store={store}
            formatCurrency={formatCurrency}
            onClick={() => handleStoreClick(store)}
          />
        ))}
      </div>

      {/* Store Detail Sheet */}
      <StoreDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        store={selectedStore}
        customerId={customerId}
        currency={currency}
      />
    </div>
  );
}

function StoreCard({
  store,
  formatCurrency,
  onClick,
}: {
  store: StoreWithMetricsAndPreferences;
  formatCurrency: (value: number) => string;
  onClick: () => void;
}) {
  const displayName = store.storeName || store.label;
  const location = [store.city, store.county].filter(Boolean).join(", ");
  const hasOrders = store.orderCount > 0;
  const hasPreferences = store.preferences?.preferredDeliveryDay || store.preferences?.preferredTrolleyType;

  return (
    <Card
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-muted-foreground shrink-0" />
              <h3 className="font-medium truncate" title={displayName}>
                {displayName}
              </h3>
            </div>
            {location && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {location}
              </p>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
        </div>

        {/* Preference badges */}
        {hasPreferences && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {store.preferences.preferredDeliveryDay && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                <Calendar className="mr-1 h-2.5 w-2.5" />
                {store.preferences.preferredDeliveryDay.charAt(0).toUpperCase() + store.preferences.preferredDeliveryDay.slice(1)}
              </Badge>
            )}
            {store.preferences.preferredTrolleyType && store.preferences.preferredTrolleyType !== "none" && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                <Truck className="mr-1 h-2.5 w-2.5" />
                {store.preferences.preferredTrolleyType.charAt(0).toUpperCase() + store.preferences.preferredTrolleyType.slice(1)}
              </Badge>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ShoppingCart className="h-3 w-3" />
              Orders
            </div>
            <p className="text-lg font-semibold">{store.orderCount}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              Revenue
            </div>
            <p className="text-lg font-semibold">
              {hasOrders ? formatCurrency(store.totalRevenue) : "---"}
            </p>
          </div>
        </div>

        {hasOrders && store.lastOrderAt && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Last order
              </span>
              <span>{format(new Date(store.lastOrderAt), "dd MMM yyyy")}</span>
            </div>
            {store.avgOrderValue > 0 && (
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground">Avg. order</span>
                <span>{formatCurrency(store.avgOrderValue)}</span>
              </div>
            )}
          </div>
        )}

        {!hasOrders && (
          <div className="mt-3 pt-3 border-t">
            <Badge variant="outline" className="text-xs">
              No orders yet
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
