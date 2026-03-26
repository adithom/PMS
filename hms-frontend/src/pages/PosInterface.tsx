import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import posApi from '../api/posApi';
import folioApi from '../api/folioApi';
import ProductCard from '../components/Pos/ProductCard';
import GuestSearchModal from '../components/Pos/GuestSearchModal';
import type { PosLocation, PosProduct, CartEntry, PosProductCreationDto, PosSettleDto } from '../types/pos';
import type { Booking } from '../types';
import type { FolioDto } from '../api/folioApi';

// ─── ManageItemsModal ────────────────────────────────────────────────────────

interface ManageItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: PosLocation;
  products: PosProduct[];
  onProductsChanged: () => void;
}

function ManageItemsModal({ isOpen, onClose, location, products, onProductsChanged }: ManageItemsModalProps) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Partial<PosProductCreationDto>>({
    locationId: location.id,
    isAvailable: true,
    taxRate: location.defaultTaxRate,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postingWalkIn, setPostingWalkIn] = useState(false);
  const [confirmPost, setConfirmPost] = useState(false);

  const handleToggleAvailability = async (product: PosProduct) => {
    try {
      await posApi.updateProduct(product.id, { isAvailable: !product.isAvailable });
      onProductsChanged();
    } catch {
      setError('Failed to update product availability');
    }
  };

  const handleDelete = async (product: PosProduct) => {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    try {
      await posApi.deleteProduct(product.id);
      onProductsChanged();
    } catch {
      setError('Failed to delete product');
    }
  };

  const handleAddProduct = async () => {
    if (!form.name || !form.code || !form.category || form.price == null) {
      setError('Name, code, category and price are required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await posApi.createProduct({
        locationId: location.id,
        name: form.name!,
        code: form.code!,
        description: form.description,
        category: form.category!,
        price: form.price!,
        cost: form.cost,
        taxRate: form.taxRate,
        isAvailable: form.isAvailable ?? true,
        preparationTime: form.preparationTime,
        imageUrl: form.imageUrl,
      });
      setForm({ locationId: location.id, isAvailable: true, taxRate: location.defaultTaxRate });
      setAdding(false);
      onProductsChanged();
    } catch {
      setError('Failed to add product');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostWalkInFolio = async () => {
    setPostingWalkIn(true);
    setError(null);
    try {
      await posApi.postWalkInFolio(location.id);
      setConfirmPost(false);
      onProductsChanged();
      alert('Walk-in folio posted successfully. A new folio will be created on the next walk-in.');
    } catch {
      setError('Failed to post walk-in folio');
    } finally {
      setPostingWalkIn(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800">Manage Items — {location.name}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>
          )}

          {/* Walk-in folio management */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex justify-between items-center">
            <div>
              <div className="font-medium text-amber-800 text-sm">Walk-in Folio</div>
              <div className="text-xs text-amber-600">
                {location.currentWalkInFolioId ? 'Active walk-in folio open' : 'No active walk-in folio'}
              </div>
            </div>
            {confirmPost ? (
              <div className="flex gap-2">
                <span className="text-xs text-amber-700 self-center">Confirm post folio?</span>
                <button
                  onClick={handlePostWalkInFolio}
                  disabled={postingWalkIn}
                  className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 disabled:opacity-50"
                >
                  {postingWalkIn ? 'Posting...' : 'Yes, post it'}
                </button>
                <button
                  onClick={() => setConfirmPost(false)}
                  className="px-3 py-1.5 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmPost(true)}
                disabled={!location.currentWalkInFolioId}
                className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Post & Archive Folio
              </button>
            )}
          </div>

          {/* Products list */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Products ({products.length})</span>
              <button
                onClick={() => setAdding(true)}
                className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >
                + Add Item
              </button>
            </div>

            {adding && (
              <div className="border border-blue-200 rounded-lg p-3 bg-blue-50 mb-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="Name *"
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                    value={form.name || ''}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                  <input
                    placeholder="Code *"
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                    value={form.code || ''}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                  />
                  <input
                    placeholder="Category *"
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                    value={form.category || ''}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  />
                  <input
                    placeholder="Price *"
                    type="number"
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                    value={form.price ?? ''}
                    onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                  />
                  <input
                    placeholder="Tax Rate (%)"
                    type="number"
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                    value={form.taxRate ?? ''}
                    onChange={e => setForm(f => ({ ...f, taxRate: parseFloat(e.target.value) || 0 }))}
                  />
                  <input
                    placeholder="Description"
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                    value={form.description || ''}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setAdding(false); setError(null); }}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddProduct}
                    disabled={submitting}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? 'Adding...' : 'Add Product'}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {products.map(product => (
                <div key={product.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2">
                  <div>
                    <span className="font-medium text-sm text-gray-800">{product.name}</span>
                    <span className="text-xs text-gray-500 ml-2">{product.category}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(product.price)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={product.isAvailable}
                        onChange={() => handleToggleAvailability(product)}
                        className="rounded"
                      />
                      Available
                    </label>
                    <button
                      onClick={() => handleDelete(product)}
                      className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {products.length === 0 && (
                <div className="text-center py-4 text-gray-500 text-sm">No products yet. Add your first item.</div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded text-gray-700 hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SettleNowModal ──────────────────────────────────────────────────────────

interface SettleNowModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartEntry[];
  location: PosLocation;
  propertyId: string;
  onSuccess: () => void;
}

function SettleNowModal({ isOpen, onClose, cart, location, propertyId, onSuccess }: SettleNowModalProps) {
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

  // Reset state when modal opens
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800">Settle Now</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Order total */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <div className="flex justify-between font-semibold">
              <span>Order Total</span>
              <span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(cartTotal)}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">{cart.reduce((s, e) => s + e.quantity, 0)} items</div>
          </div>

          {/* Customer type tabs */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                tab === 'walk-in' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setTab('walk-in')}
            >
              Walk-in
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                tab === 'hotel-guest' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setTab('hotel-guest')}
            >
              Hotel Guest
            </button>
          </div>

          {/* Hotel guest: select booking + folio */}
          {tab === 'hotel-guest' && (
            <div className="space-y-2">
              {selectedBooking ? (
                <div className="border border-green-200 rounded-lg p-3 bg-green-50 flex justify-between items-center">
                  <div>
                    <div className="font-medium text-sm text-green-800">{selectedBooking.guestName}</div>
                    <div className="text-xs text-green-600">Room {selectedBooking.roomNumber || 'Unassigned'}</div>
                  </div>
                  <button
                    onClick={() => { setSelectedBooking(null); setOpenFolios([]); setSelectedFolioId(''); }}
                    className="text-xs text-green-700 underline hover:no-underline"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowGuestPicker(true)}
                  className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  + Select Hotel Guest
                </button>
              )}

              {openFolios.length > 1 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Select Folio</label>
                  <select
                    value={selectedFolioId}
                    onChange={e => setSelectedFolioId(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {openFolios.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.folioNumber || f.id.slice(0, 8)} — {f.folioType}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedBooking && openFolios.length === 0 && (
                <div className="text-sm text-red-600 bg-red-50 rounded p-2">No open folios found for this booking.</div>
              )}
            </div>
          )}

          {/* Payment method */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value as PosSettleDto['paymentMethod'])}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
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
              <input
                type="text"
                maxLength={4}
                placeholder="1234"
                value={cardLastFour}
                onChange={e => setCardLastFour(e.target.value.replace(/\D/g, ''))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {paymentMethod === 'UPI' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">UPI ID / Reference</label>
              <input
                type="text"
                placeholder="guest@upi"
                value={upiId}
                onChange={e => setUpiId(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {paymentMethod !== 'CASH' && paymentMethod !== 'UPI' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Transaction ID</label>
              <input
                type="text"
                placeholder="TXN123456"
                value={transactionId}
                onChange={e => setTransactionId(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
            <input
              type="text"
              placeholder="Any payment notes..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={processing}
            className="px-4 py-2 bg-white border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={processing || (tab === 'hotel-guest' && !selectedFolioId)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {processing ? 'Processing...' : `Confirm Payment`}
          </button>
        </div>
      </div>

      <GuestSearchModal
        isOpen={showGuestPicker}
        onClose={() => setShowGuestPicker(false)}
        onSelectBooking={handleSelectBooking}
        propertyId={propertyId}
      />
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
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-2">
          <p className="text-sm text-gray-600 mb-3">Multiple open folios found. Select which one to charge:</p>
          {folios.map(folio => (
            <button
              key={folio.id}
              onClick={() => onSelect(folio)}
              className="w-full text-left border border-gray-200 rounded-lg p-3 hover:bg-blue-50 transition-colors"
            >
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

  // Property selection (for MANAGER with multiple properties)
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(
    user?.properties?.[0]?.id ?? ''
  );

  // Location selection
  const [locations, setLocations] = useState<PosLocation[]>([]);
  const [location, setLocation] = useState<PosLocation | null>(null);
  const [loadingLocations, setLoadingLocations] = useState(false);

  // Products
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Cart
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Modals
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showFolioPickerModal, setShowFolioPickerModal] = useState(false);

  // "Add to Room" intermediate state
  const [pendingBooking, setPendingBooking] = useState<Booking | null>(null);
  const [pendingFolios, setPendingFolios] = useState<FolioDto[]>([]);
  const [addToRoomError, setAddToRoomError] = useState<string | null>(null);
  const [addingToRoom, setAddingToRoom] = useState(false);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  // ── Load locations ──────────────────────────────────────────────────────
  const loadLocations = useCallback(async (propId: string) => {
    if (!propId) return;
    setLoadingLocations(true);
    setPageError(null);
    try {
      const locs = await posApi.getLocations(propId);
      setLocations(locs);
      if (isPosUser && user?.posLocationId) {
        // Auto-select this user's location
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
    if (selectedPropertyId) {
      loadLocations(selectedPropertyId);
    }
  }, [selectedPropertyId, loadLocations]);

  // ── Load products ───────────────────────────────────────────────────────
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.id]); // intentionally keyed on ID only — loadProducts is stable via useCallback

  // ── Cart helpers ────────────────────────────────────────────────────────
  const addToCart = (product: PosProduct) => {
    setCart(prev => {
      const existing = prev.find(e => e.product.id === product.id);
      if (existing) {
        return prev.map(e => e.product.id === product.id ? { ...e, quantity: e.quantity + 1 } : e);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      const updated = prev.map(e => e.product.id === productId ? { ...e, quantity: e.quantity + delta } : e)
                          .filter(e => e.quantity > 0);
      return updated;
    });
  };

  const clearCart = () => setCart([]);

  // ── Category filter ─────────────────────────────────────────────────────
  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];
  const filteredProducts = categoryFilter === 'All'
    ? products
    : products.filter(p => p.category === categoryFilter);

  // ── Cart totals ─────────────────────────────────────────────────────────
  const cartSubtotal = cart.reduce((sum, e) => sum + e.product.price * e.quantity, 0);
  const cartTax = cart.reduce((sum, e) => sum + (e.product.price * e.quantity * e.product.taxRate) / 100, 0);
  const cartTotal = cartSubtotal + cartTax;

  // ── "Add to Room" flow ──────────────────────────────────────────────────
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
        await chargeToFolio(openFolios[0].id!);
      } else {
        setShowFolioPickerModal(true);
      }
    } catch {
      setAddToRoomError('Failed to fetch folios for this booking');
    }
  };

  const chargeToFolio = async (folioId: string) => {
    if (!location) return;
    setShowFolioPickerModal(false);
    setAddingToRoom(true);
    setAddToRoomError(null);
    try {
      const order = await posApi.createOrder({
        posLocationId: location.id,
        items: cart.map(e => ({ posProductId: e.product.id, quantity: e.quantity })),
      });
      await posApi.chargeOrder(order.id, folioId);
      setCart([]);
      setPendingBooking(null);
      setPendingFolios([]);
      setSuccessMessage(`Charged to ${pendingBooking?.guestName ?? 'guest'}'s folio`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setAddToRoomError('Failed to charge order to folio');
    } finally {
      setAddingToRoom(false);
    }
  };

  const handleSettleSuccess = () => {
    setShowSettleModal(false);
    setCart([]);
    setSuccessMessage('Payment settled successfully');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // ── Render ──────────────────────────────────────────────────────────────
  if (!user) return null;

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* Header bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-800">POS</h1>

          {/* Property picker (MANAGER with multiple properties) */}
          {isManager && (user.properties?.length ?? 0) > 1 && (
            <select
              value={selectedPropertyId}
              onChange={e => {
                setSelectedPropertyId(e.target.value);
                setLocation(null);
                setLocations([]);
                setProducts([]);
                setCart([]);
              }}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {user.properties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}

          {/* Location picker */}
          {isManager && (
            loadingLocations ? (
              <span className="text-sm text-gray-500">Loading locations...</span>
            ) : (
              <select
                value={location?.id ?? ''}
                onChange={e => {
                  const loc = locations.find(l => l.id === e.target.value);
                  setLocation(loc ?? null);
                }}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Location</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            )
          )}

          {/* POS user: show location name badge */}
          {isPosUser && location && (
            <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
              {location.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isManager && location && (
            <button
              onClick={() => setShowManageModal(true)}
              title="Manage Items"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Success / error banners */}
      {successMessage && (
        <div className="bg-green-100 border-b border-green-300 text-green-800 px-4 py-2 text-sm text-center">
          {successMessage}
        </div>
      )}
      {pageError && (
        <div className="bg-red-100 border-b border-red-300 text-red-800 px-4 py-2 text-sm text-center">
          {pageError}
        </div>
      )}
      {addToRoomError && (
        <div className="bg-red-100 border-b border-red-300 text-red-800 px-4 py-2 text-sm text-center">
          {addToRoomError}
        </div>
      )}

      {/* No location selected */}
      {!location ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          {loadingLocations ? 'Loading...' : isManager ? 'Select a POS location to get started.' : 'No POS location assigned to your account.'}
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* ── Left panel: products ── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Category tabs */}
            <div className="bg-white border-b border-gray-200 px-4 py-2 flex gap-2 overflow-x-auto flex-shrink-0">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    categoryFilter === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Product grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingProducts ? (
                <div className="text-center py-12 text-gray-500">Loading products...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  {products.length === 0 ? 'No products available.' : 'No products in this category.'}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {filteredProducts.map(product => (
                    <ProductCard key={product.id} product={product} onAdd={addToCart} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right panel: cart ── */}
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col flex-shrink-0">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="font-semibold text-gray-800">Order</h2>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">Add items to start an order</div>
              ) : (
                cart.map(entry => (
                  <div key={entry.product.id} className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{entry.product.name}</div>
                      <div className="text-xs text-gray-500">
                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(entry.product.price)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateCartQuantity(entry.product.id, -1)}
                        className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center text-lg leading-none"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-medium">{entry.quantity}</span>
                      <button
                        onClick={() => updateCartQuantity(entry.product.id, 1)}
                        className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center text-lg leading-none"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-sm font-medium text-gray-800 w-16 text-right">
                      {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(entry.product.price * entry.quantity)}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Totals + actions */}
            {cart.length > 0 && (
              <div className="border-t border-gray-200 p-4 space-y-3">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(cartSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Tax</span>
                    <span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(cartTax)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-gray-800 pt-1 border-t border-gray-200">
                    <span>Total</span>
                    <span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(cartTotal)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => { setAddToRoomError(null); setShowGuestModal(true); }}
                    disabled={addingToRoom}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
                  >
                    {addingToRoom ? 'Charging...' : 'Add to Room'}
                  </button>
                  <button
                    onClick={() => setShowSettleModal(true)}
                    className="w-full py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors text-sm"
                  >
                    Settle Now
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
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
        onSelect={folio => chargeToFolio(folio.id!)}
      />

      {showSettleModal && location && (
        <SettleNowModal
          isOpen={showSettleModal}
          onClose={() => setShowSettleModal(false)}
          cart={cart}
          location={location}
          propertyId={selectedPropertyId}
          onSuccess={handleSettleSuccess}
        />
      )}

      {showManageModal && location && (
        <ManageItemsModal
          isOpen={showManageModal}
          onClose={() => setShowManageModal(false)}
          location={location}
          products={products}
          onProductsChanged={loadProducts}
        />
      )}
    </div>
  );
}
