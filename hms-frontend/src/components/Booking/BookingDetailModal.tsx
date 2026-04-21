import { useEffect, useState } from 'react';
import ModalShell from '../ModalShell';
import { GUEST_ID_TYPE_LABELS } from '../../types';
import type { Booking, RoomAssignmentDto } from '../../types';
import type { FolioDto } from '../../api/folioApi';
import type { Guest } from '../../types';
import bookingApi from '../../api/bookingApi';
import folioApi from '../../api/folioApi';
import guestApi from '../../api/guestApi';
import { fmtDate, diffDays } from '../../utils/dateHelpers';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
  CHECKED_IN: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  CHECKED_OUT: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  CANCELLED: 'bg-rose-100 text-rose-800 border-rose-200',
  NO_SHOW: 'bg-red-100 text-red-800 border-red-200',
};

const ASSIGNMENT_STATUS_BADGE: Record<string, string> = {
  SCHEDULED: 'bg-amber-100 text-amber-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  COMPLETED: 'bg-slate-100 text-slate-600',
  CANCELLED: 'bg-rose-100 text-rose-700',
};

const FOLIO_TYPE_BADGE: Record<string, string> = {
  MASTER: 'bg-blue-100 text-blue-700',
  GUEST: 'bg-slate-100 text-slate-600',
  GROUP: 'bg-purple-100 text-purple-700',
  WALK_IN: 'bg-amber-100 text-amber-700',
};

interface Props {
  booking: Booking;
  propertyId: string;
  onClose: () => void;
  onEditBooking: (booking: Booking) => void;
  onOpenFolio: (bookingId: string, guestName: string) => void;
}

export default function BookingDetailModal({ booking, propertyId, onClose, onEditBooking, onOpenFolio }: Props) {
  const [guest, setGuest] = useState<Guest | null>(null);
  const [loadingGuest, setLoadingGuest] = useState(true);

  const [assignments, setAssignments] = useState<RoomAssignmentDto[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);

  const [folios, setFolios] = useState<FolioDto[]>([]);
  const [loadingFolios, setLoadingFolios] = useState(true);

  useEffect(() => {
    if (!booking.id) return;

    guestApi.getById(booking.guestId)
      .then(setGuest)
      .catch(() => setGuest(null))
      .finally(() => setLoadingGuest(false));

    bookingApi.getRoomAssignments(propertyId, booking.id)
      .then(setAssignments)
      .catch(() => setAssignments([]))
      .finally(() => setLoadingAssignments(false));

    folioApi.getAllFoliosByBooking(propertyId, booking.id)
      .then(setFolios)
      .catch(() => setFolios([]))
      .finally(() => setLoadingFolios(false));
  }, [booking.id, booking.guestId, propertyId]);

  const nights = diffDays(booking.checkIn.split('T')[0], booking.checkOut.split('T')[0]);

  const totalSubtotal = folios.reduce((s, f) => s + (f.subtotal ?? 0), 0);
  const totalTax = folios.reduce((s, f) => s + (f.taxAmount ?? 0), 0);
  const totalDiscount = folios.reduce((s, f) => s + (f.discountAmount ?? 0), 0);
  const totalCharges = folios.reduce((s, f) => s + (f.totalAmount ?? 0), 0);
  const totalPaid = folios.reduce((s, f) => s + (f.paidAmount ?? 0), 0);
  const totalBalance = folios.reduce((s, f) => s + (f.balanceDue ?? 0), 0);
  const currency = folios[0]?.currency ?? booking.currency ?? 'INR';

  const fmt = (n: number) => `${currency} ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const editableStatuses: Booking['status'][] = ['PENDING', 'CONFIRMED', 'CHECKED_IN'];

  return (
    <ModalShell
      title={`Booking — ${booking.guestName}`}
      subtitle={booking.referenceNumber ? `Ref: ${booking.referenceNumber}` : undefined}
      size="wide"
      onClose={onClose}
    >
      <div className="flex gap-6">
        {/* ── Left panel ── */}
        <div className="min-w-0 flex-1 space-y-5">

          {/* Status & identifiers */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider', STATUS_BADGE[booking.status] ?? 'bg-slate-100 text-slate-600 border-slate-200')}>
              {booking.status.replace('_', ' ')}
            </span>
            {booking.referenceNumber && (
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-mono text-slate-600">
                {booking.referenceNumber}
              </span>
            )}
            {booking.createdAt && (
              <span className="text-[11px] text-slate-400">Created {fmtDate(booking.createdAt)}</span>
            )}
          </div>

          {/* Stay Details */}
          <section>
            <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Stay Details</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Room</p>
                <p className="mt-0.5 font-semibold text-slate-800">{booking.roomNumber || <span className="italic text-slate-400">Not assigned</span>}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Unit</p>
                <p className="mt-0.5 font-semibold text-slate-800">{booking.unitName || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Duration</p>
                <p className="mt-0.5 font-semibold text-slate-800">{nights} night{nights !== 1 ? 's' : ''}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Check-in</p>
                <p className="mt-0.5 font-semibold text-slate-800">{fmtDate(booking.checkIn)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Check-out</p>
                <p className="mt-0.5 font-semibold text-slate-800">{fmtDate(booking.checkOut)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bed Type</p>
                <p className="mt-0.5 font-semibold text-slate-800">{booking.isTwinBed ? 'Twin' : 'Double'}</p>
              </div>
            </div>
          </section>

          {/* Occupancy & Meal Plan */}
          <section>
            <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Occupancy & Meal Plan</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Adults</p>
                <p className="mt-0.5 font-semibold text-slate-800">{booking.adults}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Children</p>
                <p className="mt-0.5 font-semibold text-slate-800">{booking.children}</p>
              </div>
              {booking.mealPlanType ? (
                <>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Meal Plan</p>
                    <p className="mt-0.5 font-semibold text-slate-800">{booking.mealPlanDisplayName ?? booking.mealPlanType}</p>
                  </div>
                  {booking.mealPlanPricePerNight != null && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Adult Rate / Night</p>
                      <p className="mt-0.5 font-semibold text-slate-800">{booking.currency} {booking.mealPlanPricePerNight.toFixed(2)}</p>
                    </div>
                  )}
                  {booking.mealPlanChildrenPricePerNight != null && booking.children > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Child Rate / Night</p>
                      <p className="mt-0.5 font-semibold text-slate-800">{booking.currency} {booking.mealPlanChildrenPricePerNight.toFixed(2)}</p>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Meal Plan</p>
                  <p className="mt-0.5 italic text-slate-400 text-sm">None</p>
                </div>
              )}
              {booking.extraBeds != null && booking.extraBeds > 0 && (
                <>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Extra Beds</p>
                    <p className="mt-0.5 font-semibold text-slate-800">{booking.extraBeds}</p>
                  </div>
                  {booking.extraBedRatePerNight != null && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Extra Bed Rate / Night</p>
                      <p className="mt-0.5 font-semibold text-slate-800">{booking.currency} {booking.extraBedRatePerNight.toFixed(2)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Billed As</p>
                    <p className="mt-0.5 font-semibold text-slate-800">{booking.extraBedChargeCode === 'ROOM_RENT' ? 'Room Rent' : 'Miscellaneous'}</p>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Special Requests */}
          <section>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Special Requests</p>
            {booking.specialRequests ? (
              <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3 text-sm text-amber-800">
                {booking.specialRequests}
              </div>
            ) : (
              <p className="text-sm italic text-slate-400">None</p>
            )}
          </section>

          {/* Room Assignment History */}
          <section>
            <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Room Assignment History</p>
            {loadingAssignments ? (
              <p className="text-xs text-slate-400">Loading…</p>
            ) : assignments.length === 0 ? (
              <p className="text-sm italic text-slate-400">No assignments found.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Room</th>
                      <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Unit</th>
                      <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">From</th>
                      <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">To</th>
                      <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((a, i) => (
                      <tr key={a.id} className={cn('border-t border-slate-100', i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}>
                        <td className="px-3 py-2 font-semibold text-slate-800">{a.roomNumber}</td>
                        <td className="px-3 py-2 text-slate-600">{a.unitName}</td>
                        <td className="px-3 py-2 text-slate-600">{fmtDate(a.startDate)}</td>
                        <td className="px-3 py-2 text-slate-600">{fmtDate(a.endDate)}</td>
                        <td className="px-3 py-2">
                          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold uppercase', ASSIGNMENT_STATUS_BADGE[a.status] ?? 'bg-slate-100 text-slate-600')}>
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>

        {/* ── Right sidebar ── */}
        <div className="w-72 shrink-0 space-y-4">

          {/* Guest Profile */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Guest Profile</p>
            {loadingGuest ? (
              <p className="text-xs text-slate-400">Loading…</p>
            ) : guest ? (
              <div className="space-y-2 text-sm">
                <p className="font-bold text-slate-800">{guest.fullName}</p>
                {guest.email && (
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 w-12 shrink-0">Email</span>
                    <span className="text-slate-700 break-all">{guest.email}</span>
                  </div>
                )}
                {guest.phone && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-12 shrink-0">Phone</span>
                    <span className="text-slate-700">{guest.phone}</span>
                  </div>
                )}
                {guest.idNumber && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-12 shrink-0">Doc ID</span>
                    <span className="font-mono text-slate-700">{guest.idNumber}</span>
                  </div>
                )}
                {guest.guestIdType && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-12 shrink-0">ID Type</span>
                    <span className="text-slate-700">{GUEST_ID_TYPE_LABELS[guest.guestIdType]}</span>
                  </div>
                )}
                {guest.dateOfBirth && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-12 shrink-0">DOB</span>
                    <span className="text-slate-700">{fmtDate(guest.dateOfBirth)}</span>
                  </div>
                )}
                {guest.preferences && (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-600">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Preferences</p>
                    {guest.preferences}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs italic text-slate-400">Guest details unavailable.</p>
            )}
          </div>

          {/* Travel Agent */}
          {booking.travelAgentName && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Travel Agent</p>
              <p className="text-sm font-semibold text-slate-800">{booking.travelAgentName}</p>
              {booking.commissionRate != null && (
                <p className="mt-1 text-xs text-slate-500">Commission: {booking.commissionRate}%</p>
              )}
            </div>
          )}

          {/* Folio Summary */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Folio Summary</p>
            {loadingFolios ? (
              <p className="text-xs text-slate-400">Loading…</p>
            ) : folios.length === 0 ? (
              <p className="text-xs italic text-slate-400">No folios found.</p>
            ) : (
              <div className="space-y-3">
                {/* Per-folio rows when multiple folios */}
                {folios.length > 1 && (
                  <div className="space-y-2 border-b border-slate-200 pb-3">
                    {folios.map(f => (
                      <div key={f.id} className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-slate-600 truncate">{f.folioNumber ?? 'Folio'}</span>
                          {f.folioType && (
                            <span className={cn('shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase', FOLIO_TYPE_BADGE[f.folioType] ?? 'bg-slate-100 text-slate-600')}>
                              {f.folioType}
                            </span>
                          )}
                        </div>
                        <span className={cn('shrink-0 font-semibold', (f.balanceDue ?? 0) > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                          {currency} {(f.balanceDue ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Aggregate breakdown */}
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-medium text-slate-800">{fmt(totalSubtotal)}</span>
                  </div>
                  {totalTax > 0 && (
                    <div className="flex justify-between">
                      <span>Tax</span>
                      <span className="font-medium text-slate-800">{fmt(totalTax)}</span>
                    </div>
                  )}
                  {totalDiscount > 0 && (
                    <div className="flex justify-between">
                      <span>Discount</span>
                      <span className="font-medium text-emerald-600">− {fmt(totalDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-bold text-slate-800">
                    <span>Total Charges</span>
                    <span>{fmt(totalCharges)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span>Amount Paid</span>
                    <span className="font-semibold">{fmt(totalPaid)}</span>
                  </div>
                </div>

                {/* Balance Due highlight */}
                <div className={cn(
                  'rounded-lg border px-3 py-2.5 text-center',
                  totalBalance > 0
                    ? 'border-rose-200 bg-rose-50'
                    : 'border-emerald-200 bg-emerald-50',
                )}>
                  <p className={cn('text-[10px] font-bold uppercase tracking-widest', totalBalance > 0 ? 'text-rose-500' : 'text-emerald-500')}>
                    Balance Due
                  </p>
                  <p className={cn('mt-0.5 text-lg font-extrabold', totalBalance > 0 ? 'text-rose-700' : 'text-emerald-700')}>
                    {fmt(totalBalance)}
                  </p>
                </div>

                <button
                  type="button"
                  className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                  onClick={() => { onClose(); onOpenFolio(booking.id!, booking.guestName); }}
                >
                  Open Folio →
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            {editableStatuses.includes(booking.status) && (
              <button
                type="button"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                onClick={() => { onClose(); onEditBooking(booking); }}
              >
                ✎ Edit Booking
              </button>
            )}
            <button
              type="button"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50"
              onClick={onClose}
            >
              Close
            </button>
          </div>

        </div>
      </div>
    </ModalShell>
  );
}
