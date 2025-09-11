
import { create } from 'zustand';
import type { SaleableProduct } from '@/server/sales/queries';

interface OrderItem extends SaleableProduct {
  orderQuantity: number;
  retailPrice: number;
}

interface OrderState {
  items: OrderItem[];
  addItem: (product: SaleableProduct) => void;
  removeItem: (productId: string) => void;
  updateItem: (productId: string, quantity: number, price: number) => void;
  totalCost: () => number;
  totalItems: () => number;
  clearOrder: () => void;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  items: [],
  addItem: (product) =>
    set((state) => {
      const existingItem = state.items.find((item) => item.id === product.id);
      if (existingItem) {
        return { items: state.items };
      }
      return { items: [...state.items, { ...product, orderQuantity: 1, retailPrice: product.cost || 0 }] };
    }),
  removeItem: (productId) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== productId),
    })),
  updateItem: (productId, quantity, price) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === productId ? { ...item, orderQuantity: quantity, retailPrice: price } : item
      ),
    })),
  totalCost: () => {
    return get().items.reduce((total, item) => total + item.orderQuantity * item.retailPrice, 0);
  },
  totalItems: () => {
    return get().items.reduce((total, item) => total + item.orderQuantity, 0);
  },
  clearOrder: () => set({ items: [] }),
}));
