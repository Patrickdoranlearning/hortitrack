'use client';

import { useState, useMemo, useEffect } from 'react';
import { B2BProductAccordionCard } from '@/components/b2b/B2BProductAccordionCard';
import { B2BProductFilters, type ProductFilters } from '@/components/b2b/B2BProductFilters';
import { B2BCheckoutWizard } from '@/components/b2b/checkout/B2BCheckoutWizard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, LayoutGrid, List } from 'lucide-react';
import { createB2BOrder } from './actions';
import type { CustomerCatalogProductWithVarieties, CartItem } from '@/lib/b2b/types';
import type { Database } from '@/types/supabase';
import type { PricingHistoryHint } from '@/server/b2b/pricing-history';

type CustomerAddress = Database['public']['Tables']['customer_addresses']['Row'];

type B2BOrderCreateClientProps = {
  products: CustomerCatalogProductWithVarieties[];
  addresses: CustomerAddress[];
  categories: string[];
  sizes: string[];
  families: string[];
  customerId: string;
  pricingHints?: Record<string, PricingHistoryHint>;
  isAddressRestricted?: boolean;
};

export function B2BOrderCreateClient({
  products,
  addresses,
  categories,
  sizes,
  families,
  customerId,
  pricingHints,
  isAddressRestricted = false,
}: B2BOrderCreateClientProps) {
  const [trolley, setTrolley] = useState<CartItem[]>([]);
  const [filters, setFilters] = useState<ProductFilters>({
    category: null,
    size: null,
    family: null,
    search: '',
    lookingGood: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('list');
  const [checkoutStep, setCheckoutStep] = useState<string>('cart');

  // Auto-switch view mode based on screen width: list for desktop, cards for mobile
  useEffect(() => {
    const handleResize = () => {
      // Use list view on wide screens (≥1024px), cards for mobile/tablet
      const shouldUseList = window.innerWidth >= 1024;
      setViewMode(shouldUseList ? 'list' : 'card');
    };

    // Set initial value
    handleResize();

    // Listen for resize events
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check for reorder items in sessionStorage on mount
  useEffect(() => {
    const reorderData = sessionStorage.getItem('b2b_reorder_items');
    if (reorderData) {
      try {
        const reorderItems = JSON.parse(reorderData);
        // Clear sessionStorage immediately to prevent duplicate loads
        sessionStorage.removeItem('b2b_reorder_items');

        // Transform reorder items to cart items
        // Match with current catalog products to get latest prices and availability
        const cartItems: CartItem[] = reorderItems
          .map((item: any) => {
            // Find matching product in current catalog
            const product = products.find((p) => p.productId === item.product_id);
            if (!product) {
              // Product no longer available, skip
              // Product no longer in catalog - skip silently
              return null;
            }

            return {
              productId: item.product_id,
              skuId: item.sku_id,
              productName: item.description || product.productName,
              varietyName: product.varietyName,
              sizeName: product.sizeName,
              sizeId: product.sizeId || undefined,
              family: product.family || undefined,
              trolleyQuantity: product.trolleyQuantity || undefined,
              quantity: item.quantity,
              unitPriceExVat: product.unitPriceExVat ?? item.unit_price_ex_vat,
              vatRate: product.vatRate ?? item.vat_rate,
              rrp: item.rrp ?? undefined,
              multibuyPrice2: item.multibuy_price_2 ?? undefined,
              multibuyQty2: item.multibuy_qty_2 ?? undefined,
            } as CartItem;
          })
          .filter(Boolean) as CartItem[];

        if (cartItems.length > 0) {
          setTrolley(cartItems);
        }
      } catch {
        sessionStorage.removeItem('b2b_reorder_items');
      }
    }
  }, [products]);

  // Only show products during the cart step
  const showProducts = checkoutStep === 'cart';

  // Filter products based on current filters
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Family filter
      if (filters.family && product.family !== filters.family) {
        return false;
      }

      // Category filter
      if (filters.category && product.category !== filters.category) {
        return false;
      }

      // Size filter
      if (filters.size && product.sizeName !== filters.size) {
        return false;
      }

      // Looking Good filter - show only products with "plenty" status varieties
      if (filters.lookingGood) {
        const hasLookingGoodVariety = product.varieties?.some(
          (v) => v.status === 'plenty' && v.totalAvailableQty > 0
        );
        if (!hasLookingGoodVariety) {
          return false;
        }
      }

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesName = product.productName.toLowerCase().includes(searchLower);
        const matchesVariety = product.varietyName?.toLowerCase().includes(searchLower);
        const matchesVarietyAlias = product.varietyAliases?.some((a) => a.toLowerCase().includes(searchLower));
        const matchesAlias = product.aliasName?.toLowerCase().includes(searchLower);
        const matchesSku = product.skuCode?.toLowerCase().includes(searchLower);
        const matchesFamily = product.family?.toLowerCase().includes(searchLower);

        if (!matchesName && !matchesVariety && !matchesVarietyAlias && !matchesAlias && !matchesSku && !matchesFamily) {
          return false;
        }
      }

      return true;
    });
  }, [products, filters]);

  const handleAddToTrolley = (item: CartItem | CartItem[]) => {
    // Handle both single item and array of items (from accordion multi-variety orders)
    const itemsToAdd = Array.isArray(item) ? item : [item];

    const newTrolley = [...trolley];

    itemsToAdd.forEach((trolleyItem) => {
      // Check if item already exists in trolley
      const existingIndex = newTrolley.findIndex(
        (c) =>
          c.productId === trolleyItem.productId &&
          c.batchId === trolleyItem.batchId &&
          c.requiredVarietyId === trolleyItem.requiredVarietyId
      );

      if (existingIndex >= 0) {
        // Update quantity if item exists
        newTrolley[existingIndex].quantity += trolleyItem.quantity;
      } else {
        const hint = pricingHints?.[trolleyItem.productId];
        const hydratedItem: CartItem = {
          ...trolleyItem,
          rrp: trolleyItem.rrp ?? hint?.rrp ?? undefined,
          multibuyPrice2: trolleyItem.multibuyPrice2 ?? hint?.multibuyPrice2 ?? undefined,
          multibuyQty2: trolleyItem.multibuyQty2 ?? hint?.multibuyQty2 ?? undefined,
        };
        newTrolley.push(hydratedItem);
      }
    });

    setTrolley(newTrolley);
    setError(null);
  };

  const handleSubmitOrder = async (
    deliveryAddressId: string,
    deliveryDate?: string,
    notes?: string
  ) => {
    setError(null);

    try {
      const result = await createB2BOrder({
        customerId,
        cart: trolley,
        deliveryAddressId,
        deliveryDate,
        notes,
      });

      // On success, the server action redirects via redirect() — we won't reach here.
      // We only reach here if the action returned an error.
      if (result?.error) {
        setError(result.error);
      }
    } catch (err) {
      // redirect() from server action throws NEXT_REDIRECT which Next.js handles.
      // Only show error for genuine failures.
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('NEXT_REDIRECT')) return;
      setError('Failed to create order. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Place an Order</h1>
        <p className="text-muted-foreground">
          Browse products and add to your trolley. {products.length} products available.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className={`grid grid-cols-1 gap-6 ${showProducts ? 'lg:grid-cols-3' : ''}`}>
        {/* Product Catalog (2/3 width on large screens) - only shown during cart step */}
        {showProducts && (
          <div className="lg:col-span-2 space-y-4">
            {/* Filters + View Toggle */}
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <B2BProductFilters
                  categories={categories}
                  sizes={sizes}
                  families={families}
                  filters={filters}
                  onFilterChange={setFilters}
                />
              </div>
              {/* View Mode Toggle */}
              <div className="flex gap-1 border rounded-md p-1">
                <Button
                  variant={viewMode === 'card' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('card')}
                  title="Card view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  title="List view"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Product Grid/List */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No products found matching your filters.
                </p>
              </div>
            ) : viewMode === 'card' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredProducts.map((product) => (
                  <B2BProductAccordionCard
                    key={product.productId}
                    product={product}
                    onAddToTrolley={handleAddToTrolley}
                    viewMode="card"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProducts.map((product) => (
                  <B2BProductAccordionCard
                    key={product.productId}
                    product={product}
                    onAddToTrolley={handleAddToTrolley}
                    viewMode="list"
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Checkout Wizard (1/3 width when products shown, full width otherwise) */}
        <div className={showProducts ? 'lg:col-span-1' : 'max-w-xl mx-auto w-full'}>
          <B2BCheckoutWizard
            cart={trolley}
            addresses={addresses}
            pricingHints={pricingHints}
            products={products}
            onUpdateCart={setTrolley}
            onSubmit={handleSubmitOrder}
            onStepChange={(_, stepId) => setCheckoutStep(stepId)}
            error={error}
            isAddressRestricted={isAddressRestricted}
          />
        </div>
      </div>
    </div>
  );
}
