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

export default function BillViewModal({ folio, bills, onClose, onBillsChanged }: BillViewModalProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [localBills, setLocalBills] = useState<BillDto[]>(bills);

  // Close automatically once all bills are voided
  useEffect(() => {
    if (localBills.length > 0 && localBills.every(b => b.isVoided)) {
      onBillsChanged();
      onClose();
    }
  }, [localBills]);

  const handleDownload = async (bill: BillDto) => {
    setDownloadingId(bill.id);
    try {
      const url = await billingApi.getDownloadUrl(bill.id);
      triggerPresignedDownload(url);
    } catch (err: any) {
      alert(err.message || 'Failed to get download link.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleVoid = async (bill: BillDto) => {
    const reason = window.prompt(`Enter reason for voiding invoice ${bill.invoiceNumber}:`);
    if (!reason?.trim()) return;

    setVoidingId(bill.id);
    try {
      const updated = await billingApi.voidBill(bill.id, reason.trim());
      setLocalBills(prev => prev.map(b => b.id === bill.id ? { ...b, ...updated, isVoided: true } : b));
      onBillsChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to void invoice.');
    } finally {
      setVoidingId(null);
    }
  };

  const activeBills = localBills.filter(b => !b.isVoided);

  return (
    <ModalShell
      title={`${folio.guestName ?? 'Guest'}'s Invoice`}
      subtitle={`Folio #${folio.folioNumber} · Room ${folio.roomNumber ?? '—'}`}
      onClose={onClose}
    >
      {activeBills.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">All invoices for this folio have been voided.</p>
      ) : (
        <div className="space-y-3">
          {activeBills.map(bill => (
            <div key={bill.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-900">#{bill.invoiceNumber}</p>
                  <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {bill.charges?.[0]
                      ? (bill.charges[0].chargeCode === 'ROOM_RENT' ? 'Room Rent' : 'Ancillary')
                      : 'Invoice'}
                  </p>
                </div>
                <p className="text-lg font-extrabold text-slate-900">
                  {folio.currency ?? '₹'} {bill.grandTotal?.toFixed(2) ?? '0.00'}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={() => handleDownload(bill)}
                  disabled={downloadingId === bill.id}
                  className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-50"
                >
                  {downloadingId === bill.id ? 'Fetching...' : 'Download'}
                </button>
                <button
                  onClick={() => handleVoid(bill)}
                  disabled={voidingId === bill.id}
                  className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
                >
                  {voidingId === bill.id ? 'Voiding...' : 'Void Bill'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}
