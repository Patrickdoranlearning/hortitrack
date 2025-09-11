
'use client';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { useOrderStore } from '@/stores/use-order-store';
import { SaleableProduct } from '@/server/sales/queries';
import Image from 'next/image';

interface ProductCardProps {
  product: SaleableProduct;
}

const ProductCard = ({ product }: ProductCardProps) => {
    const { items, updateItem, addItem } = useOrderStore();
    const orderItem = items.find(i => i.id === product.id);
  
    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const quantity = parseInt(e.target.value) || 0;
      if (orderItem) {
        updateItem(product.id, quantity, orderItem.retailPrice);
      } else if (quantity > 0) {
        addItem(product);
        updateItem(product.id, quantity, product.cost || 0);
      }
    };
  
    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const price = parseFloat(e.target.value) || 0;
      if (orderItem) {
        updateItem(product.id, orderItem.orderQuantity, price);
      } else if (price > 0) {
          addItem(product);
          updateItem(product.id, 0, price);
      }
    };
  
    return (
      <div className="border bg-white p-4 rounded-lg flex items-center gap-4">
        <Image src={product.imageUrl || ''} alt={product.plantVariety} width={100} height={100} className="rounded-md object-cover" data-ai-hint="plant product" />
        <div className="flex-1 grid grid-cols-3 gap-4 text-sm">
          <div>
            <h3 className="font-semibold text-base">{product.plantVariety} - {product.size}</h3>
            <p className="text-muted-foreground">BARCODE</p>
            <p>{product.barcode}</p>
          </div>
          <div>
            <p className="text-muted-foreground">STATUS</p>
            <p>{product.status}</p>
          </div>
          <div>
            <p className="text-muted-foreground">COST</p>
            <p>€{product.cost?.toFixed(2)}</p>
          </div>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-4 items-center">
            <div>
                <label className="text-xs text-muted-foreground">RETAIL PRICE</label>
                <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2">€</span>
                    <Input type="number" step="0.01" value={orderItem?.retailPrice || ''} onChange={handlePriceChange} className="pl-6" />
                </div>
            </div>
            <div>
                <label className="text-xs text-muted-foreground">QTY</label>
                <Input type="number" value={orderItem?.orderQuantity || ''} onChange={handleQuantityChange} />
            </div>
        </div>
      </div>
    );
  };

const OrderSummaryFooter = () => {
    const { totalCost, totalItems } = useOrderStore();
    const cost = totalCost();
    const items = totalItems();
  
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-green-800 text-white p-4 flex justify-between items-center shadow-lg">
        <div className="text-lg">
          You have {items} items
        </div>
        <div className="flex items-center gap-6">
          <div className="text-2xl font-bold">
            Order Total €{cost.toFixed(2)}
          </div>
          <Button variant="secondary" className="bg-white text-green-800 hover:bg-gray-200">
            PROCEED WITH ORDER
          </Button>
        </div>
      </div>
    );
};

export function OrderPlacementClient({ products, categories }: { products: SaleableProduct[], categories: string[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredProducts = useMemo(() => {
    return products
      .filter(p => selectedCategory === 'all' || p.category === selectedCategory)
      .filter(p => p.plantVariety.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [products, selectedCategory, searchQuery]);

  const groupedProducts = useMemo(() => {
    return filteredProducts.reduce((acc, product) => {
      const category = product.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(product);
      return acc;
    }, {} as Record<string, SaleableProduct[]>);
  }, [filteredProducts]);

  return (
    <div className="min-h-screen bg-gray-100 pb-24">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Create Order - Doran Nurseries</h1>
            <div className="flex items-center gap-4">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-48">
                        <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                </Select>
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search products..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="space-y-8">
            {Object.entries(groupedProducts).map(([category, products]) => (
                <div key={category}>
                    <div className="bg-green-700 text-white font-semibold px-4 py-2 rounded-t-lg">
                        {category}
                    </div>
                    <div className="space-y-2 bg-gray-50 p-2 rounded-b-lg">
                        {products.map(product => <ProductCard key={product.id} product={product} />)}
                    </div>
                </div>
            ))}
        </div>
      </main>
      <OrderSummaryFooter />
    </div>
  );
}
