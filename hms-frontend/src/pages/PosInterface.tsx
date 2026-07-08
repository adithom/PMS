import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import posApi from '../api/posApi';
import ProductCard from '../components/Pos/ProductCard';
import OpenTicketModal from '../components/Pos/OpenTicketModal';
import ConfirmModal from '../components/ConfirmModal';
import type { PosLocation, PosProduct, CartEntry, PosTicket } from '../types/pos';

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

function SettleNowModal({ isOpen, onClose, cart, location, propertyId: _propertyId, orderDiscountRate, onSuccess }: SettleNowModalProps) {
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [transactionReference, setTransactionReference] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPaymentMethod('CASH');
      setTransactionReference('');
      setError(null);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    setProcessing(true);
    setError(null);
    try {
      const ticket = await posApi.openTicket({
        posLocationId: location.id,
        guestName: 'Walk-in',
        mealType: (() => { const h = new Date().getHours(); return h < 11 ? 'BREAKFAST' : h < 15 ? 'LUNCH' : 'DINNER'; })() as import('../types/pos').MealType,
      });
      await posApi.addOrderToTicket(ticket.id, {
        items: cart.map(e => ({
          posProductId: e.product.id,
          quantity: e.quantity,
          ...(e.priceOverride != null ? { priceOverride: e.priceOverride } : {}),
        })),
        discountRate: orderDiscountRate > 0 ? orderDiscountRate : undefined,
      });
      await posApi.closeTicket(ticket.id, {
        paymentMethod,
        transactionReference: transactionReference || undefined,
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Settle — Walk-in</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="bg-gray-50 rounded-xl p-4 flex justify-between items-center">
            <div>
              <div className="text-xs text-gray-500 mb-0.5">{cart.reduce((s, e) => s + e.quantity, 0)} items</div>
              <div className="font-bold text-gray-900 text-lg">{fmt(cartTotal)}</div>
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">Order Total</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Method</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={inputCls}>
              <option value="CASH">Cash</option>
              <option value="CREDIT_CARD">Credit Card</option>
              <option value="DEBIT_CARD">Debit Card</option>
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
            </select>
          </div>

          {paymentMethod !== 'CASH' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {paymentMethod === 'UPI' ? 'UPI Reference' : 'Transaction Reference'}
              </label>
              <input type="text" placeholder={paymentMethod === 'UPI' ? 'guest@upi or txn ref' : 'TXN123456'}
                value={transactionReference} onChange={e => setTransactionReference(e.target.value)} className={inputCls} />
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
          <button onClick={onClose} disabled={processing}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={processing}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
            {processing ? 'Processing...' : 'Confirm Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CloseTicketPaymentModal ─────────────────────────────────────────────────

interface CloseTicketPaymentModalProps {
  ticket: PosTicket;
  onClose: () => void;
  onSuccess: (closed: PosTicket) => void;
}

function CloseTicketPaymentModal({ ticket, onClose, onSuccess }: CloseTicketPaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [transactionReference, setTransactionReference] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setProcessing(true);
    setError(null);
    try {
      const closed = await posApi.closeTicket(ticket.id, {
        paymentMethod,
        transactionReference: transactionReference || undefined,
      });
      onSuccess(closed);
    } catch {
      setError('Failed to close ticket. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const ticketTotal = ticket.orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Settle — {ticket.guestName}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="bg-gray-50 rounded-xl p-4 flex justify-between items-center">
            <div>
              <div className="text-xs text-gray-500 mb-0.5">{ticket.orders.length} order{ticket.orders.length !== 1 ? 's' : ''}</div>
              <div className="font-bold text-gray-900 text-lg">{fmt(ticketTotal)}</div>
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">Order Total</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Method</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={inputCls}>
              <option value="CASH">Cash</option>
              <option value="CREDIT_CARD">Credit Card</option>
              <option value="DEBIT_CARD">Debit Card</option>
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
            </select>
          </div>

          {paymentMethod !== 'CASH' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {paymentMethod === 'UPI' ? 'UPI Reference' : 'Transaction Reference'}
              </label>
              <input type="text" placeholder={paymentMethod === 'UPI' ? 'guest@upi or txn ref' : 'TXN123456'}
                value={transactionReference} onChange={e => setTransactionReference(e.target.value)} className={inputCls} />
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
          <button onClick={onClose} disabled={processing}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={processing}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
            {processing ? 'Processing...' : 'Confirm Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CancelTicketModal ────────────────────────────────────────────────────────

interface CancelTicketModalProps {
  ticket: PosTicket;
  onClose: () => void;
  onSuccess: (cancelled: PosTicket) => void;
}

function CancelTicketModal({ ticket, onClose, onSuccess }: CancelTicketModalProps) {
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError('Please enter a reason for cancelling this ticket.');
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const cancelled = await posApi.cancelTicket(ticket.id, reason.trim());
      onSuccess(cancelled);
    } catch {
      setError('Failed to cancel ticket. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Cancel Ticket — {ticket.guestName}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-500">
            This ticket {ticket.orders.length > 0 ? `and its ${ticket.orders.length} order${ticket.orders.length !== 1 ? 's' : ''}` : ''} will be cancelled. No payment or charge will be recorded.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason</label>
            <textarea rows={3} placeholder="e.g. Guest left without ordering"
              value={reason} onChange={e => setReason(e.target.value)} className={inputCls} />
          </div>

          {error && <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
          <button onClick={onClose} disabled={processing}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
            Back
          </button>
          <button onClick={handleConfirm} disabled={processing}
            className="px-5 py-2.5 bg-rose-600 text-white rounded-lg text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
            {processing ? 'Cancelling...' : 'Cancel Ticket'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TicketDetailModal ───────────────────────────────────────────────────────

interface TicketDetailModalProps {
  ticket: PosTicket;
  onClose: () => void;
}

function TicketDetailModal({ ticket, onClose }: TicketDetailModalProps) {
  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
  const ticketTotal = ticket.orders.reduce((s, o) => s + o.totalAmount, 0);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {ticket.roomNumber ? `Room ${ticket.roomNumber}` : ticket.guestName}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {ticket.mealType.charAt(0) + ticket.mealType.slice(1).toLowerCase()} · {ticket.ticketNumber}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {ticket.orders.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No orders on this ticket yet.</p>
          ) : (
            <div className="space-y-4">
              {ticket.orders.map((order, idx) => (
                <div key={order.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2.5 flex justify-between items-center">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Order {idx + 1} · {order.orderNumber}
                    </span>
                    <span className="text-xs font-semibold text-gray-700">{fmt(order.totalAmount)}</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {order.items.map((item, iIdx) => (
                      <div key={item.id ?? iIdx} className="flex justify-between items-center px-4 py-2.5">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-gray-800">{item.itemName}</span>
                          {item.quantity > 1 && (
                            <span className="text-xs text-gray-400 ml-1.5">×{item.quantity}</span>
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-700 ml-3 flex-shrink-0">{fmt(item.totalAmount)}</span>
                      </div>
                    ))}
                  </div>
                  {(order.discountAmount > 0 || order.taxAmount > 0) && (
                    <div className="px-4 py-2 border-t border-gray-100 space-y-1">
                      {order.discountAmount > 0 && (
                        <div className="flex justify-between text-xs text-emerald-600">
                          <span>Discount {order.discountRate ? `(${order.discountRate}%)` : ''}</span>
                          <span>−{fmt(order.discountAmount)}</span>
                        </div>
                      )}
                      {order.taxAmount > 0 && (
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>Tax</span><span>{fmt(order.taxAmount)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {ticket.orders.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center flex-shrink-0">
            <span className="text-sm font-semibold text-gray-700">Total</span>
            <span className="text-base font-bold text-gray-900">{fmt(ticketTotal)}</span>
          </div>
        )}

        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose}
            className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">
            Close
          </button>
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

  const [showSettleModal, setShowSettleModal] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [addingOrder, setAddingOrder] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [showCartSheet, setShowCartSheet] = useState(false);

  // Ticket state
  const [openTickets, setOpenTickets] = useState<PosTicket[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [showOpenTicketModal, setShowOpenTicketModal] = useState(false);
  const [showTicketSheet, setShowTicketSheet] = useState(false);
  const [closingTicketId, setClosingTicketId] = useState<string | null>(null);
  const [closePaymentTicket, setClosePaymentTicket] = useState<PosTicket | null>(null);
  const [cancelTicketTarget, setCancelTicketTarget] = useState<PosTicket | null>(null);
  const [viewingTicket, setViewingTicket] = useState<PosTicket | null>(null);

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
      setOpenTickets([]);
      setActiveTicketId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.id]);

  const loadOpenTickets = useCallback(async () => {
    if (!location) return;
    try {
      const tickets = await posApi.getOpenTickets(location.id);
      setOpenTickets(tickets);
    } catch {
      // non-fatal — ticket list is supplementary
    }
  }, [location]);

  useEffect(() => {
    if (location) loadOpenTickets();
  }, [location?.id, loadOpenTickets]);

  const handleTicketCreated = (ticket: PosTicket) => {
    setOpenTickets(prev => [ticket, ...prev]);
    setActiveTicketId(ticket.id);
    setShowOpenTicketModal(false);
  };

  const handleAddToTicket = async () => {
    if (!activeTicketId || !location || cart.length === 0) return;
    setAddingOrder(true);
    setOrderError(null);
    try {
      await posApi.addOrderToTicket(activeTicketId, {
        posLocationId: location.id,
        items: cart.map(e => ({
          posProductId: e.product.id,
          quantity: e.quantity,
          ...(e.priceOverride != null ? { priceOverride: e.priceOverride } : {}),
        })),
        discountRate: orderDiscountRate > 0 ? orderDiscountRate : undefined,
      });
      clearCart();
      setSuccessMessage('Order added to ticket');
      setTimeout(() => setSuccessMessage(null), 3000);
      loadOpenTickets();
    } catch {
      setOrderError('Failed to add order to ticket');
    } finally {
      setAddingOrder(false);
    }
  };

  const handleCloseTicket = async (ticketId: string) => {
    const ticket = openTickets.find(t => t.id === ticketId);
    // Walk-in tickets (no linked booking/folio) require a payment method to close.
    if (ticket && !ticket.bookingId && !ticket.mealPlanCovered) {
      setClosePaymentTicket(ticket);
      return;
    }

    setClosingTicketId(ticketId);
    setOrderError(null);
    try {
      const closed = await posApi.closeTicket(ticketId);
      handleTicketClosed(closed);
    } catch {
      setOrderError('Failed to close ticket');
    } finally {
      setClosingTicketId(null);
    }
  };

  const handleTicketClosed = (closed: PosTicket) => {
    setOpenTickets(prev => prev.filter(t => t.id !== closed.id));
    if (activeTicketId === closed.id) setActiveTicketId(null);
    const msg = closed.mealPlanCovered
      ? `Ticket ${closed.ticketNumber} closed — covered by meal plan`
      : `Receipt ${closed.invoiceNumber} generated`;
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleClosePaymentSuccess = (closed: PosTicket) => {
    setClosePaymentTicket(null);
    handleTicketClosed(closed);
  };

  const handleCancelSuccess = (cancelled: PosTicket) => {
    setCancelTicketTarget(null);
    setOpenTickets(prev => prev.filter(t => t.id !== cancelled.id));
    if (activeTicketId === cancelled.id) setActiveTicketId(null);
    setSuccessMessage(`Ticket ${cancelled.ticketNumber} cancelled`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const addToCart = (product: PosProduct, priceOverride?: number) => {
    setCart(prev => {
      const existing = prev.find(e => e.product.id === product.id);
      if (existing && !product.isPriceOverridable) {
        return prev.map(e => e.product.id === product.id ? { ...e, quantity: e.quantity + 1 } : e);
      }
      return [...prev, { product, quantity: 1, priceOverride }];
    });
  };

  const updateCartQuantity = (productId: string, delta: number, idx?: number) => {
    setCart(prev => prev.map((e, i) => {
      const match = idx !== undefined ? i === idx : e.product.id === productId;
      return match ? { ...e, quantity: e.quantity + delta } : e;
    }).filter(e => e.quantity > 0));
  };

  const clearCart = () => { setCart([]); setOrderDiscountRate(0); };

  const categories = ['All', ...Array.from(new Set(products.map(p => p.categoryName).filter(Boolean)))];
  const filteredProducts = categoryFilter === 'All' ? products : products.filter(p => p.categoryName === categoryFilter);

  const cartSubtotal = cart.reduce((sum, e) => sum + (e.priceOverride ?? e.product.price) * e.quantity, 0);
  const cartTax = cart.reduce((sum, e) => sum + ((e.priceOverride ?? e.product.price) * e.quantity * e.product.taxRate) / 100, 0);
  const discountAmount = orderDiscountRate > 0 ? (cartSubtotal * orderDiscountRate) / 100 : 0;
  const cartTotal = cartSubtotal + cartTax - discountAmount;
  const cartItemCount = cart.reduce((s, e) => s + e.quantity, 0);

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
      {(pageError || orderError) && (
        <div className="bg-red-50 border-b border-red-100 text-red-700 px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm flex items-center gap-2 flex-shrink-0">
          <span>⚠</span> {pageError || orderError}
        </div>
      )}

      {!location ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
          <p className="text-gray-400 text-sm max-w-xs">
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
              <div className="flex-1 overflow-y-auto px-3 py-4 pb-28 sm:px-4 sm:py-5 md:pb-5 md:px-6">
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
              {/* Sidebar header */}
              <div className="px-4 py-3 lg:px-5 lg:py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-gray-900">Order</h2>
                  {cartItemCount > 0 && (
                    <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                      {cartItemCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowOpenTicketModal(true)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg">
                    + Ticket
                  </button>
                  {cart.length > 0 && (
                    <button onClick={clearCart} className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors">
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* ── Open Tickets list (only when tickets exist) ── */}
              {openTickets.length > 0 && (
                <div className="border-b border-gray-100 px-4 lg:px-5 py-2 space-y-1.5 flex-shrink-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Tickets</span>
                    <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">{openTickets.length}</span>
                  </div>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto">
                    {openTickets.map(ticket => (
                      <div
                        key={ticket.id}
                        className={`flex items-center justify-between rounded-xl px-3 py-2 border transition-all ${
                          activeTicketId === ticket.id
                            ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <button
                          className="flex-1 min-w-0 text-left"
                          onClick={() => setActiveTicketId(activeTicketId === ticket.id ? null : ticket.id)}
                        >
                          <div className="text-sm font-semibold text-gray-900 truncate">
                            {ticket.roomNumber ? `Room ${ticket.roomNumber}` : ticket.guestName}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-gray-500">{ticket.mealType.charAt(0) + ticket.mealType.slice(1).toLowerCase()}</span>
                            {ticket.orders.length > 0 && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-gray-300" />
                                <span className="text-xs text-gray-400">{ticket.orders.length} order{ticket.orders.length !== 1 ? 's' : ''}</span>
                              </>
                            )}
                          </div>
                        </button>
                        <div className="ml-2 flex items-center gap-1 flex-shrink-0">
                          {ticket.orders.length > 0 && (
                            <button
                              onClick={() => setViewingTicket(ticket)}
                              className="text-xs font-medium text-blue-500 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors"
                            >
                              View
                            </button>
                          )}
                          <button
                            onClick={() => setCancelTicketTarget(ticket)}
                            className="text-xs font-medium text-gray-400 hover:text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleCloseTicket(ticket.id)}
                            disabled={closingTicketId === ticket.id}
                            className="text-xs font-medium text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {closingTicketId === ticket.id ? '...' : 'Close'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-4 lg:px-5">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
                    <p className="text-sm">Add items to start an order</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {cart.map((entry, idx) => {
                      const unitPrice = entry.priceOverride ?? entry.product.price;
                      return (
                        <div key={`${entry.product.id}-${idx}`} className="flex items-center gap-3 py-3.5">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800 truncate">{entry.product.name}</div>
                            {entry.product.isPriceOverridable ? (
                              <div className="relative mt-0.5 w-24">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">₹</span>
                                <input
                                  type="number" min="0" step="0.01"
                                  value={entry.priceOverride ?? ''}
                                  onChange={e => setCart(prev => prev.map((en, i) => i === idx ? { ...en, priceOverride: parseFloat(e.target.value) || 0 } : en))}
                                  className="w-full border border-gray-200 rounded pl-5 pr-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400 mt-0.5">
                                {fmt(entry.product.price)}
                                {entry.product.discountRate != null && entry.product.discountRate > 0 && (
                                  <span className="ml-1 text-emerald-600">−{entry.product.discountRate}%</span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button onClick={() => updateCartQuantity(entry.product.id, -1, idx)}
                              className="w-8 h-8 lg:w-7 lg:h-7 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center font-bold transition-colors text-base leading-none">−</button>
                            <span className="w-7 text-center text-sm font-semibold text-gray-800">{entry.quantity}</span>
                            <button onClick={() => updateCartQuantity(entry.product.id, 1, idx)}
                              className="w-8 h-8 lg:w-7 lg:h-7 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center font-bold transition-colors text-base leading-none">+</button>
                          </div>
                          <div className="text-sm font-semibold text-gray-900 w-20 text-right shrink-0">
                            {fmt(unitPrice * entry.quantity)}
                          </div>
                        </div>
                      );
                    })}
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
                    {activeTicketId ? (
                      <>
                        <button onClick={handleAddToTicket} disabled={addingOrder}
                          className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm shadow-sm">
                          {addingOrder ? 'Adding...' : `Add to Ticket`}
                        </button>
                        <button onClick={() => setActiveTicketId(null)}
                          className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 transition-colors">
                          or switch to direct checkout
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setShowSettleModal(true)}
                        className="w-full py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors text-sm shadow-sm">
                        Settle Now
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Mobile bottom bar — always visible ── */}
          <div className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 px-3 py-2.5 shadow-lg z-30 flex gap-2">
            {/* Ticket button */}
            <button
              onClick={() => openTickets.length > 0 ? setShowTicketSheet(true) : setShowOpenTicketModal(true)}
              className={`flex-1 rounded-xl py-3 flex flex-col items-center justify-center transition-colors active:scale-95 ${
                activeTicketId
                  ? 'bg-blue-600 text-white'
                  : openTickets.length > 0
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>
                <line x1="13" y1="5" x2="13" y2="7"/><line x1="13" y1="11" x2="13" y2="13"/><line x1="13" y1="17" x2="13" y2="19"/>
              </svg>
              <span className="text-xs font-semibold mt-0.5">
                {activeTicketId
                  ? (() => { const t = openTickets.find(t => t.id === activeTicketId); return t ? (t.roomNumber ? `Rm ${t.roomNumber}` : t.guestName.split(' ')[0]) : 'Ticket'; })()
                  : openTickets.length > 0
                  ? `${openTickets.length} open`
                  : 'New Ticket'}
              </span>
            </button>

            {/* Cart button */}
            <button
              onClick={() => cart.length > 0 ? setShowCartSheet(true) : undefined}
              disabled={cart.length === 0}
              className="flex-[2] bg-blue-600 text-white rounded-xl py-3 flex items-center justify-between px-4 shadow-sm active:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none transition-colors"
            >
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full min-w-[1.5rem] text-center ${cart.length > 0 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                {cartItemCount}
              </span>
              <span className="font-semibold text-sm">{cart.length === 0 ? 'Add items' : 'View Order'}</span>
              <span className="font-bold text-sm">{cart.length > 0 ? fmt(cartTotal) : ''}</span>
            </button>
          </div>

          {/* ── Mobile cart bottom sheet ── */}
          {showCartSheet && (
            <div className="md:hidden fixed inset-0 z-40 flex flex-col justify-end">
              <div className="absolute inset-0 bg-black/40" onClick={() => setShowCartSheet(false)} />
              <div className="relative bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[95vh]">
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

                {/* Scrollable body: items + tickets + totals */}
                <div className="flex-1 overflow-y-auto">
                  {/* Cart items — no inner scroll, list all */}
                  <div className="px-5 divide-y divide-gray-50">
                    {cart.map((entry, idx) => {
                      const unitPrice = entry.priceOverride ?? entry.product.price;
                      return (
                        <div key={`${entry.product.id}-${idx}`} className="flex items-center gap-3 py-3.5">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800 truncate">{entry.product.name}</div>
                            {entry.product.isPriceOverridable ? (
                              <div className="relative mt-0.5 w-24">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">₹</span>
                                <input
                                  type="number" min="0" step="0.01"
                                  value={entry.priceOverride ?? ''}
                                  onChange={e => setCart(prev => prev.map((en, i) => i === idx ? { ...en, priceOverride: parseFloat(e.target.value) || 0 } : en))}
                                  className="w-full border border-gray-200 rounded pl-5 pr-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400 mt-0.5">
                                {fmt(entry.product.price)}
                                {entry.product.discountRate != null && entry.product.discountRate > 0 && (
                                  <span className="ml-1 text-emerald-600">−{entry.product.discountRate}%</span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={() => updateCartQuantity(entry.product.id, -1, idx)}
                              className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-lg leading-none active:bg-gray-200">−</button>
                            <span className="w-7 text-center text-sm font-semibold text-gray-800">{entry.quantity}</span>
                            <button onClick={() => updateCartQuantity(entry.product.id, 1, idx)}
                              className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-lg leading-none active:bg-gray-200">+</button>
                          </div>
                          <div className="text-sm font-semibold text-gray-900 w-20 text-right shrink-0">
                            {fmt(unitPrice * entry.quantity)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Tickets strip — only when tickets exist */}
                  {openTickets.length > 0 && (
                    <div className="border-t border-gray-100 px-5 pt-3 pb-1">
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {openTickets.map(ticket => (
                          <button
                            key={ticket.id}
                            onClick={() => setActiveTicketId(activeTicketId === ticket.id ? null : ticket.id)}
                            className={`flex-shrink-0 px-3 py-2 rounded-xl border text-left transition-all ${
                              activeTicketId === ticket.id
                                ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400'
                                : 'border-gray-200 bg-white'
                            }`}
                          >
                            <div className="text-xs font-semibold text-gray-900">
                              {ticket.roomNumber ? `Rm ${ticket.roomNumber}` : ticket.guestName.split(' ')[0]}
                            </div>
                            <div className="text-xs text-gray-400">{ticket.mealType.charAt(0) + ticket.mealType.slice(1).toLowerCase()}</div>
                          </button>
                        ))}
                        <button
                          onClick={() => { setShowCartSheet(false); setShowOpenTicketModal(true); }}
                          className="flex-shrink-0 px-3 py-2 rounded-xl border border-dashed border-blue-300 text-blue-600 text-xs font-medium"
                        >
                          + New
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Discount + totals */}
                  <div className="px-5 pt-4 pb-2 space-y-3 border-t border-gray-100">
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
                  </div>
                </div>

                {/* Action buttons — sticky at bottom */}
                <div className="px-5 pt-3 pb-6 border-t border-gray-100 flex-shrink-0 space-y-2">
                  {activeTicketId ? (
                    <>
                      <button onClick={() => { setShowCartSheet(false); handleAddToTicket(); }} disabled={addingOrder}
                        className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold active:bg-blue-700 disabled:opacity-50 transition-colors text-sm shadow-sm">
                        {addingOrder ? 'Adding...' : 'Add to Ticket'}
                      </button>
                      <button onClick={() => setActiveTicketId(null)} className="w-full py-2 text-xs text-gray-400">
                        switch to direct checkout
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setShowCartSheet(false); setShowOpenTicketModal(true); }}
                        className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold active:bg-blue-700 transition-colors text-sm shadow-sm">
                        Open Ticket
                      </button>
                      <button onClick={() => { setShowCartSheet(false); setShowSettleModal(true); }}
                        className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-semibold active:bg-emerald-700 transition-colors text-sm shadow-sm">
                        Settle Now
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
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

      {/* ── Mobile ticket sheet ── */}
      {showTicketSheet && (
        <div className="md:hidden fixed inset-0 z-40 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowTicketSheet(false)} />
          <div className="relative bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[70vh]">
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-gray-900">Open Tickets</h2>
                <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">{openTickets.length}</span>
              </div>
              <button
                onClick={() => { setShowTicketSheet(false); setShowOpenTicketModal(true); }}
                className="text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg"
              >
                + New Ticket
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
              {openTickets.map(ticket => (
                <div
                  key={ticket.id}
                  className={`flex items-center justify-between rounded-2xl px-4 py-3.5 border transition-all ${
                    activeTicketId === ticket.id
                      ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <button
                    className="flex-1 text-left"
                    onClick={() => {
                      setActiveTicketId(activeTicketId === ticket.id ? null : ticket.id);
                      setShowTicketSheet(false);
                    }}
                  >
                    <div className="text-base font-bold text-gray-900">
                      {ticket.roomNumber ? `Room ${ticket.roomNumber}` : ticket.guestName}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">{ticket.mealType.charAt(0) + ticket.mealType.slice(1).toLowerCase()}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-300" />
                      <span className="text-xs text-gray-400">{ticket.ticketNumber}</span>
                      {ticket.orders.length > 0 && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-gray-300" />
                          <span className="text-xs text-gray-400">{ticket.orders.length} order{ticket.orders.length !== 1 ? 's' : ''}</span>
                        </>
                      )}
                    </div>
                    {activeTicketId === ticket.id && (
                      <span className="text-xs text-blue-600 font-medium mt-1 block">Active — tap to deselect</span>
                    )}
                  </button>
                  <div className="ml-3 flex flex-col items-stretch gap-1.5 flex-shrink-0">
                    {ticket.orders.length > 0 && (
                      <button
                        onClick={() => { setViewingTicket(ticket); setShowTicketSheet(false); }}
                        className="text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-xl transition-colors"
                      >
                        View
                      </button>
                    )}
                    <button
                      onClick={() => { handleCloseTicket(ticket.id); setShowTicketSheet(false); }}
                      disabled={closingTicketId === ticket.id}
                      className="text-sm font-medium text-gray-400 hover:text-emerald-600 bg-gray-100 hover:bg-emerald-50 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {closingTicketId === ticket.id ? '...' : 'Close'}
                    </button>
                    <button
                      onClick={() => { setCancelTicketTarget(ticket); setShowTicketSheet(false); }}
                      className="text-sm font-medium text-gray-400 hover:text-rose-600 bg-gray-100 hover:bg-rose-50 px-3 py-2 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setShowTicketSheet(false)}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {location && (
        <OpenTicketModal
          isOpen={showOpenTicketModal}
          onClose={() => setShowOpenTicketModal(false)}
          locationId={location.id}
          propertyId={selectedPropertyId}
          onTicketCreated={handleTicketCreated}
        />
      )}

      {closePaymentTicket && (
        <CloseTicketPaymentModal
          ticket={closePaymentTicket}
          onClose={() => setClosePaymentTicket(null)}
          onSuccess={handleClosePaymentSuccess}
        />
      )}

      {cancelTicketTarget && (
        <CancelTicketModal
          ticket={cancelTicketTarget}
          onClose={() => setCancelTicketTarget(null)}
          onSuccess={handleCancelSuccess}
        />
      )}

      {viewingTicket && (
        <TicketDetailModal
          ticket={viewingTicket}
          onClose={() => setViewingTicket(null)}
        />
      )}
    </div>
  );
}
