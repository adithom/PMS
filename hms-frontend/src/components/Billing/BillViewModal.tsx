import { useState, useEffect } from 'react';
import ModalShell from '../ModalShell';
import billingApi from '../../api/billingApi';
import type { BillDto } from '../../api/billingApi';
import type { FolioDto } from '../../api/folioApi';
import { triggerPresignedDownload } from '../../utils/downloadUtils';

interface BillViewModalProps {
  folio: FolioDto;
  bills: BillDto[];
  onClose: () => void;
  onBillsChanged: () => void;
}

const BILL_TYPE_LABELS: Record<string, string> = {
  ROOM_RENT:   'Room & Meal Plan',
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

  // Close automatically once all bills are voided
  useEffect(() => {
    if (localBills.length > 0 && localBills.every(b => b.isVoided)) {
      onBillsChanged();
      onClose();
    }
  }, [localBills]);

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
