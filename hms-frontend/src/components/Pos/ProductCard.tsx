import React from 'react';
import type { PosProduct } from '../../types/pos';

interface ProductCardProps {
    product: PosProduct;
    onAdd: (product: PosProduct) => void;
}

export default function ProductCard({ product, onAdd }: ProductCardProps) {
    return (
        <div
            className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between h-full"
            onClick={() => onAdd(product)}
        >
            <div>
                <h4 className="font-semibold text-lg text-gray-800">{product.name}</h4>
                <p className="text-sm text-gray-500 mb-2">{product.category}</p>
            </div>
            <div className="flex justify-between items-center mt-2">
                <span className="font-bold text-primary-600">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(product.price)}
                </span>
                <button
                    className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm hover:bg-blue-700 transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        onAdd(product);
                    }}
                >
                    Add
                </button>
            </div>
        </div>
    );
}
