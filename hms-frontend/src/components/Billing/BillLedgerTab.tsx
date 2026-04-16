import { useState, useEffect, useMemo } from 'react';
import billingApi from '../../api/billingApi';
import type { BillDto, BillLedgerPageDto } from '../../api/billingApi';
import { triggerPresignedDownload } from '../../utils/downloadUtils';

const ZIP_LIMIT = 150;

const inputCls =
  'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100';

const btnPrimary =
  'inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50';

const btnSecondary =
  'inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

function formatDate(d?: string): string {
  if (!d) return '—';
  const [year, month, day] = d.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[parseInt(month) - 1]} ${year}`;
}

export default function BillLedgerTab() {
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [includeVoided, setIncludeVoided] = useState(false);
  const [ledger, setLedger] = useState<BillLedgerPageDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'ROOM_RENT' | 'ANCILLARY'>('ALL');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadLedger = async () => {
    setLoading(true);
    setError(null);
    try {
      const fromDt = `${fromDate}T00:00:00+05:30`;
      const toDt = `${toDate}T23:59:59+05:30`;
      const data = await billingApi.getLedger(fromDt, toDt, includeVoided);
      setLedger(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load bill ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadLedger(); }, []);

  const filteredBills = useMemo<BillDto[]>(() => {
    if (!ledger) return [];
    return ledger.bills.filter(b => {
      if (categoryFilter !== 'ALL' && b.category !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          b.invoiceNumber?.toLowerCase().includes(q) ||
          b.guestName?.toLowerCase().includes(q) ||
          b.roomNumber?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [ledger, categoryFilter, searchQuery]);

  const filteredTotal = useMemo(
    () => filteredBills.reduce((sum, b) => sum + (b.grandTotal ?? 0), 0),
    [filteredBills],
  );

  const handleDownloadZip = async () => {
    if (filteredBills.length > ZIP_LIMIT) {
      alert(`Too many bills (${filteredBills.length}). Narrow the date range or search to ≤${ZIP_LIMIT} bills before downloading.`);
      return;
    }
    setZipping(true);
    try {
      await billingApi.downloadLedgerZip(filteredBills.map(b => b.id));
    } catch (err: any) {
      alert(err.message || 'Failed to download ZIP');
    } finally {
      setZipping(false);
    }
  };

  const handleExportCsv = () => {
    const headers = ['Invoice #', 'Date', 'Property', 'Guest', 'Room', 'Category', 'Grand Total'];
    const rows = filteredBills.map(b => [
      b.invoiceNumber ?? '',
      b.invoiceDate ?? '',
      b.PropertyName ?? '',
      b.guestName ?? '',
      b.roomNumber ?? '',
      b.category ?? '',
      b.grandTotal?.toFixed(2) ?? '0.00',
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `bill-ledger-${toDate}.csv`,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadOne = async (billId: string) => {
    setDownloadingId(billId);
    try {
      const url = await billingApi.getDownloadUrl(billId);
      triggerPresignedDownload(url);
    } catch (err: any) {
      alert(err.message || 'Failed to get download link.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <>
      {/* Header / Toolbar */}
      <div className="px-4 pt-3 pb-2.5 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-semibold text-slate-600">Bill Ledger</h2>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeVoided}
              onChange={e => setIncludeVoided(e.target.checked)}
              className="accent-rose-600 h-3 w-3"
            />
            Show Voided
          </label>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className={inputCls}
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className={inputCls}
          />
          <button onClick={loadLedger} disabled={loading} className={btnPrimary}>
            {loading ? 'Loading…' : 'Apply'}
          </button>
          <input
            type="text"
            placeholder="Search invoice, guest, room…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={`${inputCls} flex-1 min-w-[130px]`}
          />
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value as 'ALL' | 'ROOM_RENT' | 'ANCILLARY')}
            className={inputCls}
          >
            <option value="ALL">All Types</option>
            <option value="ROOM_RENT">Room Rent</option>
            <option value="ANCILLARY">Ancillary</option>
          </select>
        </div>
      </div>

      {/* Summary bar */}
      {ledger && !loading && (
        <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-3 flex-shrink-0 bg-slate-50/60">
          <span className="text-xs text-slate-500">
            <span className="font-semibold text-slate-800">{filteredBills.length}</span> bills
            {' · '}
            <span className="font-semibold text-slate-800">
              ₹{filteredTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleDownloadZip}
              disabled={zipping || filteredBills.length === 0}
              title={filteredBills.length > ZIP_LIMIT ? `Narrow filter to ≤${ZIP_LIMIT} bills first` : 'Download all displayed bills as ZIP'}
              className={btnSecondary}
            >
              {zipping ? 'Packaging…' : 'Download ZIP'}
            </button>
            <button
              onClick={handleExportCsv}
              disabled={filteredBills.length === 0}
              className={btnSecondary}
            >
              Export CSV
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-y-auto flex-1">
        {error && (
          <div className="m-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            {error}
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-slate-400 animate-pulse">Loading…</p>
          </div>
        ) : !ledger || filteredBills.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs font-medium text-slate-400">No bills found for this period.</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-sm">
              <tr className="text-xs font-medium text-slate-400 border-b border-slate-100">
                <th className="px-4 py-2 font-medium">Invoice #</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Guest</th>
                <th className="px-3 py-2 font-medium">Room</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium text-right">Amount</th>
                <th className="px-4 py-2 font-medium text-center">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBills.map(bill => (
                <tr
                  key={bill.id}
                  className={`transition-colors hover:bg-slate-50/60 ${bill.isVoided ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] font-semibold text-slate-800">
                        {bill.invoiceNumber}
                      </span>
                      {bill.isVoided && (
                        <span className="rounded-md bg-rose-100 px-1 py-0.5 text-[9px] font-bold uppercase text-rose-600">
                          Voided
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[11px] text-slate-500 whitespace-nowrap">
                    {formatDate(bill.invoiceDate)}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700 max-w-[110px] truncate">
                    {bill.guestName ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {bill.roomNumber ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${
                      bill.category === 'ROOM_RENT'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-teal-50 text-teal-700 border-teal-200'
                    }`}>
                      {bill.category === 'ROOM_RENT' ? 'Room' : 'Ancillary'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-semibold text-slate-800 whitespace-nowrap">
                    ₹{(bill.grandTotal ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => handleDownloadOne(bill.id)}
                      disabled={downloadingId === bill.id}
                      title="Download PDF"
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40 mx-auto"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
