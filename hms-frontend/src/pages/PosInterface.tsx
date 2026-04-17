import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import posApi from '../api/posApi';
import folioApi from '../api/folioApi';
import ProductCard from '../components/Pos/ProductCard';
import GuestSearchModal from '../components/Pos/GuestSearchModal';
import ConfirmModal from '../components/ConfirmModal';
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
  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Settle Order</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          <div className="bg-gray-50 rounded-xl p-4 flex justify-between items-center">
            <div>
              <div className="text-xs text-gray-500 mb-0.5">{cart.reduce((s, e) => s + e.quantity, 0)} items</div>
              <div className="font-bold text-gray-900 text-lg">{fmt(cartTotal)}</div>
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">Order Total</div>
          </div>

          <div className="flex rounded-xl border border-gray-200 p-1 bg-gray-50 gap-1">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${tab === 'walk-in' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setTab('walk-in')}
            >Walk-in</button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${tab === 'hotel-guest' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setTab('hotel-guest')}
            >Hotel Guest</button>
          </div>

          {tab === 'hotel-guest' && (
            <div className="space-y-3">
              {selectedBooking ? (
                <div className="border border-emerald-200 rounded-xl p-3.5 bg-emerald-50 flex justify-between items-center">
                  <div>
                    <div className="font-medium text-sm text-emerald-900">{selectedBooking.guestName}</div>
                    <div className="text-xs text-emerald-600 mt-0.5">Room {selectedBooking.roomNumber || 'Unassigned'}</div>
                  </div>
                  <button onClick={() => { setSelectedBooking(null); setOpenFolios([]); setSelectedFolioId(''); }}
                    className="text-xs text-emerald-700 hover:text-emerald-900 font-medium underline transition-colors">Change</button>
                </div>
              ) : (
                <button onClick={() => setShowGuestPicker(true)}
                  className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all font-medium">
                  + Select Hotel Guest
                </button>
              )}
              {openFolios.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Folio</label>
                  <select value={selectedFolioId} onChange={e => setSelectedFolioId(e.target.value)} className={inputCls}>
                    {openFolios.map(f => (
                      <option key={f.id} value={f.id}>{f.folioNumber || f.id.slice(0, 8)} — {f.folioType}</option>
                    ))}
                  </select>
                </div>
              )}
              {selectedBooking && openFolios.length === 0 && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">No open folios found for this booking.</div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Method</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PosSettleDto['paymentMethod'])} className={inputCls}>
              <option value="CASH">Cash</option>
              <option value="CREDIT_CARD">Credit Card</option>
              <option value="DEBIT_CARD">Debit Card</option>
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
            </select>
          </div>

          {(paymentMethod === 'CREDIT_CARD' || paymentMethod === 'DEBIT_CARD') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Card Last 4 Digits</label>
              <input type="text" maxLength={4} placeholder="1234" value={cardLastFour}
                onChange={e => setCardLastFour(e.target.value.replace(/\D/g, ''))} className={inputCls} />
            </div>
          )}
          {paymentMethod === 'UPI' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">UPI ID / Reference</label>
              <input type="text" placeholder="guest@upi" value={upiId} onChange={e => setUpiId(e.target.value)} className={inputCls} />
            </div>
          )}
          {paymentMethod !== 'CASH' && paymentMethod !== 'UPI' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Transaction ID</label>
              <input type="text" placeholder="TXN123456" value={transactionId} onChange={e => setTransactionId(e.target.value)} className={inputCls} />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input type="text" placeholder="Any payment notes..." value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} />
          </div>

          {error && <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
          <button onClick={onClose} disabled={processing}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={processing || (tab === 'hotel-guest' && !selectedFolioId)}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
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
  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Select Folio</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <p className="text-sm text-gray-500">Multiple open folios found. Select which one to charge:</p>
          {folios.map(folio => (
            <button key={folio.id} onClick={() => onSelect(folio)}
              className="w-full text-left border border-gray-200 rounded-xl p-4 hover:bg-blue-50 hover:border-blue-300 transition-all group">
              <div className="font-medium text-sm text-gray-900 group-hover:text-blue-700">{folio.folioNumber || folio.id.slice(0, 8)}</div>
              <div className="text-xs text-gray-500 mt-0.5">{folio.folioType} — Balance: {fmt(folio.balanceDue ?? 0)}</div>
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

  const [showGuestModal, setShowGuestModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [showFolioPickerModal, setShowFolioPickerModal] = useState(false);

  const [pendingBooking, setPendingBooking] = useState<Booking | null>(null);
  const [pendingFolios, setPendingFolios] = useState<FolioDto[]>([]);
  const [pendingFolioId, setPendingFolioId] = useState<string | null>(null);
  const [showChargeConfirm, setShowChargeConfirm] = useState(false);
  const [addToRoomError, setAddToRoomError] = useState<string | null>(null);
  const [addingToRoom, setAddingToRoom] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [showCartSheet, setShowCartSheet] = useState(false);

  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

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

  const categories = ['All', ...Array.from(new Set(products.map(p => p.categoryName).filter(Boolean)))];
  const filteredProducts = categoryFilter === 'All' ? products : products.filter(p => p.categoryName === categoryFilter);

  const cartSubtotal = cart.reduce((sum, e) => sum + e.product.price * e.quantity, 0);
  const cartTax = cart.reduce((sum, e) => sum + (e.product.price * e.quantity * e.product.taxRate) / 100, 0);
  const discountAmount = orderDiscountRate > 0 ? (cartSubtotal * orderDiscountRate) / 100 : 0;
  const cartTotal = cartSubtotal + cartTax - discountAmount;
  const cartItemCount = cart.reduce((s, e) => s + e.quantity, 0);

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
        setPendingFolioId(openFolios[0].id!);
        setShowChargeConfirm(true);
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

  const selectCls = 'border border-gray-200 rounded-lg px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow';

  if (!user) return null;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-3 py-3 sm:px-4 sm:py-4 flex items-center gap-2 sm:gap-3 flex-shrink-0 shadow-sm flex-wrap">
        <h1 className="text-lg sm:text-xl font-bold text-gray-900">Point of Sale</h1>

        {isManager && (user.properties?.length ?? 0) > 1 && (
          <select
            value={selectedPropertyId}
            onChange={e => { setSelectedPropertyId(e.target.value); setLocation(null); setLocations([]); setProducts([]); clearCart(); }}
            className={selectCls}
          >
            {user.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}

        {isManager && (
          loadingLocations
            ? <span className="text-sm text-gray-400">Loading...</span>
            : (
              <select
                value={location?.id ?? ''}
                onChange={e => setLocation(locations.find(l => l.id === e.target.value) ?? null)}
                className={selectCls}
              >
                <option value="">Select Location</option>
                {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
              </select>
            )
        )}

        {isPosUser && location && (
          <span className="bg-blue-50 text-blue-700 text-sm font-medium px-3 py-1.5 rounded-full border border-blue-200">
            {location.name}
          </span>
        )}
      </div>

      {/* Notification banners */}
      {successMessage && (
        <div className="bg-emerald-50 border-b border-emerald-100 text-emerald-800 px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-medium flex items-center gap-2 flex-shrink-0">
          <span className="text-emerald-500 font-bold">✓</span> {successMessage}
        </div>
      )}
      {(pageError || addToRoomError) && (
        <div className="bg-red-50 border-b border-red-100 text-red-700 px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm flex items-center gap-2 flex-shrink-0">
          <span>⚠</span> {pageError || addToRoomError}
        </div>
      )}

      {!location ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white border border-gray-200 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl shadow-sm">
            🏪
          </div>
          <p className="text-gray-500 text-sm max-w-xs">
            {loadingLocations
              ? 'Loading locations...'
              : isManager
              ? 'Select a POS location above to get started.'
              : 'No POS location assigned to your account.'}
          </p>
        </div>
      ) : (
        <>
          {/* ── Shared product panel (full-width on mobile, left panel on desktop) ── */}
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Category filter strip */}
              <div className="bg-white border-b border-gray-100 px-3 py-2 sm:px-4 sm:py-3 flex gap-1.5 sm:gap-2 overflow-x-auto flex-shrink-0">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                      categoryFilter === cat
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Product grid — bottom padding on mobile to clear the cart bar */}
              <div className="flex-1 overflow-y-auto px-3 py-4 pb-24 sm:px-4 sm:py-5 md:pb-5 md:px-6">
                {loadingProducts ? (
                  <div className="text-center py-16 text-gray-400 text-sm">Loading products...</div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-16 text-gray-400 text-sm">
                    {products.length === 0 ? 'No products available.' : 'No products in this category.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                    {filteredProducts.map(product => (
                      <ProductCard key={product.id} product={product} onAdd={addToCart} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Desktop cart sidebar (hidden on mobile) ── */}
            <div className="hidden md:flex md:w-80 lg:w-96 bg-white border-l border-gray-200 flex-col flex-shrink-0">
              <div className="px-4 py-3 lg:px-5 lg:py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-gray-900">Order</h2>
                  {cartItemCount > 0 && (
                    <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                      {cartItemCount}
                    </span>
                  )}
                </div>
                {cart.length > 0 && (
                  <button onClick={clearCart} className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors">
                    Clear all
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-4 lg:px-5">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl">🛒</div>
                    <p className="text-sm">Add items to start an order</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {cart.map(entry => (
                      <div key={entry.product.id} className="flex items-center gap-3 py-3.5">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 truncate">{entry.product.name}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {fmt(entry.product.price)}
                            {entry.product.discountRate != null && entry.product.discountRate > 0 && (
                              <span className="ml-1 text-emerald-600">−{entry.product.discountRate}%</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button onClick={() => updateCartQuantity(entry.product.id, -1)}
                            className="w-8 h-8 lg:w-7 lg:h-7 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center font-bold transition-colors text-base leading-none">−</button>
                          <span className="w-7 text-center text-sm font-semibold text-gray-800">{entry.quantity}</span>
                          <button onClick={() => updateCartQuantity(entry.product.id, 1)}
                            className="w-8 h-8 lg:w-7 lg:h-7 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center font-bold transition-colors text-base leading-none">+</button>
                        </div>
                        <div className="text-sm font-semibold text-gray-900 w-20 text-right shrink-0">
                          {fmt(entry.product.price * entry.quantity)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="border-t border-gray-200 px-4 py-3 lg:px-5 lg:py-4 space-y-4 flex-shrink-0 bg-gray-50/50">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm text-gray-600 whitespace-nowrap">Order Discount</label>
                    <div className="relative">
                      <input type="number" min="0" max="100" step="0.5"
                        value={orderDiscountRate || ''} onChange={e => setOrderDiscountRate(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-7" />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{fmt(cartSubtotal)}</span></div>
                    <div className="flex justify-between text-gray-500"><span>Tax</span><span>{fmt(cartTax)}</span></div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Discount ({orderDiscountRate}%)</span><span>−{fmt(discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-200">
                      <span>Total</span><span>{fmt(cartTotal)}</span>
                    </div>
                  </div>
                  <div className="space-y-2 pt-1">
                    <button onClick={() => { setAddToRoomError(null); setShowGuestModal(true); }} disabled={addingToRoom}
                      className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm shadow-sm">
                      {addingToRoom ? 'Charging...' : 'Add to Room'}
                    </button>
                    <button onClick={() => setShowSettleModal(true)}
                      className="w-full py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors text-sm shadow-sm">
                      Settle Now
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Mobile cart bar (hidden on desktop) ── */}
          {cart.length > 0 && (
            <div className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 px-4 py-3 shadow-lg z-30">
              <button
                onClick={() => setShowCartSheet(true)}
                className="w-full bg-blue-600 text-white rounded-xl py-3.5 flex items-center justify-between px-5 shadow-sm active:bg-blue-700 transition-colors"
              >
                <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[1.5rem] text-center">
                  {cartItemCount}
                </span>
                <span className="font-semibold text-sm">View Order</span>
                <span className="font-bold text-sm">{fmt(cartTotal)}</span>
              </button>
            </div>
          )}

          {/* ── Mobile cart bottom sheet ── */}
          {showCartSheet && (
            <div className="md:hidden fixed inset-0 z-40 flex flex-col justify-end">
              <div className="absolute inset-0 bg-black/40" onClick={() => setShowCartSheet(false)} />
              <div className="relative bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[80vh] sm:max-h-[75vh]">
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                  <div className="w-10 h-1 bg-gray-300 rounded-full" />
                </div>
                {/* Sheet header */}
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-gray-900">Order</h2>
                    <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">{cartItemCount}</span>
                  </div>
                  <button onClick={clearCart} className="text-xs text-red-400 font-medium">Clear all</button>
                </div>
                {/* Cart items */}
                <div className="flex-1 overflow-y-auto px-5">
                  <div className="divide-y divide-gray-50">
                    {cart.map(entry => (
                      <div key={entry.product.id} className="flex items-center gap-3 py-3 sm:py-4">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 truncate">{entry.product.name}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {fmt(entry.product.price)}
                            {entry.product.discountRate != null && entry.product.discountRate > 0 && (
                              <span className="ml-1 text-emerald-600">−{entry.product.discountRate}%</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => updateCartQuantity(entry.product.id, -1)}
                            className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-lg leading-none active:bg-gray-200">−</button>
                          <span className="w-7 text-center text-sm font-semibold text-gray-800">{entry.quantity}</span>
                          <button onClick={() => updateCartQuantity(entry.product.id, 1)}
                            className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-lg leading-none active:bg-gray-200">+</button>
                        </div>
                        <div className="text-sm font-semibold text-gray-900 w-20 text-right shrink-0">
                          {fmt(entry.product.price * entry.quantity)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Totals + actions */}
                <div className="border-t border-gray-200 px-5 py-4 space-y-4 flex-shrink-0 bg-gray-50/50">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm text-gray-600 whitespace-nowrap">Order Discount</label>
                    <div className="relative">
                      <input type="number" min="0" max="100" step="0.5"
                        value={orderDiscountRate || ''} onChange={e => setOrderDiscountRate(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-7" />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{fmt(cartSubtotal)}</span></div>
                    <div className="flex justify-between text-gray-500"><span>Tax</span><span>{fmt(cartTax)}</span></div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Discount ({orderDiscountRate}%)</span><span>−{fmt(discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-200">
                      <span>Total</span><span>{fmt(cartTotal)}</span>
                    </div>
                  </div>
                  <div className="space-y-2 pt-1">
                    <button onClick={() => { setShowCartSheet(false); setAddToRoomError(null); setShowGuestModal(true); }} disabled={addingToRoom}
                      className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold active:bg-blue-700 disabled:opacity-50 transition-colors text-sm shadow-sm">
                      {addingToRoom ? 'Charging...' : 'Add to Room'}
                    </button>
                    <button onClick={() => { setShowCartSheet(false); setShowSettleModal(true); }}
                      className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-semibold active:bg-emerald-700 transition-colors text-sm shadow-sm">
                      Settle Now
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <GuestSearchModal
        isOpen={showGuestModal}
        onClose={() => setShowGuestModal(false)}
        onSelectBooking={handleAddToRoomSelectGuest}
        propertyId={selectedPropertyId}
      />

      <FolioPickerModal
        isOpen={showFolioPickerModal}
        onClose={() => { setShowFolioPickerModal(false); setPendingBooking(null); setPendingFolios([]); }}
        folios={pendingFolios}
        onSelect={folio => { setShowFolioPickerModal(false); setPendingFolioId(folio.id!); setShowChargeConfirm(true); }}
      />

      {showSettleModal && location && (
        <SettleNowModal
          isOpen={showSettleModal}
          onClose={() => setShowSettleModal(false)}
          cart={cart}
          location={location}
          propertyId={selectedPropertyId}
          orderDiscountRate={orderDiscountRate}
          onSuccess={handleSettleSuccess}
        />
      )}

      {showChargeConfirm && pendingBooking && pendingFolioId && (
        <ConfirmModal
          title="Charge to Room"
          message={`Add ${fmt(cartTotal)} to ${pendingBooking.guestName}'s folio (Room ${pendingBooking.roomNumber || 'Unassigned'})?`}
          confirmLabel="Charge"
          variant="primary"
          loading={addingToRoom}
          onConfirm={() => { setShowChargeConfirm(false); chargeToFolio(pendingFolioId); }}
          onCancel={() => { setShowChargeConfirm(false); setPendingFolioId(null); setPendingBooking(null); setPendingFolios([]); }}
        />
      )}
    </div>
  );
}
