import React from 'react';
import { Product } from '../types';
import { Button } from './Button';

interface ProductCardProps {
  product: Product;
  onSelect?: (product: Product) => void;
  onTryOn: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onTryOn }) => {
  return (
    <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full group">
      <div className="relative h-48 bg-gray-100 overflow-hidden">
        {/* Clickable Image for External Link */}
        <a href={product.link} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
          <img 
            src={product.imageUrl} 
            alt={product.name} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </a>
        <div className="absolute top-2 left-2 bg-white/90 text-gray-800 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
          {product.source || 'Store'}
        </div>
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md font-medium backdrop-blur-sm">
          {product.price}
        </div>
      </div>
      <div className="p-3 flex flex-col flex-grow">
        <a href={product.link} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-indigo-600 transition-colors">
          <h3 className="font-bold text-gray-800 text-sm mb-1 line-clamp-1">{product.name}</h3>
        </a>
        <p className="text-gray-500 text-xs mb-3 line-clamp-2 flex-grow">{product.description}</p>
        
        <div className="mt-auto flex gap-2">
          <Button 
            variant="secondary" 
            fullWidth
            onClick={() => onTryOn(product)}
            className="py-2 text-xs rounded-lg shadow-none"
          >
            試着する (Try On)
          </Button>
        </div>
      </div>
    </div>
  );
};