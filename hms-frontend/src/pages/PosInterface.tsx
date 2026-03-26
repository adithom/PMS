import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import posApi from '../api/posApi';
import folioApi from '../api/folioApi';
import ProductCard from '../components/Pos/ProductCard';
import GuestSearchModal from '../components/Pos/GuestSearchModal';
import type { PosLocation, PosProduct, CartEntry, PosSettleDto } from '../types/pos';
import type { Booking } from '../types';
import type { FolioDto } from '../api/folioApi';

// ─── SettleNowModal ──────────────────────────────────────────────────────────

interface SettleNowModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartEntry[];
  location: PosLocation;
  propertyId: string;
  orderDiscountRate: number;
  onSuccess: () => void;
}

function SettleNowModal({ isOpen, onClose, cart, location, propertyId, orderDiscountRate, onSuccess }: SettleNowModalProps) {
  const [tab, setTab] = useState<'walk-in' | 'hotel-guest'>('walk-in');
  const [showGuestPicker, setShowGuestPicker] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [openFolios, setOpenFolios] = useState<FolioDto[]>([]);
  const [selectedFolioId, setSelectedFolioId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PosSettleDto['paymentMethod']>('CASH');
  const [transactionId, setTransactionId] = useState('');
  const [cardLastFour, setCardLastFour] = useState('');
  const [upiId, setUpiId] = useState('');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTab('walk-in');
      setSelectedBooking(null);
      setOpenFolios([]);
      setSelectedFolioId('');
      setPaymentMethod('CASH');
      setTransactionId('');
      setCardLastFour('');
      setUpiId('');
      setNotes('');
      setError(null);
    }
  }, [isOpen]);

  const handleSelectBooking = async (booking: Booking) => {
    setShowGuestPicker(false);
    setSelectedBooking(booking);
    setError(null);
    try {
      const folios = await folioApi.getAllFoliosByBooking(propertyId, booking.id!);
      const open = folios.filter(f => f.status === 'OPEN');
      setOpenFolios(open);
      setSelectedFolioId(open[0]?.id ?? '');
    } catch {
      setError('Failed to load folios for this booking');
    }
  };

  const handleConfirm = async () => {
    if (tab === 'hotel-guest' && !selectedFolioId) {
      setError('Please select a guest and folio');
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const order = await posApi.createOrder({
        posLocationId: location.id,
        items: cart.map(e => ({ posProductId: e.product.id, quantity: e.quantity })),
        discountRate: orderDiscountRate > 0 ? orderDiscountRate : undefined,
      });
      await posApi.settleOrder(order.id, {
        walkIn: tab === 'walk-in',
        folioId: tab === 'hotel-guest' ? selectedFolioId : undefined,
        paymentMethod,
        transactionId: transactionId || undefined,
        cardLastFour: cardLastFour || undefined,
        upiId: upiId || undefined,
        notes: notes || undefined,
      });
      onSuccess();
    } catch {
      setError('Failed to process payment. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  const cartTotal = cart.reduce((sum, e) => sum + e.product.price * e.quantity, 0);
  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800">Settle Now</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl leading-none">&times;</button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <div className="flex justify-between font-semibold">
              <span>Order Total</span>
              <span>{fmt(cartTotal)}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">{cart.reduce((s, e) => s + e.quantity, 0)} items</div>
          </div>

          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'walk-in' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              onClick={() => setTab('walk-in')}
            >Walk-in</button>
            <button
              className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'hotel-guest' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              onClick={() => setTab('hotel-guest')}
            >Hotel Guest</button>
          </div>

          {tab === 'hotel-guest' && (
            <div className="space-y-2">
              {selectedBooking ? (
                <div className="border border-green-200 rounded-lg p-3 bg-green-50 flex justify-between items-center">
                  <div>
                    <div className="font-medium text-sm text-green-800">{selectedBooking.guestName}</div>
                    <div className="text-xs text-green-600">Room {selectedBooking.roomNumber || 'Unassigned'}</div>
                  </div>
                  <button onClick={() => { setSelectedBooking(null); setOpenFolios([]); setSelectedFolioId(''); }}
                    className="text-xs text-green-700 underline hover:no-underline">Change</button>
                </div>
              ) : (
                <button onClick={() => setShowGuestPicker(true)}
                  className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors">
                  + Select Hotel Guest
                </button>
              )}
              {openFolios.length > 1 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Select Folio</label>
                  <select value={selectedFolioId} onChange={e => setSelectedFolioId(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {openFolios.map(f => (
                      <option key={f.id} value={f.id}>{f.folioNumber || f.id.slice(0, 8)} — {f.folioType}</option>
                    ))}
                  </select>
                </div>
              )}
              {selectedBooking && openFolios.length === 0 && (
                <div className="text-sm text-red-600 bg-red-50 rounded p-2">No open folios found for this booking.</div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PosSettleDto['paymentMethod'])}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="CASH">Cash</option>
              <option value="CREDIT_CARD">Credit Card</option>
              <option value="DEBIT_CARD">Debit Card</option>
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
            </select>
          </div>

          {(paymentMethod === 'CREDIT_CARD' || paymentMethod === 'DEBIT_CARD') && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Card Last 4 Digits</label>
              <input type="text" maxLength={4} placeholder="1234" value={cardLastFour}
                onChange={e => setCardLastFour(e.target.value.replace(/\D/g, ''))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          {paymentMethod === 'UPI' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">UPI ID / Reference</label>
              <input type="text" placeholder="guest@upi" value={upiId} onChange={e => setUpiId(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          {paymentMethod !== 'CASH' && paymentMethod !== 'UPI' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Transaction ID</label>
              <input type="text" placeholder="TXN123456" value={transactionId} onChange={e => setTransactionId(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
            <input type="text" placeholder="Any payment notes..." value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex justify-end gap-2">
          <button onClick={onClose} disabled={processing}
            className="px-4 py-2 bg-white border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
          <button onClick={handleConfirm} disabled={processing || (tab === 'hotel-guest' && !selectedFolioId)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium">
            {processing ? 'Processing...' : 'Confirm Payment'}
          </button>
        </div>
      </div>

      <GuestSearchModal isOpen={showGuestPicker} onClose={() => setShowGuestPicker(false)}
        onSelectBooking={handleSelectBooking} propertyId={propertyId} />
    </div>
  );
}

// ─── FolioPickerModal ────────────────────────────────────────────────────────

interface FolioPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  folios: FolioDto[];
  onSelect: (folio: FolioDto) => void;
}

function FolioPickerModal({ isOpen, onClose, folios, onSelect }: FolioPickerModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800">Select Folio</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl leading-none">&times;</button>
        </div>
        <div className="p-4 space-y-2">
          <p className="text-sm text-gray-600 mb-3">Multiple open folios found. Select which one to charge:</p>
          {folios.map(folio => (
            <button key={folio.id} onClick={() => onSelect(folio)}
              className="w-full text-left border border-gray-200 rounded-lg p-3 hover:bg-blue-50 transition-colors">
              <div className="font-medium text-sm">{folio.folioNumber || folio.id.slice(0, 8)}</div>
              <div className="text-xs text-gray-500">{folio.folioType} — Balance: {folio.balanceDue ?? 0}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main PosInterface ───────────────────────────────────────────────────────

export default function PosInterface() {
  const { user } = useAuth();
  const isManager = user?.role === 'MANAGER';
  const isPosUser = user?.role === 'POS';

  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(user?.properties?.[0]?.id ?? '');
  const [locations, setLocations] = useState<PosLocation[]>([]);
  const [location, setLocation] = useState<PosLocation | null>(null);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [orderDiscountRate, setOrderDiscountRate] = useState(0);

  // Modals
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [showFolioPickerModal, setShowFolioPickerModal] = useState(false);

  // "Add to Room" state
  const [pendingBooking, setPendingBooking] = useState<Booking | null>(null);
  const [pendingFolios, setPendingFolios] = useState<FolioDto[]>([]);
  const [addToRoomError, setAddToRoomError] = useState<string | null>(null);
  const [addingToRoom, setAddingToRoom] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

  // ── Load locations ──
  const loadLocations = useCallback(async (propId: string) => {
    if (!propId) return;
    setLoadingLocations(true);
    setPageError(null);
    try {
      const locs = await posApi.getLocations(propId);
      setLocations(locs);
      if (isPosUser && user?.posLocationId) {
        const myLoc = locs.find(l => l.id === user.posLocationId);
        if (myLoc) setLocation(myLoc);
      } else if (locs.length === 1) {
        setLocation(locs[0]);
      }
    } catch {
      setPageError('Failed to load POS locations');
    } finally {
      setLoadingLocations(false);
    }
  }, [isPosUser, user?.posLocationId]);

  useEffect(() => {
    if (selectedPropertyId) loadLocations(selectedPropertyId);
  }, [selectedPropertyId, loadLocations]);

  // ── Load products ──
  const loadProducts = useCallback(async () => {
    if (!location) return;
    setLoadingProducts(true);
    try {
      const prods = await posApi.getProducts(location.id);
      setProducts(prods);
    } catch {
      setPageError('Failed to load products');
    } finally {
      setLoadingProducts(false);
    }
  }, [location]);

  useEffect(() => {
    if (location) {
      loadProducts();
      setCategoryFilter('All');
      setCart([]);
      setOrderDiscountRate(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.id]);

  // ── Cart helpers ──
  const addToCart = (product: PosProduct) => {
    setCart(prev => {
      const existing = prev.find(e => e.product.id === product.id);
      if (existing) return prev.map(e => e.product.id === product.id ? { ...e, quantity: e.quantity + 1 } : e);
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(e => e.product.id === productId ? { ...e, quantity: e.quantity + delta } : e).filter(e => e.quantity > 0));
  };

  const clearCart = () => { setCart([]); setOrderDiscountRate(0); };

  // ── Category filter ──
  const categories = ['All', ...Array.from(new Set(products.map(p => p.categoryName).filter(Boolean)))];
  const filteredProducts = categoryFilter === 'All' ? products : products.filter(p => p.categoryName === categoryFilter);

  // ── Cart totals ──
  const cartSubtotal = cart.reduce((sum, e) => sum + e.product.price * e.quantity, 0);
  const cartTax = cart.reduce((sum, e) => sum + (e.product.price * e.quantity * e.product.taxRate) / 100, 0);
  const discountAmount = orderDiscountRate > 0 ? (cartSubtotal * orderDiscountRate) / 100 : 0;
  const cartTotal = cartSubtotal + cartTax - discountAmount;

  // ── "Add to Room" flow ──
  const handleAddToRoomSelectGuest = async (booking: Booking) => {
    setShowGuestModal(false);
    setAddToRoomError(null);
    if (!booking.id) return;
    try {
      const folios = await folioApi.getAllFoliosByBooking(selectedPropertyId, booking.id);
      const openFolios = folios.filter(f => f.status === 'OPEN');
      if (openFolios.length === 0) {
        setAddToRoomError(`No open folio found for ${booking.guestName}`);
        return;
      }
      setPendingBooking(booking);
      setPendingFolios(openFolios);
      if (openFolios.length === 1) {
        await chargeToFolio(openFolios[0].id!, booking);
      } else {
        setShowFolioPickerModal(true);
      }
    } catch {
      setAddToRoomError('Failed to fetch folios for this booking');
    }
  };

  const chargeToFolio = async (folioId: string, booking?: Booking) => {
    if (!location) return;
    setShowFolioPickerModal(false);
    setAddingToRoom(true);
    setAddToRoomError(null);
    const guestName = booking?.guestName ?? pendingBooking?.guestName ?? 'guest';
    try {
      const order = await posApi.createOrder({
        posLocationId: location.id,
        items: cart.map(e => ({ posProductId: e.product.id, quantity: e.quantity })),
        discountRate: orderDiscountRate > 0 ? orderDiscountRate : undefined,
      });
      await posApi.chargeOrder(order.id, folioId);
      clearCart();
      setPendingBooking(null);
      setPendingFolios([]);
      setSuccessMessage(`Charged to ${guestName}'s folio`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setAddToRoomError('Failed to charge order to folio');
    } finally {
      setAddingToRoom(false);
    }
  };

  const handleSettleSuccess = () => {
    setShowSettleModal(false);
    clearCart();
    setSuccessMessage('Payment settled successfully');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  if (!user) return null;

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <h1 className="text-xl font-bold text-gray-800">POS</h1>

        {isManager && (user.properties?.length ?? 0) > 1 && (
          <select value={selectedPropertyId}
            onChange={e => { setSelectedPropertyId(e.target.value); setLocation(null); setLocations([]); setProducts([]); clearCart(); }}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {user.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}

        {isManager && (
          loadingLocations ? <span className="text-sm text-gray-500">Loading...</span> : (
            <select value={location?.id ?? ''} onChange={e => setLocation(locations.find(l => l.id === e.target.value) ?? null)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select Location</option>
              {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
            </select>
          )
        )}

        {isPosUser && location && (
          <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded-full">{location.name}</span>
        )}
      </div>

      {/* Banners */}
      {successMessage && <div className="bg-green-100 border-b border-green-300 text-green-800 px-4 py-2 text-sm text-center">{successMessage}</div>}
      {pageError && <div className="bg-red-100 border-b border-red-300 text-red-800 px-4 py-2 text-sm text-center">{pageError}</div>}
      {addToRoomError && <div className="bg-red-100 border-b border-red-300 text-red-800 px-4 py-2 text-sm text-center">{addToRoomError}</div>}

      {!location ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          {loadingLocations ? 'Loading...' : isManager ? 'Select a POS location to get started.' : 'No POS location assigned to your account.'}
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: products */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-white border-b border-gray-200 px-4 py-2 flex gap-2 overflow-x-auto flex-shrink-0">
              {categories.map(cat => (
                <button key={cat} onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    categoryFilter === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>{cat}</button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingProducts ? (
                <div className="text-center py-12 text-gray-500">Loading products...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12 text-gray-500">{products.length === 0 ? 'No products available.' : 'No products in this category.'}</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {filteredProducts.map(product => <ProductCard key={product.id} product={product} onAdd={addToCart} />)}
                </div>
              )}
            </div>
          </div>

          {/* Right: cart */}
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col flex-shrink-0">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="font-semibold text-gray-800">Order</h2>
              {cart.length > 0 && <button onClick={clearCart} className="text-xs text-red-500 hover:text-red-700">Clear</button>}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">Add items to start an order</div>
              ) : cart.map(entry => (
                <div key={entry.product.id} className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{entry.product.name}</div>
                    <div className="text-xs text-gray-500">
                      {fmt(entry.product.price)}
                      {entry.product.discountRate != null && entry.product.discountRate > 0 && (
                        <span className="ml-1 text-green-600">(-{entry.product.discountRate}%)</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateCartQuantity(entry.product.id, -1)}
                      className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center text-lg leading-none">−</button>
                    <span className="w-6 text-center text-sm font-medium">{entry.quantity}</span>
                    <button onClick={() => updateCartQuantity(entry.product.id, 1)}
                      className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center text-lg leading-none">+</button>
                  </div>
                  <div className="text-sm font-medium text-gray-800 w-16 text-right">{fmt(entry.product.price * entry.quantity)}</div>
                </div>
              ))}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-gray-200 p-4 space-y-3">
                {/* Order discount input */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600 whitespace-nowrap">Discount %</label>
                  <input type="number" min="0" max="100" step="0.5" value={orderDiscountRate || ''}
                    onChange={e => setOrderDiscountRate(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{fmt(cartSubtotal)}</span></div>
                  <div className="flex justify-between text-gray-600"><span>Tax</span><span>{fmt(cartTax)}</span></div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-green-600"><span>Discount ({orderDiscountRate}%)</span><span>-{fmt(discountAmount)}</span></div>
                  )}
                  <div className="flex justify-between font-semibold text-gray-800 pt-1 border-t border-gray-200"><span>Total</span><span>{fmt(cartTotal)}</span></div>
                </div>

                <div className="space-y-2">
                  <button onClick={() => { setAddToRoomError(null); setShowGuestModal(true); }} disabled={addingToRoom}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm">
                    {addingToRoom ? 'Charging...' : 'Add to Room'}
                  </button>
                  <button onClick={() => setShowSettleModal(true)}
                    className="w-full py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors text-sm">
                    Settle Now
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <GuestSearchModal isOpen={showGuestModal} onClose={() => setShowGuestModal(false)}
        onSelectBooking={handleAddToRoomSelectGuest} propertyId={selectedPropertyId} />

      <FolioPickerModal isOpen={showFolioPickerModal}
        onClose={() => { setShowFolioPickerModal(false); setPendingBooking(null); setPendingFolios([]); }}
        folios={pendingFolios} onSelect={folio => chargeToFolio(folio.id!)} />

      {showSettleModal && location && (
        <SettleNowModal isOpen={showSettleModal} onClose={() => setShowSettleModal(false)}
          cart={cart} location={location} propertyId={selectedPropertyId}
          orderDiscountRate={orderDiscountRate} onSuccess={handleSettleSuccess} />
      )}
    </div>
  );
}
