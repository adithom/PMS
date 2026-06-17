import { useState, useEffect, useMemo } from 'react';
import { fmtDateTime } from '../../utils/dateHelpers';
import { X, ArrowRightLeft, FileText, Printer, Pencil, Trash2 } from 'lucide-react';
import folioApi from '../../api/folioApi';
import type { FolioDetailDto, ChargeDto, ChargeUpdateDto, DiscountBillType, DiscountType } from '../../api/folioApi';
import billingApi from '../../api/billingApi';
import type { BillDto } from '../../api/billingApi';
import paymentApi from '../../api/paymentApi';
import type { PaymentDto } from '../../api/paymentApi';
import { triggerPresignedDownload } from '../../utils/downloadUtils';
import LoadingSpinner from '../LoadingSpinner';
import ModalShell from '../ModalShell';
import ChargeForm from './ChargeForm';
import PaymentForm from './PaymentForm';
import AgentPaymentForm from './AgentPaymentForm';
import FolioRoutingForm from './FolioRoutingForm';
import BillViewModal from './BillViewModal';

interface FolioDetailModalProps {
  propertyId: string;
  folioId: string;
  onClose: () => void;
  readOnly?: boolean;
}

const CHARGE_CATEGORIES = [
  { codes: ['ROOM_RENT', 'MEAL_PLAN'], label: 'Room & Meal Plan' },
  { codes: ['RESTAURANT'],             label: 'Restaurant' },
  { codes: ['SPA'],                    label: 'Spa' },
  { codes: ['LAUNDRY'],                label: 'Laundry' },
  { codes: ['TRAVEL_DESK'],            label: 'Travel Desk' },
  { codes: ['SHOP'],                   label: 'Gift Shop' },
  { codes: ['MISC'],                   label: 'Miscellaneous' },
];

export default function FolioDetailModal({ propertyId, folioId, onClose, readOnly = false }: FolioDetailModalProps) {
  const [folio, setFolio] = useState<FolioDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bills
  const [bills, setBills] = useState<BillDto[]>([]);
  const [downloadingBillId, setDownloadingBillId] = useState<string | null>(null);
  const [isGeneratingBill, setIsGeneratingBill] = useState(false);
  const [showBillOptions, setShowBillOptions] = useState(false);
  const [billOptGstNumber, setBillOptGstNumber] = useState('');
  const [billOptSplitAncillary, setBillOptSplitAncillary] = useState(false);

  // Action states
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);

  // Inline charge editing
  const [editingChargeId, setEditingChargeId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ description: string; finalPrice: number; quantity: number; taxRate: number }>(
    { description: '', finalPrice: 0, quantity: 1, taxRate: 0 }
  );

  // Discount form state
  const [showDiscountForm, setShowDiscountForm] = useState(false);
  const [discountTarget, setDiscountTarget] = useState<DiscountBillType>('room');
  const [discountType, setDiscountType] = useState<DiscountType>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('');
  const [discountSubmitting, setDiscountSubmitting] = useState(false);
  const [discountError, setDiscountError] = useState<string | null>(null);

  // Payments list
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentEditForm, setPaymentEditForm] = useState<{ amount: string; notes: string }>({ amount: '', notes: '' });
  const [paymentProcessingId, setPaymentProcessingId] = useState<string | null>(null);

  // Sub-modal states
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showAgentPayment, setShowAgentPayment] = useState(false);
  const [showRouting, setShowRouting] = useState(false);
  const [showBillView, setShowBillView] = useState(false);

  useEffect(() => {
    loadFolio();
    loadBills();
    loadPayments();
  }, [propertyId, folioId]);

  const loadFolio = async () => {
    setLoading(true);
    try {
      const data = await folioApi.getFolioDetails(propertyId, folioId);
      setFolio(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load folio details.');
    } finally {
      setLoading(false);
    }
  };

  const loadBills = async () => {
    try {
      const data = await billingApi.getBillsForFolio(folioId);
      setBills(data || []);
    } catch {
      // Non-critical — bills section just stays empty
    }
  };

  const loadPayments = async () => {
    try {
      const data = await paymentApi.getPaymentsByFolio(propertyId, folioId);
      setPayments(data || []);
    } catch {
      // Non-critical
    }
  };

  const handleGenerateInvoice = async () => {
    setIsGeneratingBill(true);
    setShowBillOptions(false);
    try {
      const result = await billingApi.generateBills(folioId, billOptGstNumber || undefined, billOptSplitAncillary);
      const withUrl = result.bills.filter(b => b.pdfDownloadUrl);
      if (withUrl.length === 0) {
        alert('Bill generated but PDF upload unavailable. Contact admin.');
      } else {
        withUrl.forEach((bill, i) => {
          setTimeout(() => triggerPresignedDownload(bill.pdfDownloadUrl!), i * 300);
        });
      }
      await loadBills();
    } catch (err: any) {
      alert(err.message || 'Failed to generate bill.');
    } finally {
      setIsGeneratingBill(false);
    }
  };

  const handleDownloadBill = async (bill: BillDto) => {
    setDownloadingBillId(bill.id);
    try {
      const url = await billingApi.getDownloadUrl(bill.id);
      triggerPresignedDownload(url);
    } catch (err: any) {
      alert(err.message || 'Failed to get download link.');
    } finally {
      setDownloadingBillId(null);
    }
  };

  const handleVoidCharge = async (charge: ChargeDto) => {
    const reason = window.prompt('Please enter a reason for voiding this charge:');
    if (!reason) return;
    setIsProcessingId(charge.id);
    try {
      await folioApi.voidCharge(propertyId, folioId, charge.id, reason);
      await loadFolio();
    } catch (err: any) {
      alert(err.message || 'Failed to void charge.');
    } finally {
      setIsProcessingId(null);
    }
  };

  const hasActiveCumulativeBill = useMemo(
    () => bills.some(b => !b.isVoided && (b.category === 'ROOM_RENT' || b.category === 'ANCILLARY')),
    [bills]
  );

  const isChargeEditable = (charge: ChargeDto) =>
    !charge.isVoided &&
    charge.referenceType !== 'POS_TICKET' &&
    folio?.status === 'OPEN' &&
    !hasActiveCumulativeBill;

  const startEditCharge = (charge: ChargeDto) => {
    setEditingChargeId(charge.id);
    setEditForm({
      description: charge.description ?? '',
      finalPrice: charge.totalAmount ?? 0,
      quantity: charge.quantity ?? 1,
      taxRate: charge.taxRate ?? 0,
    });
  };

  const handleSaveEdit = async (charge: ChargeDto) => {
    setIsProcessingId(charge.id);
    try {
      const qty = editForm.quantity || 1;
      const exTaxTotal = editForm.finalPrice / (1 + editForm.taxRate / 100);
      const unitPrice = exTaxTotal / qty;
      await folioApi.updateCharge(propertyId, folioId, charge.id, {
        description: editForm.description,
        unitPrice,
        quantity: qty,
        taxRate: editForm.taxRate,
      });
      setEditingChargeId(null);
      await loadFolio();
    } catch (err: any) {
      alert(err.message || 'Failed to update charge.');
    } finally {
      setIsProcessingId(null);
    }
  };

  const openDiscountForm = (target: DiscountBillType) => {
    const existing = target === 'room'
      ? { type: folio?.roomDiscountType, value: folio?.roomDiscountValue }
      : { type: folio?.ancillaryDiscountType, value: folio?.ancillaryDiscountValue };
    setDiscountTarget(target);
    setDiscountType(existing.type ?? 'PERCENTAGE');
    setDiscountValue(existing.value != null ? String(existing.value) : '');
    setDiscountError(null);
    setShowDiscountForm(true);
  };

  const handleSaveDiscount = async () => {
    const num = parseFloat(discountValue);
    if (!discountValue || isNaN(num) || num <= 0) {
      setDiscountError('Enter a positive number.');
      return;
    }
    if (discountType === 'PERCENTAGE' && num > 100) {
      setDiscountError('Percentage cannot exceed 100.');
      return;
    }
    setDiscountSubmitting(true);
    setDiscountError(null);
    try {
      const updated = await folioApi.setDiscount(propertyId, folioId, discountTarget, {
        discountType,
        value: num,
      });
      setFolio(prev => prev ? { ...prev, ...updated } : prev);
      setShowDiscountForm(false);
    } catch (err: any) {
      setDiscountError(err.message || 'Failed to save discount.');
    } finally {
      setDiscountSubmitting(false);
    }
  };

  const handleDeleteDiscount = async (target: DiscountBillType) => {
    if (!window.confirm('Remove this discount?')) return;
    try {
      const updated = await folioApi.deleteDiscount(propertyId, folioId, target);
      setFolio(prev => prev ? { ...prev, ...updated } : prev);
    } catch (err: any) {
      alert(err.message || 'Failed to remove discount.');
    }
  };

  const startEditPayment = (p: PaymentDto) => {
    setEditingPaymentId(p.id);
    setPaymentEditForm({ amount: String(p.amount ?? ''), notes: p.notes ?? '' });
  };

  const handleSavePaymentEdit = async (p: PaymentDto) => {
    const amt = parseFloat(paymentEditForm.amount);
    if (isNaN(amt) || amt <= 0) return;
    setPaymentProcessingId(p.id);
    try {
      await paymentApi.updateFolioPayment(propertyId, folioId, p.id, {
        amount: amt,
        notes: paymentEditForm.notes,
      });
      setEditingPaymentId(null);
      await Promise.all([loadPayments(), loadFolio()]);
    } catch (err: any) {
      alert(err.message || 'Failed to update payment.');
    } finally {
      setPaymentProcessingId(null);
    }
  };

  const handleDeletePayment = async (p: PaymentDto) => {
    if (!window.confirm(`Delete payment ${p.paymentNumber ?? p.id} of ${folio?.currency} ${p.amount?.toFixed(2)}? This cannot be undone.`)) return;
    setPaymentProcessingId(p.id);
    try {
      await paymentApi.deleteFolioPayment(propertyId, folioId, p.id);
      await Promise.all([loadPayments(), loadFolio()]);
    } catch (err: any) {
      alert(err.message || 'Failed to delete payment.');
    } finally {
      setPaymentProcessingId(null);
    }
  };

  const totalPayments = useMemo(
    () => payments.reduce((s, p) => s + (p.amount ?? 0), 0),
    [payments]
  );

  // Charge totals for discount live preview
  const roomChargesTotal = useMemo(() => {
    if (!folio?.charges) return 0;
    return folio.charges
      .filter(c => !c.isVoided && (c.chargeCode === 'ROOM_RENT' || c.chargeCode === 'MEAL_PLAN'))
      .reduce((s, c) => s + (c.totalAmount ?? 0), 0);
  }, [folio?.charges]);

  const ancillaryChargesTotal = useMemo(() => {
    if (!folio?.charges) return 0;
    return folio.charges
      .filter(c => !c.isVoided && c.chargeCode !== 'ROOM_RENT' && c.chargeCode !== 'MEAL_PLAN')
      .reduce((s, c) => s + (c.totalAmount ?? 0), 0);
  }, [folio?.charges]);

  const discountPreviewAmount = useMemo(() => {
    const num = parseFloat(discountValue);
    if (!discountValue || isNaN(num) || num <= 0) return null;
    const base = discountTarget === 'room' ? roomChargesTotal : ancillaryChargesTotal;
    if (discountType === 'FLAT') return Math.min(num, base);
    return (base * num) / 100;
  }, [discountValue, discountType, discountTarget, roomChargesTotal, ancillaryChargesTotal]);

  // Group charges by category in display order; skip empty categories
  const categorizedCharges = useMemo(() => {
    if (!folio?.charges) return [];
    return CHARGE_CATEGORIES
      .map(cat => ({
        ...cat,
        charges: folio.charges!
          .filter(c => cat.codes.includes(c.chargeCode))
          .sort((a, b) => new Date(a.postingDate ?? a.chargeDate).getTime() - new Date(b.postingDate ?? b.chargeDate).getTime()),
      }))
      .filter(cat => cat.charges.length > 0);
  }, [folio]);

  if (loading && !folio) {
    return (
      <ModalShell title="Loading Folio..." size="wide" onClose={onClose}>
        <div className="flex h-96 items-center justify-center">
          <LoadingSpinner text="Retrieving financial records..." />
        </div>
      </ModalShell>
    );
  }

  if (error || !folio) {
    return (
      <ModalShell title="Error" onClose={onClose}>
        <div className="rounded-lg bg-rose-50 p-4 text-rose-800">{error || 'Folio not found'}</div>
      </ModalShell>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm sm:p-6 lg:p-8">
      <div className="flex h-full w-full max-w-[1600px] flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl">
        
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-extrabold text-slate-900">
                Folio #{folio.folioNumber}
              </h2>
              <span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${
                folio.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700' : 
                folio.status === 'CLOSED' ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {folio.status}
              </span>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                {folio.folioType}
              </span>
              {readOnly && (
                <span className="rounded-md bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-700">
                  View Only
                </span>
              )}
            </div>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Guest: <span className="text-slate-900">{folio.guestName || 'Unknown'}</span>
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* ─── Body (Split Layout) ─── */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* LEFT PANEL: Payments + Charge Ledger */}
          <div className="flex-1 overflow-y-auto p-6">

            {/* ── Payments ── */}
            <div className="mb-8">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-400">Payments</h3>
              {payments.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400 shadow-sm">
                  No payments recorded yet.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Ref #</th>
                        <th className="px-4 py-2.5">Method</th>
                        <th className="px-4 py-2.5">Notes</th>
                        <th className="px-4 py-2.5 text-right">Amount</th>
                        {!readOnly && <th className="px-4 py-2.5 text-center">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map(p => {
                        const isEditing = editingPaymentId === p.id;
                        const isProcessing = paymentProcessingId === p.id;
                        if (isEditing) {
                          return (
                            <tr key={p.id} className="bg-emerald-50/60">
                              <td className="px-4 py-3 text-xs text-slate-500">{fmtDateTime(p.paymentDate)}</td>
                              <td className="px-4 py-3 text-xs text-slate-500">{p.paymentNumber}</td>
                              <td className="px-4 py-3 text-xs text-slate-500">{p.paymentMethod?.replace(/_/g, ' ')}</td>
                              <td className="px-4 py-3">
                                <input
                                  type="text"
                                  value={paymentEditForm.notes}
                                  onChange={e => setPaymentEditForm(f => ({ ...f, notes: e.target.value }))}
                                  className="w-full rounded border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                  placeholder="Notes"
                                />
                              </td>
                              <td className="px-4 py-3 text-right">
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={paymentEditForm.amount}
                                  onChange={e => setPaymentEditForm(f => ({ ...f, amount: e.target.value }))}
                                  className="w-28 rounded border border-slate-200 px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                />
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleSavePaymentEdit(p)}
                                    disabled={isProcessing}
                                    className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 hover:text-emerald-800 disabled:opacity-50"
                                  >
                                    {isProcessing ? 'Saving…' : 'Save'}
                                  </button>
                                  <span className="text-slate-300">|</span>
                                  <button
                                    onClick={() => setEditingPaymentId(null)}
                                    className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                        return (
                          <tr key={p.id} className="transition-colors hover:bg-slate-50">
                            <td className="px-4 py-3 text-xs text-slate-500">{fmtDateTime(p.paymentDate)}</td>
                            <td className="px-4 py-3 text-xs text-slate-500">{p.paymentNumber}</td>
                            <td className="px-4 py-3 text-xs font-medium text-slate-700">{p.paymentMethod?.replace(/_/g, ' ')}</td>
                            <td className="px-4 py-3 text-xs text-slate-500 max-w-[160px] truncate">{p.notes || '—'}</td>
                            <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                              {folio?.currency} {(p.amount ?? 0).toFixed(2)}
                            </td>
                            {!readOnly && (
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => startEditPayment(p)}
                                    className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 hover:text-indigo-700"
                                  >
                                    Edit
                                  </button>
                                  <span className="text-slate-300">|</span>
                                  <button
                                    onClick={() => handleDeletePayment(p)}
                                    disabled={isProcessing}
                                    className="text-[10px] font-bold uppercase tracking-wider text-rose-500 hover:text-rose-700 disabled:opacity-50"
                                  >
                                    {isProcessing ? '…' : 'Delete'}
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="flex justify-end border-t-2 border-slate-200 bg-slate-50 px-4 py-2.5">
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Payments</p>
                      <p className="text-sm font-extrabold text-emerald-700">{folio?.currency} {totalPayments.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-400">Charge Ledger</h3>

            {categorizedCharges.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400 shadow-sm">
                No charges recorded yet.
              </div>
            ) : (
              <div className="space-y-5">
                {categorizedCharges.map(category => {
                  const active = category.charges.filter(c => !c.isVoided);
                  const catSubtotal = active.reduce((s, c) => s + (c.subtotal ?? 0), 0);
                  const catTax     = active.reduce((s, c) => s + (c.taxAmount ?? 0), 0);
                  const catTotal   = active.reduce((s, c) => s + (c.totalAmount ?? 0), 0);

                  return (
                    <div key={category.label} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                      {/* Category header */}
                      <div className="border-b border-slate-200 bg-slate-100 px-4 py-2">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-600">
                          {category.label}
                        </span>
                      </div>

                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          <tr>
                            <th className="px-4 py-2.5">Date</th>
                            <th className="px-4 py-2.5">Description</th>
                            <th className="px-4 py-2.5 text-right">Amount</th>
                            {!readOnly && <th className="px-4 py-2.5 text-center">Action</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {category.charges.map(charge => {
                            const dateStr = fmtDateTime(charge.postingDate ?? charge.chargeDate);
                            const isEditing = editingChargeId === charge.id;

                            if (isEditing) {
                              return (
                                <tr key={charge.id} className="bg-indigo-50/60">
                                  <td className="px-4 py-3 text-xs text-slate-500">{dateStr}</td>
                                  <td className="px-4 py-3 space-y-1.5">
                                    <input
                                      type="text"
                                      value={editForm.description}
                                      onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                      className="w-full rounded border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                      placeholder="Description"
                                    />
                                    <div className="flex gap-2">
                                      <div className="flex-1">
                                        <p className="text-[10px] font-bold uppercase text-slate-400 mb-0.5">Final Price (incl. tax)</p>
                                        <input
                                          type="number"
                                          min="0.01"
                                          step="0.01"
                                          value={editForm.finalPrice}
                                          onChange={e => setEditForm(f => ({ ...f, finalPrice: parseFloat(e.target.value) || 0 }))}
                                          className="w-full rounded border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                        />
                                      </div>
                                      <div className="w-20">
                                        <p className="text-[10px] font-bold uppercase text-slate-400 mb-0.5">Qty</p>
                                        <input
                                          type="number"
                                          min="0.01"
                                          step="0.01"
                                          value={editForm.quantity}
                                          onChange={e => setEditForm(f => ({ ...f, quantity: parseFloat(e.target.value) || 1 }))}
                                          className="w-full rounded border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                        />
                                      </div>
                                      <div className="w-20">
                                        <p className="text-[10px] font-bold uppercase text-slate-400 mb-0.5">Tax %</p>
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={editForm.taxRate}
                                          onChange={e => setEditForm(f => ({ ...f, taxRate: parseFloat(e.target.value) || 0 }))}
                                          className="w-full rounded border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-right font-medium text-slate-900">
                                    {folio.currency} {editForm.finalPrice.toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      <button
                                        onClick={() => handleSaveEdit(charge)}
                                        disabled={isProcessingId === charge.id || !editForm.description.trim()}
                                        className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                                      >
                                        {isProcessingId === charge.id ? 'Saving…' : 'Save'}
                                      </button>
                                      <span className="text-slate-300">|</span>
                                      <button
                                        onClick={() => setEditingChargeId(null)}
                                        className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            }

                            return (
                              <tr key={charge.id} className={`transition-colors hover:bg-slate-50 ${charge.isVoided ? 'opacity-50' : ''}`}>
                                <td className="px-4 py-3 text-xs text-slate-500">{dateStr}</td>
                                <td className="px-4 py-3">
                                  <p className={`font-semibold text-slate-900 ${charge.isVoided ? 'line-through' : ''}`}>
                                    {charge.description || charge.chargeCode}
                                  </p>
                                  {charge.isVoided && charge.voidReason && (
                                    <p className="mt-0.5 text-[10px] text-rose-500">Voided: {charge.voidReason}</p>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-slate-900">
                                  {`${folio.currency} ${charge.isVoided ? '0.00' : (charge.totalAmount ?? 0).toFixed(2)}`}
                                </td>
                                {!readOnly && (
                                  <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      {isChargeEditable(charge) && (
                                        <button
                                          onClick={() => startEditCharge(charge)}
                                          className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 hover:text-indigo-700"
                                        >
                                          Edit
                                        </button>
                                      )}
                                      {isChargeEditable(charge) && !charge.isVoided && folio.status === 'OPEN' && (
                                        <span className="text-slate-300">|</span>
                                      )}
                                      {!charge.isVoided && folio.status === 'OPEN' && (
                                        <button
                                          onClick={() => handleVoidCharge(charge)}
                                          disabled={isProcessingId === charge.id}
                                          className="text-[10px] font-bold uppercase tracking-wider text-rose-500 hover:text-rose-700 disabled:opacity-50"
                                        >
                                          {isProcessingId === charge.id ? 'Processing…' : 'Void'}
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {/* Category totals */}
                      <div className="flex justify-end gap-8 border-t-2 border-slate-200 bg-slate-50 px-4 py-2.5">
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Subtotal</p>
                          <p className="text-sm font-semibold text-slate-700">{folio.currency} {catSubtotal.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tax</p>
                          <p className="text-sm font-semibold text-slate-700">{folio.currency} {catTax.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total</p>
                          <p className="text-sm font-extrabold text-slate-900">{folio.currency} {catTotal.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT PANEL: Summary & Actions */}
          <div className="w-96 shrink-0 border-l border-slate-200 bg-white p-6 overflow-y-auto">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-400">Folio Summary</h3>
            
            <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/50 p-5">
              <div className="flex justify-between text-sm font-medium text-slate-600">
                <span>Subtotal</span>
                <span>{folio.currency} {folio.subtotal?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between text-sm font-medium text-slate-600">
                <span>Taxes</span>
                <span>{folio.currency} {folio.taxAmount?.toFixed(2) || '0.00'}</span>
              </div>
              {folio.roomDiscountAmount != null && (
                <div className="flex items-center justify-between text-sm font-medium text-emerald-600">
                  <span className="flex items-center gap-1">
                    Room Discount
                    {!readOnly && folio.status === 'OPEN' && (
                      <>
                        <button onClick={() => openDiscountForm('room')} className="ml-1 rounded p-0.5 hover:bg-emerald-100" title="Edit"><Pencil className="h-3 w-3" /></button>
                        <button onClick={() => handleDeleteDiscount('room')} className="rounded p-0.5 hover:bg-rose-100 text-rose-400" title="Remove"><Trash2 className="h-3 w-3" /></button>
                      </>
                    )}
                  </span>
                  <span>-{folio.currency} {folio.roomDiscountAmount.toFixed(2)}</span>
                </div>
              )}
              {folio.ancillaryDiscountAmount != null && (
                <div className="flex items-center justify-between text-sm font-medium text-emerald-600">
                  <span className="flex items-center gap-1">
                    Ancillary Discount
                    {!readOnly && folio.status === 'OPEN' && (
                      <>
                        <button onClick={() => openDiscountForm('ancillary')} className="ml-1 rounded p-0.5 hover:bg-emerald-100" title="Edit"><Pencil className="h-3 w-3" /></button>
                        <button onClick={() => handleDeleteDiscount('ancillary')} className="rounded p-0.5 hover:bg-rose-100 text-rose-400" title="Remove"><Trash2 className="h-3 w-3" /></button>
                      </>
                    )}
                  </span>
                  <span>-{folio.currency} {folio.ancillaryDiscountAmount.toFixed(2)}</span>
                </div>
              )}
              {!readOnly && folio.status === 'OPEN' && (
                <div className="flex gap-2">
                  {folio.roomDiscountType == null && (
                    <button
                      onClick={() => openDiscountForm('room')}
                      className="flex-1 rounded-lg border border-dashed border-emerald-300 py-1.5 text-[11px] font-bold text-emerald-600 hover:bg-emerald-50 transition-colors"
                    >
                      + Room Discount
                    </button>
                  )}
                  {folio.ancillaryDiscountType == null && (
                    <button
                      onClick={() => openDiscountForm('ancillary')}
                      className="flex-1 rounded-lg border border-dashed border-emerald-300 py-1.5 text-[11px] font-bold text-emerald-600 hover:bg-emerald-50 transition-colors"
                    >
                      + Ancillary Discount
                    </button>
                  )}
                </div>
              )}
              <div className="my-2 border-t border-slate-200 pt-2"></div>
              <div className="flex justify-between text-base font-bold text-slate-900">
                <span>Total Charges</span>
                <span>{folio.currency} {folio.totalAmount?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between text-sm font-medium text-emerald-600">
                <span>Amount Paid</span>
                <span>-{folio.currency} {folio.paidAmount?.toFixed(2) || '0.00'}</span>
              </div>
              
              <div className={`mt-4 rounded-lg p-4 ${
                (folio.balanceDue || 0) > 0 ? 'bg-rose-50 border border-rose-100 text-rose-900' : 'bg-emerald-50 border border-emerald-100 text-emerald-900'
              }`}>
                <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">Balance Due</p>
                <p className="mt-1 text-3xl font-extrabold tracking-tight">
                  {folio.currency} {Math.max(0, folio.balanceDue || 0).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Quick Actions — charge/payment/routing only for OPEN folios */}
            {!readOnly && folio.status === 'OPEN' && (
              <div className="mt-8 space-y-3">
                <button
                  onClick={() => setShowAddCharge(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50"
                >
                  + Post Manual Charge
                </button>
                <button
                  onClick={() => setShowAddPayment(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  Receive Payment
                </button>

                {folio.travelAgentId && (
                  <button
                    onClick={() => setShowAgentPayment(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-amber-700 focus-visible:ring-2 focus-visible:ring-amber-400"
                  >
                    Assign to Agent
                  </button>
                )}

                <button
                  onClick={() => setShowRouting(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-700 transition-all hover:bg-indigo-100"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  Route Charges
                </button>
              </div>
            )}

            {/* Bill section — shown for both OPEN and CLOSED folios */}
            {!readOnly && (folio.status === 'OPEN' || folio.status === 'CLOSED') && (
              <div className={folio.status === 'OPEN' ? 'mt-0 space-y-3 px-0' : 'mt-8 space-y-3'}>
                {folio.status === 'OPEN' && <div className="my-4 border-t border-slate-100"></div>}

                {bills.filter(b => !b.isVoided).length > 0 ? (
                  <button
                    onClick={() => setShowBillView(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 transition-all hover:bg-emerald-100"
                  >
                    <FileText className="h-4 w-4" />
                    View Bill
                  </button>
                ) : showBillOptions ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Generate Bill</p>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Guest GST Number <span className="font-normal text-slate-400">(optional)</span></label>
                      <input
                        type="text"
                        value={billOptGstNumber}
                        onChange={e => setBillOptGstNumber(e.target.value)}
                        placeholder="e.g. 32AADCJ3244K1ZQ"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-600 mb-1.5">Ancillary Billing</p>
                      <div className="flex gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="ancillaryMode"
                            checked={!billOptSplitAncillary}
                            onChange={() => setBillOptSplitAncillary(false)}
                            className="accent-indigo-600"
                          />
                          <span className="text-xs text-slate-700">Consolidated <span className="text-slate-400">(one Ancillary bill)</span></span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="ancillaryMode"
                            checked={billOptSplitAncillary}
                            onChange={() => setBillOptSplitAncillary(true)}
                            className="accent-indigo-600"
                          />
                          <span className="text-xs text-slate-700">Split <span className="text-slate-400">(per category)</span></span>
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleGenerateInvoice}
                        disabled={isGeneratingBill}
                        className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {isGeneratingBill ? 'Generating...' : 'Confirm & Generate'}
                      </button>
                      <button
                        onClick={() => setShowBillOptions(false)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowBillOptions(true)}
                    disabled={isGeneratingBill}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Printer className="h-4 w-4 text-slate-400" />
                    {isGeneratingBill ? 'Generating...' : 'Generate Bill'}
                  </button>
                )}
              </div>
            )}

            {/* Generated Bills */}
            {bills.length > 0 && (
              <div className="mt-8">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-400">Generated Bills</h3>
                <div className="space-y-2">
                  {bills.map(bill => (
                    <div key={bill.id} className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${bill.isVoided ? 'border-slate-100 bg-slate-50 opacity-60' : 'border-slate-200 bg-white'}`}>
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          {bill.invoiceNumber}
                          {bill.isVoided && <span className="ml-2 text-[10px] font-bold uppercase text-rose-500">Voided</span>}
                        </p>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                          {bill.category === 'ROOM_RENT' ? 'Main' : bill.category === 'ANCILLARY' ? 'Ancillary' : (bill.category ?? 'Bill')}
                        </p>
                      </div>
                      {!bill.isVoided && (
                        <button
                          onClick={() => handleDownloadBill(bill)}
                          disabled={downloadingBillId === bill.id}
                          className="rounded-md bg-indigo-50 px-2.5 py-1.5 text-[11px] font-bold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-50"
                        >
                          {downloadingBillId === bill.id ? '...' : 'Download'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actual Modals */}
      {showAddCharge && (
        <ModalShell title="Post Charge" onClose={() => setShowAddCharge(false)}>
           <ChargeForm 
             propertyId={propertyId} 
             folioId={folioId} 
             onSuccess={() => { setShowAddCharge(false); loadFolio(); }} 
             onCancel={() => setShowAddCharge(false)} 
           />
        </ModalShell>
      )}
      {showAddPayment && (
        <ModalShell title="Receive Payment" onClose={() => setShowAddPayment(false)}>
           <PaymentForm
             propertyId={propertyId}
             folioId={folioId}
             balanceDue={folio.balanceDue}
             onSuccess={() => { setShowAddPayment(false); loadFolio(); loadPayments(); }}
             onCancel={() => setShowAddPayment(false)}
           />
        </ModalShell>
      )}
      {showAgentPayment && folio.travelAgentId && folio.travelAgentName && (
        <ModalShell title="Assign Balance to Agent" onClose={() => setShowAgentPayment(false)}>
          <AgentPaymentForm
            propertyId={propertyId}
            folioId={folioId}
            travelAgentId={folio.travelAgentId}
            travelAgentName={folio.travelAgentName}
            balanceDue={folio.balanceDue}
            onSuccess={() => { setShowAgentPayment(false); loadFolio(); }}
            onCancel={() => setShowAgentPayment(false)}
          />
        </ModalShell>
      )}
      {showRouting && (
        <ModalShell title="Route Charges" onClose={() => setShowRouting(false)}>
           <FolioRoutingForm
             propertyId={propertyId}
             folioId={folioId}
             charges={folio.charges || []}
             currency={folio.currency || 'INR'}
             onSuccess={() => { setShowRouting(false); loadFolio(); }}
             onCancel={() => setShowRouting(false)}
           />
        </ModalShell>
      )}
      {showBillView && (
        <BillViewModal
          folio={folio}
          bills={bills.filter(b => !b.isVoided)}
          onClose={() => setShowBillView(false)}
          onBillsChanged={loadBills}
        />
      )}

      {showDiscountForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {discountTarget === 'room' ? 'Room Bill' : 'Ancillary Bill'} Discount
              </h3>
              <button onClick={() => setShowDiscountForm(false)} className="rounded-lg p-1.5 hover:bg-slate-100">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDiscountType('PERCENTAGE')}
                    className={`flex-1 rounded-lg border py-2 text-sm font-bold transition-colors ${discountType === 'PERCENTAGE' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    % Percentage
                  </button>
                  <button
                    onClick={() => setDiscountType('FLAT')}
                    className={`flex-1 rounded-lg border py-2 text-sm font-bold transition-colors ${discountType === 'FLAT' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    ₹ Flat Amount
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {discountType === 'PERCENTAGE' ? 'Percentage (%)' : 'Amount (₹)'}
                </label>
                <input
                  type="number"
                  min="0"
                  max={discountType === 'PERCENTAGE' ? 100 : undefined}
                  step="0.01"
                  value={discountValue}
                  onChange={e => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'PERCENTAGE' ? 'e.g. 10' : 'e.g. 500'}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  autoFocus
                />
                {discountPreviewAmount != null && (
                  <p className="mt-1.5 text-xs font-medium text-emerald-600">
                    = {folio.currency} {discountPreviewAmount.toFixed(2)} off
                    {' '}({discountTarget === 'room' ? 'Room' : 'Ancillary'} bill total: {folio.currency} {(discountTarget === 'room' ? roomChargesTotal : ancillaryChargesTotal).toFixed(2)})
                  </p>
                )}
              </div>

              {discountError && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{discountError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowDiscountForm(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDiscount}
                  disabled={discountSubmitting}
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {discountSubmitting ? 'Saving...' : 'Apply Discount'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}