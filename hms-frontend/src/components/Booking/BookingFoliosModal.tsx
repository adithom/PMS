import { useState, useEffect } from 'react';
import folioApi from '../../api/folioApi';
import type { FolioDto } from '../../api/folioApi';
import FolioDetailModal from '../Billing/FolioDetailModal';
import ModalShell from '../ModalShell';
import LoadingSpinner from '../LoadingSpinner';

interface BookingFoliosModalProps {
  propertyId: string;
  bookingId: string;
  guestName: string;
  onClose: () => void;
}

export default function BookingFoliosModal({ propertyId, bookingId, guestName, onClose }: BookingFoliosModalProps) {
  const [folios, setFolios] = useState<FolioDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolioId, setSelectedFolioId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await folioApi.getAllFoliosByBooking(propertyId, bookingId);
        setFolios(data || []);
        if (data?.length === 1) setSelectedFolioId(data[0].id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load folios.');
      } finally {
        setLoading(false);
      }
    })();
  }, [propertyId, bookingId]);

  // Drill-down into a specific folio
  if (selectedFolioId) {
    return (
      <FolioDetailModal
        propertyId={propertyId}
        folioId={selectedFolioId}
        onClose={folios.length === 1 ? onClose : () => setSelectedFolioId(null)}
        readOnly
      />
    );
  }

  if (loading) {
    return (
      <ModalShell title="Loading Folios…" onClose={onClose}>
        <div className="flex h-40 items-center justify-center">
          <LoadingSpinner text="Retrieving folio records…" />
        </div>
      </ModalShell>
    );
  }

  if (error) {
    return (
      <ModalShell title="Error" onClose={onClose}>
        <div className="rounded-lg bg-rose-50 p-4 text-rose-800">{error}</div>
      </ModalShell>
    );
  }

  if (folios.length === 0) {
    return (
      <ModalShell title="Folios" onClose={onClose}>
        <div className="rounded-lg bg-slate-50 p-6 text-center text-slate-500">
          No folio found for this booking.
        </div>
      </ModalShell>
    );
  }

  // Multiple folios — show selection list
  return (
    <ModalShell title={`Folios — ${guestName}`} onClose={onClose}>
      <div className="space-y-2 p-1">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
          {folios.length} folio{folios.length > 1 ? 's' : ''} — select to view
        </p>
        {folios.map(folio => (
          <button
            key={folio.id}
            onClick={() => setSelectedFolioId(folio.id)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-slate-900">
                Folio #{folio.folioNumber || folio.id.slice(0, 8)}
              </span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                folio.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700'
                : folio.status === 'CLOSED' ? 'bg-slate-200 text-slate-700'
                : 'bg-blue-100 text-blue-700'
              }`}>
                {folio.status}
              </span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                {folio.folioType}
              </span>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Balance Due</p>
              <p className={`text-sm font-bold ${(folio.balanceDue || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {folio.currency} {Math.max(0, folio.balanceDue || 0).toFixed(2)}
              </p>
            </div>
          </button>
        ))}
      </div>
    </ModalShell>
  );
}
