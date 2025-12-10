'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { B2BProductCard } from '@/components/b2b/B2BProductCard';
import { B2BProductAccordionCard } from '@/components/b2b/B2BProductAccordionCard';
import { B2BProductFilters } from '@/components/b2b/B2BProductFilters';
import { B2BCartSidebar } from '@/components/b2b/B2BCartSidebar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, LayoutGrid, List } from 'lucide-react';
import { createB2BOrder } from './actions';
import type { CustomerCatalogProduct, CustomerCatalogProductWithVarieties, CartItem } from '@/lib/b2b/types';
import type { Database } from '@/types/supabase';

type CustomerAddress = Database['public']['Tables']['customer_addresses']['Row'];

type B2BOrderCreateClientProps = {
  products: CustomerCatalogProductWithVarieties[];
  addresses: CustomerAddress[];
  categories: string[];
  sizes: string[];
  customerId: string;
};

// Feature flag for accordion card (can be env var later)
const USE_ACCORDION_CARD = process.env.NEXT_PUBLIC_USE_ACCORDION_CARD === 'true';

export function B2BOrderCreateClient({
  products,
  addresses,
  categories,
  sizes,
  customerId,
}: B2BOrderCreateClientProps) {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [filters, setFilters] = useState({
    category: null as string | null,
    size: null as string | null,
    search: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  // Filter products based on current filters
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Category filter
      if (filters.category && product.category !== filters.category) {
        return false;
      }

      // Size filter
      if (filters.size && product.sizeName !== filters.size) {
        return false;
      }

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesName = product.productName.toLowerCase().includes(searchLower);
        const matchesVariety = product.varietyName?.toLowerCase().includes(searchLower);
        const matchesVarietyAlias = product.varietyAliases?.some((a) => a.toLowerCase().includes(searchLower));
        const matchesAlias = product.aliasName?.toLowerCase().includes(searchLower);
        const matchesSku = product.skuCode?.toLowerCase().includes(searchLower);

        if (!matchesName && !matchesVariety && !matchesVarietyAlias && !matchesAlias && !matchesSku) {
          return false;
        }
      }

      return true;
    });
  }, [products, filters]);

  const handleAddToCart = (item: CartItem | CartItem[]) => {
    // Handle both single item and array of items (from accordion multi-variety orders)
    const itemsToAdd = Array.isArray(item) ? item : [item];

    const newCart = [...cart];

    itemsToAdd.forEach((cartItem) => {
      // Check if item already exists in cart
      const existingIndex = newCart.findIndex(
        (c) =>
          c.productId === cartItem.productId &&
          c.batchId === cartItem.batchId &&
          c.requiredVarietyId === cartItem.requiredVarietyId
      );

      if (existingIndex >= 0) {
        // Update quantity if item exists
        newCart[existingIndex].quantity += cartItem.quantity;
      } else {
        // Add new item
        newCart.push(cartItem);
      }
    });

    setCart(newCart);
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
        cart,
        deliveryAddressId,
        deliveryDate,
        notes,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.orderId) {
        // Success - redirect to order detail
        router.push(`/b2b/orders/${result.orderId}`);
      }
    } catch (err) {
      setError('Failed to create order. Please try again.');
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Place an Order</h1>
        <p className="text-muted-foreground">
          Browse products and add to cart. {products.length} products available.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Catalog (2/3 width on large screens) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters + View Toggle */}
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <B2BProductFilters
                categories={categories}
                sizes={sizes}
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
          ) : USE_ACCORDION_CARD ? (
            // NEW: Accordion Card View
            viewMode === 'card' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredProducts.map((product) => (
                  <B2BProductAccordionCard
                    key={product.productId}
                    product={product}
                    onAddToCart={handleAddToCart}
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
                    onAddToCart={handleAddToCart}
                    viewMode="list"
                  />
                ))}
              </div>
            )
          ) : (
            // LEGACY: Original Card View
            viewMode === 'card' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredProducts.map((product) => (
                  <B2BProductCard
                    key={product.productId}
                    product={product as CustomerCatalogProduct}
                    onAddToCart={handleAddToCart}
                    viewMode="card"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {/* List Header */}
                <div className="hidden md:flex items-center gap-4 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                  <div className="w-12" />
                  <div className="flex-1">Product</div>
                  <div className="w-20 text-right">Price</div>
                  <div className="w-[140px]">Batch</div>
                  <div className="w-20">Qty</div>
                  <div className="w-20">RRP</div>
                  <div className="w-10" />
                </div>
                {filteredProducts.map((product) => (
                  <B2BProductCard
                    key={product.productId}
                    product={product as CustomerCatalogProduct}
                    onAddToCart={handleAddToCart}
                    viewMode="list"
                  />
                ))}
              </div>
            )
          )}
        </div>

        {/* Cart Sidebar (1/3 width on large screens) */}
        <div className="lg:col-span-1">
          <B2BCartSidebar
            cart={cart}
            addresses={addresses}
            onUpdateCart={setCart}
            onSubmit={handleSubmitOrder}
          />
        </div>
      </div>
    </div>
  );
}
