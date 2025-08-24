import React from 'react';
import { Product } from '../lib/sales/types';
import ProductItem from './ProductItem';

interface ProductListProps {
  products: Product[];
}

const ProductList: React.FC<ProductListProps> = ({ products }) => {
  return (
    <div>
      <h2>Available Products</h2>
      {products.length === 0 ? (
        <p>No products available.</p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <li key={product.id} className="border p-4 rounded-md">
              <ProductItem product={product} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ProductList;