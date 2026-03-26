import React from 'react';
import type { PosProduct } from '../../types/pos';

interface ProductCardProps {
    product: PosProduct;
    onAdd: (product: PosProduct) => void;
}

export default function ProductCard({ product, onAdd }: ProductCardProps) {
    const unavailable = !product.isAvailable;

    return (
        <div
            className={`bg-white p-4 rounded-lg shadow-sm border transition-shadow flex flex-col justify-between h-full relative ${
                unavailable
                    ? 'border-gray-200 opacity-50 cursor-not-allowed'
                    : 'border-gray-200 hover:shadow-md cursor-pointer'
            }`}
            onClick={() => !unavailable && onAdd(product)}
        >
            {unavailable && (
                <span className="absolute top-2 right-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                    Unavailable
                </span>
            )}
            <div>
                <h4 className="font-semibold text-lg text-gray-800">{product.name}</h4>
                <p className="text-sm text-gray-500 mb-2">{product.category}</p>
                {product.description && (
                    <p className="text-xs text-gray-400 mb-1 line-clamp-2">{product.description}</p>
                )}
            </div>
            <div className="flex justify-between items-center mt-2">
                <span className="font-bold text-blue-600">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(product.price)}
                </span>
                <button
                    disabled={unavailable}
                    className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!unavailable) onAdd(product);
                    }}
                >
                    Add
                </button>
            </div>
        </div>
    );
}
