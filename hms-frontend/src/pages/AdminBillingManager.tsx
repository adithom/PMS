import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Building2, ChevronRight } from 'lucide-react';
import propertyApi from '../api/propertyApi';
import folioApi from '../api/folioApi';
import type { Property } from '../types';
import type { FolioDto } from '../api/folioApi';

import LoadingSpinner from '../components/LoadingSpinner';
import FolioDetailModal from '../components/Billing/FolioDetailModal';

/* ────────────────────────────────────────────────────────────── */
/* Types & Tokens                                               */
/* ────────────────────────────────────────────────────────────── */

interface GlobalFolio extends FolioDto {
  propertyName: string;
  propertyId: string;
}

type TabType = 'overview' | 'folios' | 'audit';
type FilterPreset = 'ALL' | 'UNPAID_MASTER' | 'AGING_7_DAYS';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function AdminBillingDashboard() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [globalFolios, setGlobalFolios] = useState<GlobalFolio[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI State
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('ALL');
  const [filterPreset, setFilterPreset] = useState<FilterPreset>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [activeFolio, setActiveFolio] = useState<{ propertyId: string, folioId: string } | null>(null);

  /* ═══════════════════════════════════════════════════════════ */
  /* Data Loading (The Scatter-Gather Approach)                  */
  /* ═══════════════════════════════════════════════════════════ */

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('[Billing Dashboard] 1. Fetching properties...');
      const propsResponse = await propertyApi.getAll();
      
      // SAFETY CHECK: If the backend returns a paginated object { content: [...] }, extract it.
      const propsArray = Array.isArray(propsResponse) 
        ? propsResponse 
        : (propsResponse as any)?.content || [];

      console.log(`[Billing Dashboard] 2. Found ${propsArray.length} properties:`, propsArray);

      if (propsArray.length === 0) {
        setProperties([]);
        setGlobalFolios([]);
        setLoading(false);
        return;
      }

      setProperties(propsArray);

      console.log('[Billing Dashboard] 3. Fetching folios for each property...');
      // Fetch open folios for EVERY property simultaneously
      const folioPromises = propsArray.map(async (p: Property) => {
        try {
          const folios = await folioApi.getOpenFolios(p.id);
          console.log(`[Billing Dashboard] -> Success for ${p.name}: ${folios?.length || 0} folios found.`);
          return (folios || []).map((f: any) => ({ ...f, propertyName: p.name, propertyId: p.id }));
        } catch (err: any) {
          // WE REMOVED THE SILENT CATCH: Now it logs the exact API error to the console!
          console.error(`[Billing Dashboard] -> ERROR fetching folios for ${p.name}:`, err);
          return []; 
        }
      });

      const foliosArrays = await Promise.all(folioPromises);
      const mergedFolios = foliosArrays.flat();
      
      console.log(`[Billing Dashboard] 4. Merged all folios. Total open folios across business:`, mergedFolios.length);
      setGlobalFolios(mergedFolios);

    } catch (err: any) {
      console.error('[Billing Dashboard] Critical Failure in loadData:', err);
      setError(err.message || 'Failed to load global billing data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /* ═══════════════════════════════════════════════════════════ */
  /* Computations & Filtering                                    */
  /* ═══════════════════════════════════════════════════════════ */

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const now = new Date().getTime();

  // Filter the grid based on Admin selections
  const filteredFolios = useMemo(() => {
    return globalFolios.filter(f => {
      // 1. Property Filter
      if (selectedPropertyId !== 'ALL' && f.propertyId !== selectedPropertyId) return false;
      
      // 2. Search Filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          (f.roomNumber || '').toLowerCase().includes(q) ||
          (f.guestName || '').toLowerCase().includes(q) ||
          (f.folioNumber || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      // 3. Preset Filter
      if (filterPreset === 'UNPAID_MASTER') {
        if (f.folioType !== 'MASTER' && f.folioType !== 'GROUP') return false;
      }
      if (filterPreset === 'AGING_7_DAYS') {
        if (!f.createdAt) return false;
        const age = now - new Date(f.createdAt).getTime();
        if (age < SEVEN_DAYS_MS) return false;
      }

      return true;
    }).sort((a, b) => (b.balanceDue || 0) - (a.balanceDue || 0)); // Sort highest balance first
  }, [globalFolios, selectedPropertyId, filterPreset, searchQuery, now, SEVEN_DAYS_MS]);

  // Macro Metrics for Overview Tab
  const metrics = useMemo(() => {
    let totalReceivables = 0;
    let agingReceivables = 0;
    let masterReceivables = 0;
    
    const byProperty: Record<string, { name: string, balance: number, count: number }> = {};

    globalFolios.forEach(f => {
      // If a folio is OPEN but balance is 0, we still count it in the properties breakdown, 
      // but it doesn't add to the financial receivables.
      const bal = Math.max(0, f.balanceDue || 0);

      totalReceivables += bal;

      if (f.createdAt && (now - new Date(f.createdAt).getTime()) > SEVEN_DAYS_MS) {
        agingReceivables += bal;
      }

      if (f.folioType === 'MASTER' || f.folioType === 'GROUP') {
        masterReceivables += bal;
      }

      if (!byProperty[f.propertyId]) {
        byProperty[f.propertyId] = { name: f.propertyName, balance: 0, count: 0 };
      }
      byProperty[f.propertyId].balance += bal;
      byProperty[f.propertyId].count += 1;
    });

    return { totalReceivables, agingReceivables, masterReceivables, byProperty: Object.values(byProperty) };
  }, [globalFolios, now, SEVEN_DAYS_MS]);

  /* ═══════════════════════════════════════════════════════════ */
  /* Rendering                                                   */
  /* ═══════════════════════════════════════════════════════════ */

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-slate-50">
        <LoadingSpinner text="Aggregating global financials..." />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-slate-50 pb-20">
      
      {/* ─── Header & Tabs ─── */}
      <div className="bg-white border-b border-slate-200 px-8 pt-8 sm:px-12 lg:px-16">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Corporate Finance</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Global Billing Overview
            </h1>
          </div>
          <button onClick={loadData} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-100">
            <RefreshCw className="h-4 w-4" />
            Refresh Data
          </button>
        </div>

        <div className="mt-8 flex gap-8 border-b border-transparent">
          {[
            { id: 'overview', label: 'Dashboard' },
            { id: 'folios', label: 'Global Folio Grid' },
            { id: 'audit', label: 'Audit & Voids Log' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={cn(
                'border-b-2 pb-4 text-sm font-bold transition-colors',
                activeTab === tab.id 
                  ? 'border-indigo-600 text-indigo-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[1800px] px-8 pt-8 sm:px-12 lg:px-16">
        {error && (
          <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm">
            {error}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* TAB 1: OVERVIEW DASHBOARD                                   */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            
            {/* Top Metric Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Total Outstanding Revenue</p>
                <p className="mt-2 text-4xl font-extrabold text-slate-900">
                  ₹{metrics.totalReceivables.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
                <p className="mt-2 text-xs font-medium text-slate-400">Across {globalFolios.length} open folios</p>
              </div>
              
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-rose-600">Aging Receivables ({'>'} 7 Days)</p>
                <p className="mt-2 text-4xl font-extrabold text-rose-900">
                  ₹{metrics.agingReceivables.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
                <button 
                  onClick={() => { setActiveTab('folios'); setFilterPreset('AGING_7_DAYS'); }}
                  className="mt-2 text-xs font-bold text-rose-600 hover:underline"
                >
                  View aging folios →
                </button>
              </div>

              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Unpaid Master / Group Folios</p>
                <p className="mt-2 text-4xl font-extrabold text-indigo-900">
                  ₹{metrics.masterReceivables.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
                <button 
                  onClick={() => { setActiveTab('folios'); setFilterPreset('UNPAID_MASTER'); }}
                  className="mt-2 text-xs font-bold text-indigo-600 hover:underline"
                >
                  View corporate accounts →
                </button>
              </div>
            </div>

            {/* Property Breakdown */}
            <div>
              <h2 className="mb-4 text-lg font-bold text-slate-900">Breakdown by Property</h2>
              {metrics.byProperty.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                  No open folios found across any properties.
                </div>
              ) : (
                <div className="flex flex-col gap-4"> {/* Changed to vertical list */}
                  {metrics.byProperty.map(p => (
                    <div key={p.name} className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-indigo-300 hover:shadow-md cursor-pointer" 
                      onClick={() => { 
                        const target = properties.find(prop => prop.name === p.name);
                        if (target) { setSelectedPropertyId(target.id); setActiveTab('folios'); }
                      }}
                    >
                      {/* Left Side: Icon & Property Name */}
                      <div className="flex items-center gap-5">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-50 text-slate-400 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600">
                          <Building2 className="h-6 w-6" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">{p.name}</h3>
                      </div>

                      {/* Right Side: Metrics */}
                      <div className="flex items-center gap-8">
                        <div className="text-right border-r border-slate-100 pr-8">
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Open Folios</p>
                          <p className="text-base font-semibold text-slate-700">{p.count}</p>
                        </div>
                        <div className="text-right min-w-[140px]">
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Balance</p>
                          <p className="text-2xl font-extrabold text-emerald-600">
                            ₹{p.balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </p>
                        </div>
                        <div className="text-slate-300 transition-colors group-hover:text-indigo-600">
                          <ChevronRight className="h-5 w-5" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* TAB 2: GLOBAL FOLIO GRID                                    */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'folios' && (
          <div className="animate-in fade-in duration-500 flex flex-col h-[calc(100vh-16rem)]">
            
            {/* Filters Toolbar */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm shrink-0">
              <div className="flex flex-wrap items-center gap-4">
                <select 
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500"
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                >
                  <option value="ALL">All Properties</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>

                <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

                <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                  {[
                    { id: 'ALL', label: 'All Open' },
                    { id: 'UNPAID_MASTER', label: 'Master Only' },
                    { id: 'AGING_7_DAYS', label: '> 7 Days Old' }
                  ].map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => setFilterPreset(preset.id as FilterPreset)}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-xs font-bold transition-all',
                        filterPreset === preset.id ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-900'
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <input 
                type="text"
                placeholder="Search Folio # or Guest..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </div>

            {/* The Grid */}
            <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500 z-10">
                  <tr>
                    <th className="p-4">Property</th>
                    <th className="p-4">Folio Details</th>
                    <th className="p-4">Guest / Group</th>
                    <th className="p-4 text-right">Total Charges</th>
                    <th className="p-4 text-right">Balance Due</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFolios.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-400">No folios match your current filters.</td>
                    </tr>
                  ) : (
                    filteredFolios.map(f => (
                      <tr key={f.id} className="transition-colors hover:bg-slate-50">
                        <td className="p-4 font-bold text-slate-900">{f.propertyName}</td>
                        <td className="p-4">
                          <span className="block font-bold text-slate-900">{f.roomNumber ? `Room ${f.roomNumber}` : '—'}</span>
                          <span className="block text-xs text-slate-500">
                            {f.checkInDate && f.checkOutDate ? `${f.checkInDate.split('-').reverse().join('-')} → ${f.checkOutDate.split('-').reverse().join('-')}` : f.folioNumber ? `#${f.folioNumber}` : '—'}
                          </span>
                          <div className="mt-1 flex items-center gap-2">
                            <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                              f.folioType === 'MASTER' || f.folioType === 'GROUP' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                            )}>
                              {f.folioType}
                            </span>
                            {f.createdAt && (now - new Date(f.createdAt).getTime() > SEVEN_DAYS_MS) && (
                              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-700">Aging</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 font-medium text-slate-700">{f.guestName || 'Unknown'}</td>
                        <td className="p-4 text-right text-slate-500">{f.currency} {f.totalAmount?.toFixed(2)}</td>
                        <td className="p-4 text-right font-extrabold text-slate-900">{f.currency} {f.balanceDue?.toFixed(2)}</td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => setActiveFolio({ propertyId: f.propertyId, folioId: f.id })}
                            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            Open Ledger
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* TAB 3: AUDIT LOG (Mocked Concept)                           */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'audit' && (
          <div className="animate-in fade-in duration-500">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 mb-6">
              <h3 className="text-sm font-bold text-amber-800">Note on the Audit Log</h3>
              <p className="mt-1 text-xs text-amber-700 leading-relaxed">
                Currently, the backend API does not have a global <code>/api/audit/financials</code> endpoint to fetch all voided charges and refunded payments natively. This view demonstrates how the Corporate Audit Log will look once that endpoint is established at the backend.
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white opacity-60 grayscale pointer-events-none">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="p-4">Date & Time</th>
                    <th className="p-4">Action</th>
                    <th className="p-4">Property & Folio</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Reason</th>
                    <th className="p-4">Authorized By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="p-4">Oct 24, 2023 14:32</td>
                    <td className="p-4"><span className="rounded bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-700">VOID CHARGE</span></td>
                    <td className="p-4 text-slate-600">Spice Tree • #FOL-8921</td>
                    <td className="p-4 font-bold">INR 4,500.00</td>
                    <td className="p-4 text-slate-500 text-xs">Guest disputed minibar charge. Found intact.</td>
                    <td className="p-4 font-medium text-slate-700">admin_james</td>
                  </tr>
                  <tr>
                    <td className="p-4">Oct 24, 2023 09:15</td>
                    <td className="p-4"><span className="rounded bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">REFUND PAYMENT</span></td>
                    <td className="p-4 text-slate-600">Grand Hotel • #FOL-8804</td>
                    <td className="p-4 font-bold">INR 12,000.00</td>
                    <td className="p-4 text-slate-500 text-xs">Accidental double charge on checkout.</td>
                    <td className="p-4 font-medium text-slate-700">frontdesk_sarah</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ─── Folio Detail Modal Wrapper ─── */}
      {activeFolio && (
        <FolioDetailModal
          propertyId={activeFolio.propertyId}
          folioId={activeFolio.folioId}
          onClose={() => { setActiveFolio(null); loadData(); }} // Reload grid on close to reflect new balances
        />
      )}
    </div>
  );
}