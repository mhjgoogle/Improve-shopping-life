import React from 'react';
import { Product } from '../types';
import { Button } from './Button';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onSelect }) => {
  return (
    <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
      <div className="relative h-48 bg-gray-100">
        <img 
          src={product.imageUrl} 
          alt={product.name} 
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md font-medium backdrop-blur-sm">
          {product.price}
        </div>
      </div>
      <div className="p-3 flex flex-col flex-grow">
        <h3 className="font-bold text-gray-800 text-sm mb-1 line-clamp-1">{product.name}</h3>
        <p className="text-gray-500 text-xs mb-3 line-clamp-2 flex-grow">{product.description}</p>
        <Button 
          variant="outline" 
          onClick={() => onSelect(product)}
          className="w-full py-2 text-xs rounded-lg border-indigo-200 hover:bg-indigo-50"
        >
          Select
        </Button>
      </div>
    </div>
  );
};