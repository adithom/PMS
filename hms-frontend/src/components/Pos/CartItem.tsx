import React from 'react';
import { X } from 'lucide-react';
import type { PosProduct } from '../../types/pos';

interface CartItemProps {
    item: {
        product: PosProduct;
        quantity: number;
    };
    onUpdateQuantity: (productId: string, delta: number) => void;
    onRemove: (productId: string) => void;
}

export default function CartItem({ item, onUpdateQuantity, onRemove }: CartItemProps) {
    const { product, quantity } = item;
    const subtotal = product.price * quantity;

    return (
        <div className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
            <div className="flex-1">
                <h5 className="font-medium text-gray-800">{product.name}</h5>
                <div className="text-xs text-gray-500">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(product.price)} x {quantity}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
                    <button
                        className="px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600"
                        onClick={() => onUpdateQuantity(product.id, -1)}
                    >
                        -
                    </button>
                    <span className="px-2 py-1 text-sm font-medium w-8 text-center">{quantity}</span>
                    <button
                        className="px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600"
                        onClick={() => onUpdateQuantity(product.id, 1)}
                    >
                        +
                    </button>
                </div>

                <div className="font-semibold text-gray-800 w-20 text-right">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(subtotal)}
                </div>

                <button
                    className="text-red-500 hover:text-red-700 p-1"
                    onClick={() => onRemove(product.id)}
                    title="Remove item"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
