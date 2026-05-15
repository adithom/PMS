import { useEffect, useState } from 'react';
import ModalShell from '../ModalShell';
import guestApi from '../../api/guestApi';
import type { GuestProfile, GuestBookingSummary, GuestPosPreference } from '../../types';
import { GUEST_ID_TYPE_LABELS } from '../../types';
import { fmtDate, diffDays } from '../../utils/dateHelpers';

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
  CHECKED_IN: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  CHECKED_OUT: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  CANCELLED: 'bg-rose-100 text-rose-800 border-rose-200',
  NO_SHOW: 'bg-red-100 text-red-800 border-red-200',
};

interface Props {
  guestId: string;
  onClose: () => void;
}

type Tab = 'profile' | 'stays' | 'pos';

export default function GuestDetailModal({ guestId, onClose }: Props) {
  const [profile, setProfile] = useState<GuestProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('profile');

  useEffect(() => {
    setLoading(true);
    setError(null);
    guestApi.getProfile(guestId)
      .then(setProfile)
      .catch(() => setError('Failed to load guest profile.'))
      .finally(() => setLoading(false));
  }, [guestId]);

  const guest = profile?.guest;

  return (
    <ModalShell
      title={guest ? guest.fullName : 'Guest Profile'}
      subtitle={guest?.email ?? guest?.phone ?? undefined}
      onClose={onClose}
      size="wide"
    >
      {loading ? (
        <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
      ) : error ? (
        <p className="py-8 text-center text-sm text-rose-500">{error}</p>
      ) : profile ? (
        <div className="flex flex-col gap-4">
          {/* Tabs */}
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {(['profile', 'stays', 'pos'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-all ${
                  tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t === 'profile' && 'Profile'}
                {t === 'stays' && `Stays (${profile.bookingHistory.length})`}
                {t === 'pos' && 'Preferences'}
              </button>
            ))}
          </div>

          {/* Profile tab */}
          {tab === 'profile' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Contact</p>
                {guest!.email && <InfoRow label="Email" value={guest!.email} />}
                {guest!.phone && <InfoRow label="Phone" value={guest!.phone} />}
                {!guest!.email && !guest!.phone && (
                  <p className="text-xs italic text-slate-400">No contact details.</p>
                )}
              </div>
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Identity</p>
                {guest!.dateOfBirth && <InfoRow label="DOB" value={fmtDate(guest!.dateOfBirth)} />}
                {guest!.idNumber && <InfoRow label="Doc ID" value={guest!.idNumber} mono />}
                {guest!.guestIdType && (
                  <InfoRow label="ID Type" value={GUEST_ID_TYPE_LABELS[guest!.guestIdType]} />
                )}
                {!guest!.dateOfBirth && !guest!.idNumber && (
                  <p className="text-xs italic text-slate-400">No identity details.</p>
                )}
              </div>
              {guest!.preferences && (
                <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Preferences</p>
                  <p className="text-sm text-slate-700">{guest!.preferences}</p>
                </div>
              )}
            </div>
          )}

          {/* Stays tab */}
          {tab === 'stays' && (
            <StayHistory bookings={profile.bookingHistory} />
          )}

          {/* POS preferences tab */}
          {tab === 'pos' && (
            <PosPreferences items={profile.posPreferences} />
          )}
        </div>
      ) : null}
    </ModalShell>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="w-14 shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <span className={mono ? 'font-mono text-slate-700' : 'text-slate-700'}>{value}</span>
    </div>
  );
}

function StayHistory({ bookings }: { bookings: GuestBookingSummary[] }) {
  if (bookings.length === 0) {
    return <p className="py-6 text-center text-sm italic text-slate-400">No booking history.</p>;
  }
  return (
    <div className="space-y-2">
      {bookings.map((b) => (
        <div key={b.bookingId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-800">
                  {b.roomNumber ? `Room ${b.roomNumber}` : b.unitName ?? 'Unassigned'}
                </span>
                {b.groupReference && (
                  <span className="font-mono text-[10px] text-slate-400">{b.groupReference}</span>
                )}
                {b.role === 'ADDITIONAL' && (
                  <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                    Additional Guest
                  </span>
                )}
              </div>
              {b.propertyName && (
                <p className="mt-0.5 text-[11px] font-medium text-slate-500">{b.propertyName}</p>
              )}
              <p className="mt-0.5 text-xs text-slate-500">
                {fmtDate(b.checkIn)} → {fmtDate(b.checkOut)}
                <span className="ml-1 text-slate-400">({diffDays(b.checkIn, b.checkOut)} Nights)</span>
              </p>
              {b.mealPlanType && (
                <p className="mt-0.5 text-[11px] text-slate-400">{b.mealPlanType}</p>
              )}
            </div>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_BADGE[b.status] ?? 'bg-slate-100 text-slate-600'}`}>
              {b.status.replace('_', ' ')}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PosPreferences({ items }: { items: GuestPosPreference[] }) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm italic text-slate-400">
        No POS orders found for this guest.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Top ordered items across all stays</p>
      {items.map((item, i) => (
        <div key={item.productId} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800">{item.itemName}</p>
            {item.category && <p className="text-[11px] text-slate-400">{item.category}</p>}
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-slate-800">×{item.totalQuantity}</p>
            <p className="text-[10px] text-slate-400">{item.orderCount} orders</p>
          </div>
        </div>
      ))}
    </div>
  );
}
