import { useState, useRef, useEffect } from 'react';
import type { PosProduct } from '../../types/pos';

interface ProductCardProps {
    product: PosProduct;
    onAdd: (product: PosProduct, priceOverride?: number) => void;
}

export default function ProductCard({ product, onAdd }: ProductCardProps) {
    const unavailable = !product.isAvailable;
    const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

    const [enteringPrice, setEnteringPrice] = useState(false);
    const [customPrice, setCustomPrice] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (enteringPrice) {
            setCustomPrice('');
            inputRef.current?.focus();
        }
    }, [enteringPrice]);

    const handleAdd = () => {
        if (unavailable) return;
        if (product.isPriceOverridable) {
            setEnteringPrice(true);
        } else {
            onAdd(product);
        }
    };

    const handleConfirmPrice = () => {
        const price = parseFloat(customPrice);
        if (!price || price <= 0) return;
        onAdd(product, price);
        setEnteringPrice(false);
        setCustomPrice('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleConfirmPrice();
        if (e.key === 'Escape') { setEnteringPrice(false); setCustomPrice(''); }
    };

    return (
        <div
            className={`bg-white rounded-xl border transition-all flex flex-col justify-between h-full relative group ${
                unavailable
                    ? 'border-gray-200 opacity-50 cursor-not-allowed'
                    : 'border-gray-200 hover:border-blue-300 hover:shadow-md cursor-pointer'
            }`}
            onClick={() => !unavailable && !enteringPrice && handleAdd()}
        >
            {unavailable && (
                <span className="absolute top-1.5 right-1.5 sm:top-2.5 sm:right-2.5 text-[10px] sm:text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                    Unavailable
                </span>
            )}
            {!unavailable && !product.isPriceOverridable && product.discountRate != null && product.discountRate > 0 && (
                <span className="absolute top-1.5 right-1.5 sm:top-2.5 sm:right-2.5 text-[10px] sm:text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                    −{product.discountRate}%
                </span>
            )}
            {!unavailable && product.isPriceOverridable && (
                <span className="absolute top-1.5 right-1.5 sm:top-2.5 sm:right-2.5 text-[10px] sm:text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                    Custom
                </span>
            )}

            <div className="p-3 pb-2 sm:p-4 sm:pb-3">
                <p className="hidden sm:block text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">{product.categoryName}</p>
                <h4 className="font-semibold text-gray-900 leading-snug text-sm sm:text-base">{product.name}</h4>
                {product.description && (
                    <p className="hidden sm:block text-xs text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">{product.description}</p>
                )}
            </div>

            {enteringPrice ? (
                <div className="px-3 pb-3 sm:px-4 sm:pb-4 space-y-2" onClick={e => e.stopPropagation()}>
                    <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">₹</span>
                        <input
                            ref={inputRef}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Enter price"
                            value={customPrice}
                            onChange={e => setCustomPrice(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full border border-blue-400 rounded-lg pl-7 pr-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex gap-1.5">
                        <button
                            onClick={() => { setEnteringPrice(false); setCustomPrice(''); }}
                            className="flex-1 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirmPrice}
                            disabled={!customPrice || parseFloat(customPrice) <= 0}
                            className="flex-1 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Add
                        </button>
                    </div>
                </div>
            ) : (
                <div className="px-3 pb-3 sm:px-4 sm:pb-4 flex justify-between items-center">
                    <span className="font-bold text-blue-600 text-sm sm:text-base">
                        {product.isPriceOverridable ? 'Custom' : fmt(product.price)}
                    </span>
                    <button
                        disabled={unavailable}
                        className="bg-blue-600 text-white px-3 py-2 text-xs sm:px-4 sm:py-2.5 sm:text-sm lg:px-5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm min-h-[40px] sm:min-h-[44px]"
                        onClick={e => { e.stopPropagation(); handleAdd(); }}
                    >
                        Add
                    </button>
                </div>
            )}
        </div>
    );
}
