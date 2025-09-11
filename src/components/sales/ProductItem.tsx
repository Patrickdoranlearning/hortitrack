import React from 'react';
import { Product } from '../../lib/sales/types';

interface ProductItemProps {
  product: Product;
}

const ProductItem: React.FC<ProductItemProps> = ({ product }) => {
  return (
    <div className="border p-4 mb-4 rounded-md">
      <h3 className="text-lg font-semibold">{product.name}</h3>
      <p className="text-gray-600">{product.description}</p>
      <p className="text-green-700 font-medium">${product.price.toFixed(2)}</p>
      <p className="text-sm text-gray-500">Available Stock: {product.availableStock}</p>
      <button className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
        Add to Order
      </button>
    </div>
  );
};

export default ProductItem;