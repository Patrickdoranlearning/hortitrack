"use client";

import React, { useState, useEffect } from 'react';
import { Product } from '../../../lib/sales/types';
import ProductList from '../../../components/sales/ProductList';
import OrderCart from '../../../components/sales/OrderCart';

const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Rose Bush',
    description: 'Beautiful red roses',
    price: 15.99,
    availableStock: 100,
  },
  {
    id: '2',
    name: 'Tulip Bulbs',
    description: 'Assorted color tulips',
    price: 5.99,
    availableStock: 250,
  },
  {
    id: '3',
    name: 'Sunflower Seeds',
    description: 'Giant sunflowers',
    price: 2.50,
    availableStock: 500,
  },
];

const OrderPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    // In a real application, you would fetch data from an API here
    setProducts(mockProducts);
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Place an Order</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <ProductList products={products} />
        </div>
        <div className="md:col-span-1">
          <OrderCart />
        </div>
      </div>
    </div>
  );
};

export default OrderPage;