import React from 'react';
import type { PosProduct } from '../../types/pos';

interface ProductCardProps {
    product: PosProduct;
    onAdd: (product: PosProduct) => void;
}

export default function ProductCard({ product, onAdd }: ProductCardProps) {
    const unavailable = !product.isAvailable;
    const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

    return (
        <div
            className={`bg-white rounded-xl border transition-all flex flex-col justify-between h-full relative group ${
                unavailable
                    ? 'border-gray-200 opacity-50 cursor-not-allowed'
                    : 'border-gray-200 hover:border-blue-300 hover:shadow-md cursor-pointer'
            }`}
            onClick={() => !unavailable && onAdd(product)}
        >
            {unavailable && (
                <span className="absolute top-1.5 right-1.5 sm:top-2.5 sm:right-2.5 text-[10px] sm:text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                    Unavailable
                </span>
            )}
            {!unavailable && product.discountRate != null && product.discountRate > 0 && (
                <span className="absolute top-1.5 right-1.5 sm:top-2.5 sm:right-2.5 text-[10px] sm:text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                    −{product.discountRate}%
                </span>
            )}

            <div className="p-3 pb-2 sm:p-4 sm:pb-3">
                <p className="hidden sm:block text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">{product.categoryName}</p>
                <h4 className="font-semibold text-gray-900 leading-snug text-sm sm:text-base">{product.name}</h4>
                {product.description && (
                    <p className="hidden sm:block text-xs text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">{product.description}</p>
                )}
            </div>

            <div className="px-3 pb-3 sm:px-4 sm:pb-4 flex justify-between items-center">
                <span className="font-bold text-blue-600 text-sm sm:text-base">{fmt(product.price)}</span>
                <button
                    disabled={unavailable}
                    className="bg-blue-600 text-white px-3 py-2 text-xs sm:px-4 sm:py-2.5 sm:text-sm lg:px-5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm min-h-[40px] sm:min-h-[44px]"
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
