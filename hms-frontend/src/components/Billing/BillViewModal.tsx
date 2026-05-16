import { useState, useEffect } from 'react';
import ModalShell from '../ModalShell';
import billingApi from '../../api/billingApi';
import type { BillDto } from '../../api/billingApi';
import type { FolioDto } from '../../api/folioApi';
import posApi from '../../api/posApi';
import type { PosTicketHistory } from '../../types/pos';
import { triggerPresignedDownload } from '../../utils/downloadUtils';

interface BillViewModalProps {
  folio: FolioDto;
  bills: BillDto[];
  onClose: () => void;
  onBillsChanged: () => void;
}

const BILL_TYPE_LABELS: Record<string, string> = {
  ROOM_RENT:   'Main',
  ANCILLARY:   'Ancillary',
  RESTAURANT:  'Restaurant',
  SPA:         'Spa',
  LAUNDRY:     'Laundry',
  TRAVEL_DESK: 'Travel Desk',
  SHOP:        'Gift Shop',
  MISC:        'Miscellaneous',
};

function billLabel(bill: BillDto): string {
  return BILL_TYPE_LABELS[bill.category ?? ''] ?? bill.category ?? 'Invoice';
}

export default function BillViewModal({ folio, bills, onClose, onBillsChanged }: BillViewModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [localBills, setLocalBills] = useState<BillDto[]>(bills);
  const [posTickets, setPosTickets] = useState<PosTicketHistory[]>([]);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);

  // Close automatically once all bills are voided
  useEffect(() => {
    if (localBills.length > 0 && localBills.every(b => b.isVoided)) {
      onBillsChanged();
      onClose();
    }
  }, [localBills]);

  // Fetch POS receipts for this booking
  useEffect(() => {
    if (!folio.bookingId) return;
    posApi.getTicketsByBookingId(folio.bookingId)
      .then(setPosTickets)
      .catch(() => {}); // non-critical
  }, [folio.bookingId]);

  const handleDownloadReceipt = async (ticketId: string) => {
    setDownloadingReceiptId(ticketId);
    try {
      const url = await posApi.getReceiptUrl(ticketId);
      triggerPresignedDownload(url);
    } catch (err: any) {
      alert(err.message || 'Failed to get receipt link.');
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  const activeBills = localBills.filter(b => !b.isVoided);

  const handleDownloadAll = async () => {
    setDownloading(true);
    try {
      await Promise.all(
        activeBills.map(async (bill) => {
          const url = await billingApi.getDownloadUrl(bill.id);
          triggerPresignedDownload(url);
        })
      );
    } catch (err: any) {
      alert(err.message || 'Failed to get download link.');
    } finally {
      setDownloading(false);
    }
  };

  const handleVoidAll = async () => {
    const reason = window.prompt('Enter reason for voiding all bills on this folio:');
    if (!reason?.trim()) return;

    setVoiding(true);
    try {
      await billingApi.voidActiveBillsForFolio(folio.id, reason.trim());
      setLocalBills(prev => prev.map(b => ({ ...b, isVoided: true })));
      onBillsChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to void bills.');
    } finally {
      setVoiding(false);
    }
  };

  return (
    <ModalShell
      title={`${folio.guestName ?? 'Guest'}'s Bill`}
      subtitle={`Folio #${folio.folioNumber} · Room ${folio.roomNumber ?? '—'}`}
      onClose={onClose}
    >
      {activeBills.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">All bills for this folio have been voided.</p>
      ) : (
        <>
          <div className="space-y-3">
            {activeBills.map(bill => (
              <div key={bill.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-slate-900">#{bill.invoiceNumber}</p>
                    <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      {billLabel(bill)}
                    </p>
                    {bill.travelAgentName && (
                      <p className="mt-1 text-[11px] font-semibold text-amber-600 uppercase tracking-wider">
                        Billed to Agent: {bill.travelAgentName}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-extrabold text-slate-900">
                      {folio.currency ?? '₹'} {bill.grandTotal?.toFixed(2) ?? '0.00'}
                    </p>
                    {bill.travelAgentName && bill.balanceDue === 0 ? (
                      <p className="text-[11px] font-semibold text-emerald-600">Settled by Agent</p>
                    ) : bill.balanceDue != null && bill.balanceDue > 0 ? (
                      <p className="text-[11px] font-semibold text-rose-600">
                        Balance: {folio.currency ?? '₹'} {bill.balanceDue.toFixed(2)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {posTickets.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">POS Receipts</p>
              <div className="space-y-2">
                {posTickets.map(ticket => (
                  <div key={ticket.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {ticket.invoiceNumber ?? ticket.id.slice(0, 8)}
                      </p>
                      <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {ticket.locationName ?? ticket.mealType ?? 'POS'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-extrabold text-slate-900">
                        {folio.currency ?? '₹'} {ticket.totalAmount.toFixed(2)}
                      </p>
                      <button
                        onClick={() => handleDownloadReceipt(ticket.id)}
                        disabled={downloadingReceiptId === ticket.id}
                        className="rounded-md bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50"
                      >
                        {downloadingReceiptId === ticket.id ? '…' : 'Receipt'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              onClick={handleDownloadAll}
              disabled={downloading || voiding}
              className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-50"
            >
              {downloading ? 'Fetching...' : 'Download'}
            </button>
            <button
              onClick={handleVoidAll}
              disabled={voiding || downloading}
              className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
            >
              {voiding ? 'Voiding...' : 'Void Bills'}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
