import { useState, useEffect } from 'react';
import posApi from '../api/posApi';
import propertyApi from '../api/propertyApi';
import folioApi from '../api/folioApi';
import type { PosLocation, PosProduct, PosOrderCreationDto } from '../types/pos';
import type { Property, Booking } from '../types';
import ProductCard from '../components/Pos/ProductCard';
import CartItem from '../components/Pos/CartItem';
import GuestSearchModal from '../components/Pos/GuestSearchModal';
import LoadingSpinner from '../components/LoadingSpinner';

export default function PosInterface() {
    // const { user } = useAuth();

    // State
    const [properties, setProperties] = useState<Property[]>([]);
    const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
    const [locations, setLocations] = useState<PosLocation[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState<string>('');
    const [products, setProducts] = useState<PosProduct[]>([]);
    const [cart, setCart] = useState<{ product: PosProduct; quantity: number }[]>([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Modal state
    const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);

    // Load properties on mount
    useEffect(() => {
        loadProperties();
    }, []);

    // Load locations when property changes
    useEffect(() => {
        if (selectedPropertyId) {
            loadLocations(selectedPropertyId);
        } else {
            setLocations([]);
            setSelectedLocationId('');
        }
    }, [selectedPropertyId]);

    // Load products when location changes
    useEffect(() => {
        if (selectedLocationId) {
            loadProducts(selectedLocationId);
        } else {
            setProducts([]);
        }
    }, [selectedLocationId]);

    const loadProperties = async () => {
        try {
            const data = await propertyApi.getAll();
            setProperties(data || []);
            if (data && data.length > 0) {
                setSelectedPropertyId(data[0].id);
            }
        } catch (err) {
            setError('Failed to load properties');
        }
    };

    const loadLocations = async (propertyId: string) => {
        try {
            const data = await posApi.getLocations(propertyId);
            setLocations(data || []);
            if (data && data.length > 0) {
                setSelectedLocationId(data[0].id);
            }
        } catch (err) {
            setError('Failed to load locations');
        }
    };

    const loadProducts = async (locationId: string) => {
        setLoading(true);
        try {
            const data = await posApi.getProducts(locationId);
            setProducts(data || []);
        } catch (err) {
            setError('Failed to load products');
        } finally {
            setLoading(false);
        }
    };

    // Cart actions
    const addToCart = (product: PosProduct) => {
        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { product, quantity: 1 }];
        });
    };

    const updateQuantity = (productId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.product.id === productId) {
                const newQuantity = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQuantity };
            }
            return item;
        }));
    };

    const removeFromCart = (productId: string) => {
        setCart(prev => prev.filter(item => item.product.id !== productId));
    };

    const clearCart = () => {
        setCart([]);
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

    // Order processing
    const handleChargeToRoom = () => {
        if (cart.length === 0) return;
        setIsGuestModalOpen(true);
    };

    const processOrder = async (booking: Booking) => {
        if (!selectedLocationId || cart.length === 0) return;

        setProcessing(true);
        setError(null);
        setSuccessMessage(null);
        setIsGuestModalOpen(false);

        try {
            // 1. Create Order
            const orderDto: PosOrderCreationDto = {
                posLocationId: selectedLocationId,
                items: cart.map(item => ({
                    posProductId: item.product.id,
                    quantity: item.quantity
                }))
            };

            const order = await posApi.createOrder(orderDto);

            if (!booking.id) throw new Error('Booking ID is missing');

            // 2. Charge to Folio
            // Use folioApi to get folio by booking
            const folio = await folioApi.getByBooking(booking.id, selectedPropertyId);

            if (!folio) throw new Error('Failed to find folio for booking');

            await posApi.chargeOrder(order.id, folio.id);

            setSuccessMessage(`Order charged to Room ${booking.roomNumber} (${booking.guestName}) successfully!`);
            clearCart();

        } catch (err: any) {
            setError(err.message || 'Failed to process order');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm z-10">
                <h1 className="text-2xl font-bold text-gray-800 m-0">Point of Sale</h1>

                <div className="flex gap-4">
                    <select
                        className="form-select rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        value={selectedPropertyId}
                        onChange={(e) => setSelectedPropertyId(e.target.value)}
                    >
                        {properties.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>

                    <select
                        className="form-select rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        value={selectedLocationId}
                        onChange={(e) => setSelectedLocationId(e.target.value)}
                        disabled={!selectedPropertyId}
                    >
                        {locations.map(l => (
                            <option key={l.id} value={l.id}>{l.name} ({l.type})</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Product Grid */}
                <div className="flex-1 overflow-y-auto p-6">
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 relative">
                            {error}
                            <span className="absolute top-0 bottom-0 right-0 px-4 py-3 cursor-pointer" onClick={() => setError(null)}>
                                <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z" /></svg>
                            </span>
                        </div>
                    )}

                    {successMessage && (
                        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4 relative">
                            {successMessage}
                            <span className="absolute top-0 bottom-0 right-0 px-4 py-3 cursor-pointer" onClick={() => setSuccessMessage(null)}>
                                <svg className="fill-current h-6 w-6 text-green-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z" /></svg>
                            </span>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <LoadingSpinner />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {products.map(product => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    onAdd={addToCart}
                                />
                            ))}
                        </div>
                    )}

                    {!loading && products.length === 0 && (
                        <div className="text-center text-gray-500 mt-10">
                            No products found for this location.
                        </div>
                    )}
                </div>

                {/* Cart Sidebar */}
                <div className="w-96 bg-white border-l border-gray-200 flex flex-col shadow-lg z-20">
                    <div className="p-4 border-b border-gray-200 bg-gray-50">
                        <h2 className="text-lg font-semibold text-gray-800 m-0">Current Order</h2>
                        <div className="text-sm text-gray-500">{cart.length} items</div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                        {cart.length === 0 ? (
                            <div className="text-center text-gray-400 mt-10">
                                Cart is empty
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {cart.map(item => (
                                    <CartItem
                                        key={item.product.id}
                                        item={item}
                                        onUpdateQuantity={updateQuantity}
                                        onRemove={removeFromCart}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-gray-200 bg-gray-50">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-gray-600">Total</span>
                            <span className="text-2xl font-bold text-gray-900">
                                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(cartTotal)}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                className="btn btn-secondary justify-center"
                                onClick={clearCart}
                                disabled={cart.length === 0 || processing}
                            >
                                Clear
                            </button>
                            <button
                                className="btn btn-primary justify-center"
                                onClick={handleChargeToRoom}
                                disabled={cart.length === 0 || processing}
                            >
                                {processing ? 'Processing...' : 'Charge to Room'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <GuestSearchModal
                isOpen={isGuestModalOpen}
                onClose={() => setIsGuestModalOpen(false)}
                onSelectBooking={processOrder}
                propertyId={selectedPropertyId}
            />
        </div>
    );
}
