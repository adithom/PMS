import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Printer } from 'lucide-react';
import billingApi from '../../api/billingApi';
import type { GroupBillDto, GroupBill } from '../../api/billingApi';
import paymentApi from '../../api/paymentApi';
import type { PaymentDto } from '../../api/paymentApi';
import { fmtDate, fmtDateTime } from '../../utils/dateHelpers';
import { triggerPresignedDownload } from '../../utils/downloadUtils';
import LoadingSpinner from '../LoadingSpinner';
import ModalShell from '../ModalShell';
import PaymentForm from './PaymentForm';
import FolioDetailModal from './FolioDetailModal';

const CHARGE_CATEGORIES = [
  { codes: ['ROOM_RENT', 'MEAL_PLAN'], label: 'Room & Meal Plan' },
  { codes: ['RESTAURANT'],             label: 'Restaurant' },
  { codes: ['SPA'],                    label: 'Spa' },
  { codes: ['LAUNDRY'],                label: 'Laundry' },
  { codes: ['TRAVEL_DESK'],            label: 'Travel Desk' },
  { codes: ['SHOP'],                   label: 'Gift Shop' },
  { codes: ['MISC'],                   label: 'Miscellaneous' },
];

interface MasterFolioModalProps {
  propertyId: string;
  reservationId: string;
  onClose: () => void;
}

export default function MasterFolioModal({ propertyId, reservationId, onClose }: MasterFolioModalProps) {
  const [data, setData] = useState<GroupBillDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [isGeneratingBill, setIsGeneratingBill] = useState(false);
  const [manageFolioId, setManageFolioId] = useState<string | null>(null);
  const [groupBills, setGroupBills] = useState<GroupBill[]>([]);
  const [downloadingBillId, setDownloadingBillId] = useState<string | null>(null);
  const [voidingBillId, setVoidingBillId] = useState<string | null>(null);

  // Payments
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentEditForm, setPaymentEditForm] = useState<{ amount: string; notes: string }>({ amount: '', notes: '' });
  const [paymentProcessingId, setPaymentProcessingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const view = await billingApi.getGroupBillView(propertyId, reservationId);
      setData(view);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load master folio.');
    } finally {
      setLoading(false);
    }
  }, [propertyId, reservationId]);

  const loadGroupBills = useCallback(async () => {
    try {
      const bills = await billingApi.getGroupBills(propertyId, reservationId);
      setGroupBills(bills || []);
    } catch {
      // Non-critical — bills section just stays empty (e.g. role lacks permission)
    }
  }, [propertyId, reservationId]);

  const loadPayments = useCallback(async () => {
    try {
      const data = await paymentApi.getAllPaymentsForReservation(propertyId, reservationId);
      setPayments(data || []);
    } catch {
      // non-critical
    }
  }, [propertyId, reservationId]);

  useEffect(() => { load(); loadGroupBills(); loadPayments(); }, [load, loadGroupBills, loadPayments]);

  const handleGenerateGroupBill = async () => {
    setIsGeneratingBill(true);
    try {
      const result = await billingApi.generateGroupBills(propertyId, reservationId);
      const withUrl = (result.bills || []).filter((b: any) => b.pdfDownloadUrl);
      if (withUrl.length === 0) {
        alert('Bill generated but PDF upload unavailable. Contact admin.');
      } else {
        withUrl.forEach((bill: any, i: number) => {
          setTimeout(() => triggerPresignedDownload(bill.pdfDownloadUrl!), i * 300);
        });
      }
      await load();
      await loadGroupBills();
    } catch (err: any) {
      alert(err.message || 'Failed to generate group bill.');
    } finally {
      setIsGeneratingBill(false);
    }
  };

  const handleDownloadGroupBill = async (bill: GroupBill) => {
    setDownloadingBillId(bill.id);
    try {
      const url = await billingApi.getGroupBillDownloadUrl(propertyId, reservationId, bill.id);
      triggerPresignedDownload(url);
    } catch (err: any) {
      alert(err.message || 'Failed to get download link.');
    } finally {
      setDownloadingBillId(null);
    }
  };

  const handleVoidGroupBill = async (bill: GroupBill) => {
    const reason = window.prompt(`Enter reason for voiding group bill ${bill.invoiceNumber}:`);
    if (!reason?.trim()) return;

    setVoidingBillId(bill.id);
    try {
      await billingApi.voidGroupBill(propertyId, reservationId, bill.id, reason.trim());
      await loadGroupBills();
      await load();
    } catch (err: any) {
      alert(err.message || 'Failed to void group bill.');
    } finally {
      setVoidingBillId(null);
    }
  };

  const guestNameForPayment = (p: PaymentDto): string => {
    if (p.reservationId && !p.bookingId) return 'Master';
    const room = data?.rooms.find(r => r.bookingId === p.bookingId);
    return room?.guestName ?? 'Guest';
  };

  const totalPayments = useMemo(
    () => payments.reduce((s, p) => s + (p.amount ?? 0), 0),
    [payments]
  );

  const startEditPayment = (p: PaymentDto) => {
    setEditingPaymentId(p.id);
    setPaymentEditForm({ amount: String(p.amount ?? ''), notes: p.notes ?? '' });
  };

  const handleSavePaymentEdit = async (p: PaymentDto) => {
    const amt = parseFloat(paymentEditForm.amount);
    if (isNaN(amt) || amt <= 0) return;
    setPaymentProcessingId(p.id);
    try {
      if (p.reservationId && !p.bookingId) {
        await paymentApi.updateReservationPayment(propertyId, reservationId, p.id, {
          amount: amt, notes: paymentEditForm.notes,
        });
      } else {
        const room = data?.rooms.find(r => r.bookingId === p.bookingId);
        if (!room?.folioId) throw new Error('Folio not found for payment');
        await paymentApi.updateFolioPayment(propertyId, room.folioId, p.id, {
          amount: amt, notes: paymentEditForm.notes,
        });
      }
      setEditingPaymentId(null);
      await Promise.all([loadPayments(), load()]);
    } catch (err: any) {
      alert(err.message || 'Failed to update payment.');
    } finally {
      setPaymentProcessingId(null);
    }
  };

  const handleDeletePayment = async (p: PaymentDto) => {
    if (!window.confirm(`Delete payment ${p.paymentNumber ?? p.id} of ${data?.currency} ${p.amount?.toFixed(2)}? This cannot be undone.`)) return;
    setPaymentProcessingId(p.id);
    try {
      if (p.reservationId && !p.bookingId) {
        await paymentApi.deleteReservationPayment(propertyId, reservationId, p.id);
      } else {
        const room = data?.rooms.find(r => r.bookingId === p.bookingId);
        if (!room?.folioId) throw new Error('Folio not found for payment');
        await paymentApi.deleteFolioPayment(propertyId, room.folioId, p.id);
      }
      await Promise.all([loadPayments(), load()]);
    } catch (err: any) {
      alert(err.message || 'Failed to delete payment.');
    } finally {
      setPaymentProcessingId(null);
    }
  };

  if (loading) {
    return (
      <ModalShell title="Loading Master Folio…" onClose={onClose}>
        <div className="flex h-40 items-center justify-center">
          <LoadingSpinner text="Aggregating reservation charges…" />
        </div>
      </ModalShell>
    );
  }

  if (error || !data) {
    return (
      <ModalShell title="Error" onClose={onClose}>
        <div className="rounded-lg bg-rose-50 p-4 text-rose-800">{error || 'Master folio unavailable.'}</div>
      </ModalShell>
    );
  }

  if (manageFolioId) {
    return (
      <FolioDetailModal
        propertyId={propertyId}
        folioId={manageFolioId}
        onClose={() => { setManageFolioId(null); load(); }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm sm:p-6 lg:p-8">
      <div className="flex h-full w-full max-w-[1600px] flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-extrabold text-slate-900">Master Folio</h2>
              <span className="rounded-md bg-indigo-100 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-700">
                {data.billingMode}
              </span>
              {data.groupReference && (
                <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                  ⚑ {data.groupReference}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Organizer: <span className="text-slate-900">{data.organizerGuestName}</span>
              {' · '}{fmtDate(data.checkIn)} → {fmtDate(data.checkOut)}
              {' · '}{data.rooms.length} room{data.rooms.length > 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT: payments + per-room sections */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* ── Payments ── */}
            <div>
              <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-400">Payments</h3>
              {payments.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400 shadow-sm">
                  No payments recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Ref #</th>
                        <th className="px-4 py-2.5">Guest</th>
                        <th className="px-4 py-2.5">Method</th>
                        <th className="px-4 py-2.5">Notes</th>
                        <th className="px-4 py-2.5 text-right">Amount</th>
                        <th className="px-4 py-2.5 text-center">Action</th>
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
                              <td className="px-4 py-3 text-xs font-medium text-slate-700">{guestNameForPayment(p)}</td>
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
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                p.reservationId && !p.bookingId ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {guestNameForPayment(p)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs font-medium text-slate-700">{p.paymentMethod?.replace(/_/g, ' ')}</td>
                            <td className="px-4 py-3 text-xs text-slate-500 max-w-[140px] truncate">{p.notes || '—'}</td>
                            <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                              {data.currency} {(p.amount ?? 0).toFixed(2)}
                            </td>
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
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="flex justify-end border-t-2 border-slate-200 bg-slate-50 px-4 py-2.5">
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Payments</p>
                      <p className="text-sm font-extrabold text-emerald-700">{data.currency} {totalPayments.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {data.rooms.map(room => {
              const categorized = CHARGE_CATEGORIES
                .map(cat => ({
                  ...cat,
                  charges: room.charges.filter(c => cat.codes.includes(c.chargeCode)),
                }))
                .filter(cat => cat.charges.length > 0);

              return (
                <div key={room.bookingId} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {room.guestName || 'Guest'}
                        {room.roomNumber && <span className="ml-2 text-slate-400">Room {room.roomNumber}</span>}
                      </p>
                      {room.folioNumber && (
                        <p className="text-[11px] font-medium text-slate-400">Folio #{room.folioNumber}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-widest text-slate-400">Balance Due</p>
                        <p className={`text-sm font-bold ${room.balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {data.currency} {room.balanceDue.toFixed(2)}
                        </p>
                      </div>
                      {room.folioId && (
                        <button
                          onClick={() => setManageFolioId(room.folioId!)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          Manage Folio →
                        </button>
                      )}
                    </div>
                  </div>

                  {categorized.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-400">No charges recorded.</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {categorized.map(cat => (
                        <div key={cat.label}>
                          <div className="bg-slate-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            {cat.label}
                          </div>
                          <table className="w-full text-sm">
                            <tbody>
                              {cat.charges.map(charge => (
                                <tr key={charge.id} className="border-b border-slate-50 last:border-b-0">
                                  <td className="px-4 py-2 text-xs text-slate-500 w-32">
                                    {fmtDate(charge.postingDate ?? charge.chargeDate)}
                                  </td>
                                  <td className={`px-4 py-2 text-slate-700 ${charge.isVoided ? 'line-through opacity-50' : ''}`}>
                                    {charge.description || charge.chargeCode}
                                  </td>
                                  <td className="px-4 py-2 text-right font-semibold text-slate-900 w-32">
                                    {data.currency} {charge.isVoided ? '0.00' : (charge.totalAmount ?? 0).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* RIGHT: group totals & actions */}
          <div className="w-96 shrink-0 border-l border-slate-200 bg-white p-6 overflow-y-auto">
            <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/50 p-5">
              <div className="flex justify-between text-sm font-medium text-slate-600">
                <span>Subtotal</span>
                <span>{data.currency} {data.groupSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium text-slate-600">
                <span>Taxes</span>
                <span>{data.currency} {data.groupTaxAmount.toFixed(2)}</span>
              </div>
              {data.groupDiscountAmount > 0 && (
                <div className="flex justify-between text-sm font-medium text-emerald-600">
                  <span>Discounts</span>
                  <span>-{data.currency} {data.groupDiscountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="my-2 border-t border-slate-200 pt-2"></div>
              <div className="flex justify-between text-base font-bold text-slate-900">
                <span>Total Charges</span>
                <span>{data.currency} {data.groupTotalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium text-emerald-600">
                <span>Amount Paid</span>
                <span>-{data.currency} {data.groupPaidAmount.toFixed(2)}</span>
              </div>

              <div className={`mt-4 rounded-lg p-4 ${
                data.groupBalanceDue > 0 ? 'bg-rose-50 border border-rose-100 text-rose-900' : 'bg-emerald-50 border border-emerald-100 text-emerald-900'
              }`}>
                <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">Cumulative Balance Due</p>
                <p className="mt-1 text-3xl font-extrabold tracking-tight">
                  {data.currency} {data.groupBalanceDue.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <button
                onClick={() => setShowPayment(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                Receive Payment
              </button>

              <button
                onClick={handleGenerateGroupBill}
                disabled={isGeneratingBill}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50"
              >
                <Printer className="h-4 w-4 text-slate-400" />
                {isGeneratingBill ? 'Generating...' : 'Generate Group Bill'}
              </button>
            </div>

            {groupBills.filter(b => !b.voided).length > 0 && (
              <div className="mt-8">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-400">Generated Group Bills</h3>
                <div className="space-y-2">
                  {groupBills.filter(b => !b.voided).map(bill => (
                    <div key={bill.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{bill.invoiceNumber}</p>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                          {bill.billType === 'ROOM_RENT' ? 'Main' : bill.billType === 'ANCILLARY' ? 'Ancillary' : (bill.billType ?? 'Bill')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDownloadGroupBill(bill)}
                          disabled={downloadingBillId === bill.id}
                          className="rounded-md bg-indigo-50 px-2.5 py-1.5 text-[11px] font-bold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-50"
                        >
                          {downloadingBillId === bill.id ? '...' : 'Download'}
                        </button>
                        <button
                          onClick={() => handleVoidGroupBill(bill)}
                          disabled={voidingBillId === bill.id}
                          className="rounded-md bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
                        >
                          {voidingBillId === bill.id ? 'Voiding...' : 'Void'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPayment && (
        <ModalShell title="Receive Payment" onClose={() => setShowPayment(false)}>
          <PaymentForm
            propertyId={propertyId}
            reservationId={reservationId}
            balanceDue={data.groupBalanceDue}
            onSuccess={() => { setShowPayment(false); load(); loadPayments(); }}
            onCancel={() => setShowPayment(false)}
          />
        </ModalShell>
      )}
    </div>
  );
}
