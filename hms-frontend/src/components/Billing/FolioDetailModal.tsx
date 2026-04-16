import { useState, useEffect, useMemo } from 'react';
import folioApi from '../../api/folioApi';
import type { FolioDetailDto, ChargeDto } from '../../api/folioApi';
import type { PaymentDto } from '../../api/paymentApi';
import billingApi from '../../api/billingApi';
import type { BillDto } from '../../api/billingApi';
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

// Unified ledger item for the timeline
type LedgerItem = 
  | { type: 'CHARGE'; date: Date; amount: number; description: string; code: string; isVoided: boolean; raw: ChargeDto }
  | { type: 'PAYMENT'; date: Date; amount: number; description: string; code: string; isVoided: boolean; raw: PaymentDto };

export default function FolioDetailModal({ propertyId, folioId, onClose, readOnly = false }: FolioDetailModalProps) {
  const [folio, setFolio] = useState<FolioDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bills
  const [bills, setBills] = useState<BillDto[]>([]);
  const [downloadingBillId, setDownloadingBillId] = useState<string | null>(null);
  const [isGeneratingBill, setIsGeneratingBill] = useState(false);

  // Action states
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);

  // Sub-modal states
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showAgentPayment, setShowAgentPayment] = useState(false);
  const [showRouting, setShowRouting] = useState(false);
  const [showBillView, setShowBillView] = useState(false);

  useEffect(() => {
    loadFolio();
    loadBills();
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

  const handleGenerateInvoice = async () => {
    const gstNumber = window.prompt('Enter guest GST number (optional, leave blank to skip):') ?? '';
    setIsGeneratingBill(true);
    try {
      const result = await billingApi.generateBills(folioId, gstNumber || undefined);
      if (result.roomRentBill?.pdfDownloadUrl) {
        triggerPresignedDownload(result.roomRentBill.pdfDownloadUrl);
      }
      if (result.ancillaryBill?.pdfDownloadUrl) {
        setTimeout(() => triggerPresignedDownload(result.ancillaryBill!.pdfDownloadUrl!), 300);
      }
      if (!result.roomRentBill?.pdfDownloadUrl && !result.ancillaryBill?.pdfDownloadUrl) {
        alert('Bill generated but PDF upload unavailable. Contact admin.');
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

  const handleVoidOrRefund = async (item: LedgerItem) => {
    if (item.type === 'CHARGE') {
      const reason = window.prompt('Please enter a reason for voiding this charge:');
      if (!reason) return; // Exit if the user cancels the prompt

      setIsProcessingId(item.raw.id);
      try {
        await folioApi.voidCharge(propertyId, folioId, item.raw.id, reason);
        await loadFolio(); // Refresh data to update balances and the grid
      } catch (err: any) {
        alert(err.message || 'Failed to void charge.');
      } finally {
        setIsProcessingId(null);
      }
    } else {
      alert('Payment refund flow is handled in the Payment Gateway dashboard.');
    }
  };

  // Merge and sort charges & payments into a single chronological ledger
  const ledgerItems = useMemo(() => {
    if (!folio) return [];

    const items: LedgerItem[] = [];

    folio.charges?.forEach(c => {
      items.push({
        type: 'CHARGE',
        date: new Date(c.postingDate || c.chargeDate),
        amount: c.totalAmount || 0,
        description: c.description || c.chargeCode,
        code: c.chargeCode,
        isVoided: !!c.isVoided,
        raw: c
      });
    });

    folio.payments?.forEach(p => {
      items.push({
        type: 'PAYMENT',
        date: new Date(p.paymentDate || p.createdAt || new Date()),
        amount: p.amount || 0,
        description: `Payment - ${p.paymentMethod} ${p.cardLastFour ? `(*${p.cardLastFour})` : ''}`,
        code: p.paymentMethod || 'PAYMENT',
        isVoided: p.paymentStatus === 'CANCELLED' || p.paymentStatus === 'REFUNDED',
        raw: p
      });
    });

    // Sort chronologically
    return items.sort((a, b) => a.date.getTime() - b.date.getTime());
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

  let runningBalance = 0;

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
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ─── Body (Split Layout) ─── */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* LEFT PANEL: The Ledger */}
          <div className="flex-1 overflow-y-auto p-6">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-400">Transaction Ledger</h3>
            
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4">Description</th>
                    <th className="p-4 text-right">Charge</th>
                    <th className="p-4 text-right">Credit</th>
                    <th className="p-4 text-right">Balance</th>
                    {!readOnly && <th className="p-4 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledgerItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">No transactions recorded yet.</td>
                    </tr>
                  ) : (
                    ledgerItems.map((item, idx) => {
                      // Math logic: Charges increase balance, Payments decrease it.
                      if (!item.isVoided) {
                        runningBalance += item.type === 'CHARGE' ? item.amount : -item.amount;
                      }

                      return (
                        <tr key={idx} className={`transition-colors hover:bg-slate-50 ${item.isVoided ? 'opacity-50 line-through' : ''}`}>
                          <td className="p-4 text-slate-600">
                            {item.date.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }).replace(/\//g, '-') + ' ' + item.date.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-4">
                            <p className="font-semibold text-slate-900">{item.description}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.code.replace('_', ' ')}</p>
                          </td>
                          <td className="p-4 text-right font-medium text-slate-900">
                            {item.type === 'CHARGE' ? `${folio.currency} ${item.amount.toFixed(2)}` : '—'}
                          </td>
                          <td className="p-4 text-right font-medium text-emerald-600">
                            {item.type === 'PAYMENT' ? `${folio.currency} ${item.amount.toFixed(2)}` : '—'}
                          </td>
                          <td className="p-4 text-right font-bold text-slate-900">
                            {item.isVoided ? '—' : `${folio.currency} ${runningBalance.toFixed(2)}`}
                          </td>
                          {!readOnly && (
                            <td className="p-4 text-center">
                              {!item.isVoided && folio.status === 'OPEN' && (
                                <button
                                  onClick={() => handleVoidOrRefund(item)}
                                  disabled={isProcessingId === item.raw.id}
                                  className="text-[10px] font-bold uppercase tracking-wider text-rose-500 hover:text-rose-700 disabled:opacity-50"
                                >
                                  {isProcessingId === item.raw.id ? 'Processing...' : (item.type === 'CHARGE' ? 'Void' : 'Refund')}
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
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
              {folio.discountAmount ? (
                <div className="flex justify-between text-sm font-medium text-emerald-600">
                  <span>Discounts</span>
                  <span>-{folio.currency} {folio.discountAmount.toFixed(2)}</span>
                </div>
              ) : null}
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
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
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
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    View Bill
                  </button>
                ) : (
                  <button
                    onClick={handleGenerateInvoice}
                    disabled={isGeneratingBill}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50"
                  >
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
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
                          {bill.charges?.[0]?.chargeCode === 'ROOM_RENT' ? 'Room Rent' : 'Ancillary'}
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
             onSuccess={() => { setShowAddPayment(false); loadFolio(); }}
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
    </div>
  );
}