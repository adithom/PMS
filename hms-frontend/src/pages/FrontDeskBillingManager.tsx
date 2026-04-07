import { useState, useEffect, useMemo } from 'react';
import folioApi from '../api/folioApi';
import type { FolioDto } from '../api/folioApi';

import LoadingSpinner from '../components/LoadingSpinner';
import FolioDetailModal from '../components/Billing/FolioDetailModal';

// todo: Wire up real room numbers and checkout dates from backend once FolioDto is updated
// todo: make the generate bill actually work

/* ────────────────────────────────────────────────────────────── */
/* Types & Tokens                                               */
/* ────────────────────────────────────────────────────────────── */

// Extending FolioDto for the Front Desk view to include booking details 
// Note: You should add roomNumber and checkoutDate to your FolioDto.java!
interface FrontDeskFolio extends FolioDto {
  roomNumber?: string;
  checkoutDate?: string;
}

interface FrontDeskBillingManagerProps {
  propertyId: string; // The specific property the agent is logged into
}

type FilterPreset = 'ALL' | 'DEPARTING_TODAY' | 'HIGH_BALANCE' | 'CLOSED';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function FrontDeskBillingManager({ propertyId }: FrontDeskBillingManagerProps) {
  const [folios, setFolios] = useState<FrontDeskFolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI State
  const [filterPreset, setFilterPreset] = useState<FilterPreset>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [activeFolioId, setActiveFolioId] = useState<string | null>(null);

  /* ═══════════════════════════════════════════════════════════ */
  /* Data Loading                                                */
  /* ═══════════════════════════════════════════════════════════ */

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch open folios for this specific property
      const response = await folioApi.getOpenFolios(propertyId);
      
      // Simulate mapping Room Numbers and Checkout Dates for the UI 
      // (Remove this mapping once backend FolioDto includes these fields)
      const mappedFolios: FrontDeskFolio[] = (response || []).map((f, i) => ({
        ...f,
        roomNumber: f.folioType === 'MASTER' ? 'GROUP' : `${101 + i}`, // Dummy room number
        checkoutDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) // Dummy checkout date (Today in IST)
      }));

      setFolios(mappedFolios);
    } catch (err: any) {
      console.error('[Front Desk Billing] Failed to load folios:', err);
      setError(err.message || 'Failed to load front desk billing data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (propertyId) {
      loadData();
    }
  }, [propertyId]);

  /* ═══════════════════════════════════════════════════════════ */
  /* Computations & Filtering                                    */
  /* ═══════════════════════════════════════════════════════════ */

  const HIGH_BALANCE_THRESHOLD = 50000;
  const todayDateString = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  const metrics = useMemo(() => {
    let departingWithBalance = 0;
    let highBalanceCount = 0;
    let closedCount = 0;

    folios.forEach(f => {
      const isDepartingToday = f.checkoutDate?.startsWith(todayDateString);
      const balance = f.balanceDue || 0;

      if (isDepartingToday && balance > 0 && f.status === 'OPEN') {
        departingWithBalance++;
      }
      if (balance >= HIGH_BALANCE_THRESHOLD && f.status === 'OPEN') {
        highBalanceCount++;
      }
      if (f.status === 'CLOSED') {
        closedCount++;
      }
    });

    return { departingWithBalance, highBalanceCount, closedCount };
  }, [folios, todayDateString]);

  const filteredFolios = useMemo(() => {
    return folios.filter(f => {
      // 1. Search Filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match = 
          (f.guestName || '').toLowerCase().includes(q) || 
          (f.roomNumber || '').toLowerCase().includes(q) ||
          (f.folioNumber || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      // 2. Preset Filter
      const balance = f.balanceDue || 0;
      if (filterPreset === 'DEPARTING_TODAY') {
        const isDepartingToday = f.checkoutDate?.startsWith(todayDateString);
        if (!isDepartingToday || balance <= 0 || f.status !== 'OPEN') return false;
      }
      if (filterPreset === 'HIGH_BALANCE') {
        if (balance < HIGH_BALANCE_THRESHOLD || f.status !== 'OPEN') return false;
      }
      if (filterPreset === 'CLOSED') {
        if (f.status !== 'CLOSED') return false;
      }

      return true;
    }).sort((a, b) => (b.balanceDue || 0) - (a.balanceDue || 0)); // Highest balance first
  }, [folios, filterPreset, searchQuery, todayDateString]);

  const handleGenerateBill = (folio: FrontDeskFolio) => {
    const balance = folio.balanceDue || 0;
    
    if (balance <= 0) {
      console.log(`[System Log] Bill generated for Folio ${folio.folioNumber}`);
      alert(`Success: Bill generated for ${folio.guestName}`);
    } else {
      console.log(`[System Log] Balance remaining warning for Folio ${folio.folioNumber}. Balance: ${balance}`);
      alert(`Warning: Cannot generate bill. ${folio.guestName} still owes ${folio.currency} ${balance.toFixed(2)}.`);
    }
  };

  /* ═══════════════════════════════════════════════════════════ */
  /* Rendering                                                   */
  /* ═══════════════════════════════════════════════════════════ */

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-slate-50">
        <LoadingSpinner text="Loading front desk operations..." />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-slate-50 p-6 lg:p-8">
      
      {/* ─── Header & At a Glance Cards ─── */}
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Front Desk Billing
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Daily operational view for checkouts and balances.
          </p>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800 shadow-sm">
          {error}
        </div>
      )}

      {/* Metric Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div 
          onClick={() => setFilterPreset(filterPreset === 'DEPARTING_TODAY' ? 'ALL' : 'DEPARTING_TODAY')}
          className={cn(
            "cursor-pointer rounded-2xl border p-5 transition-all hover:shadow-md",
            filterPreset === 'DEPARTING_TODAY' 
              ? "border-rose-300 bg-rose-50 shadow-sm ring-1 ring-rose-200" 
              : "border-slate-200 bg-white hover:border-rose-200"
          )}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Departing Today</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-extrabold text-slate-900">{metrics.departingWithBalance}</p>
                <p className="text-xs font-medium text-rose-600">need payment</p>
              </div>
            </div>
          </div>
        </div>

        <div 
          onClick={() => setFilterPreset(filterPreset === 'HIGH_BALANCE' ? 'ALL' : 'HIGH_BALANCE')}
          className={cn(
            "cursor-pointer rounded-2xl border p-5 transition-all hover:shadow-md",
            filterPreset === 'HIGH_BALANCE' 
              ? "border-amber-300 bg-amber-50 shadow-sm ring-1 ring-amber-200" 
              : "border-slate-200 bg-white hover:border-amber-200"
          )}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">In-House High Balance</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-extrabold text-slate-900">{metrics.highBalanceCount}</p>
                <p className="text-xs font-medium text-amber-600">{'>'} ₹50k Due</p>
              </div>
            </div>
          </div>
        </div>

        <div 
          onClick={() => setFilterPreset(filterPreset === 'CLOSED' ? 'ALL' : 'CLOSED')}
          className={cn(
            "cursor-pointer rounded-2xl border p-5 transition-all hover:shadow-md",
            filterPreset === 'CLOSED' 
              ? "border-emerald-300 bg-emerald-50 shadow-sm ring-1 ring-emerald-200" 
              : "border-slate-200 bg-white hover:border-emerald-200"
          )}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Recently Closed</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-extrabold text-slate-900">{metrics.closedCount}</p>
                <p className="text-xs font-medium text-emerald-600">settled folios</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Search & Toolbar ─── */}
      <div className="mb-4 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search Room # or Guest Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm font-medium text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {filterPreset !== 'ALL' && (
          <button 
            onClick={() => setFilterPreset('ALL')}
            className="text-xs font-bold text-slate-500 hover:text-slate-900 hover:underline"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* ─── Data Grid ─── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-4">Room #</th>
                <th className="p-4">Guest Name</th>
                <th className="p-4">Folio Status</th>
                <th className="p-4 text-right">Total Charges</th>
                <th className="p-4 text-right">Paid</th>
                <th className="p-4 text-right">Balance Due</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFolios.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    No folios found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredFolios.map(f => {
                  const balance = f.balanceDue || 0;
                  const isZeroBalance = balance <= 0;

                  return (
                    <tr key={f.id} className="transition-colors hover:bg-slate-50">
                      <td className="p-4 font-bold text-slate-900">{f.roomNumber || '—'}</td>
                      <td className="p-4 font-medium text-slate-700">{f.guestName || 'Unknown'}</td>
                      <td className="p-4">
                        <span className={cn(
                          'rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-widest',
                          f.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700' :
                          f.status === 'CLOSED' ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-700'
                        )}>
                          {f.status}
                        </span>
                        {f.folioType === 'MASTER' && (
                          <span className="ml-2 rounded text-[10px] font-bold text-indigo-500">MASTER</span>
                        )}
                      </td>
                      <td className="p-4 text-right text-slate-500">{f.currency} {f.totalAmount?.toFixed(2)}</td>
                      <td className="p-4 text-right text-slate-500">{f.currency} {f.paidAmount?.toFixed(2)}</td>
                      <td className={cn(
                        "p-4 text-right font-extrabold",
                        isZeroBalance ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {f.currency} {balance.toFixed(2)}
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => setActiveFolioId(f.id)}
                          className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                        >
                          Open Ledger
                        </button>
                        <button 
                            onClick={() => handleGenerateBill(f)}
                            className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-100"
                          >
                            Generate Bill
                          </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Modal Wrapper ─── */}
      {activeFolioId && (
        <FolioDetailModal
          propertyId={propertyId}
          folioId={activeFolioId}
          onClose={() => { setActiveFolioId(null); loadData(); }} // Refresh grid on close
        />
      )}
    </div>
  );
}