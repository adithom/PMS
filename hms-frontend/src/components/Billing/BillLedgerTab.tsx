import { useState, useEffect, useMemo } from 'react';
import { Download } from 'lucide-react';
import billingApi from '../../api/billingApi';
import type { BillBatchRowDto, BillBatchPageDto } from '../../api/billingApi';
import { fmtDate } from '../../utils/dateHelpers';

const ZIP_LIMIT = 150;

const inputCls =
  'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100';

const btnPrimary =
  'inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50';

const btnSecondary =
  'inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

const formatDate = (d?: string) => d ? fmtDate(d) : '—';

export default function BillLedgerTab() {
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [includeVoided, setIncludeVoided] = useState(false);
  const [ledger, setLedger] = useState<BillBatchPageDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyFilter, setPropertyFilter] = useState<string>('ALL');
  const [downloadingBatchId, setDownloadingBatchId] = useState<string | null>(null);

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

  const propertyNames = useMemo<string[]>(() => {
    if (!ledger) return [];
    return [...new Set(ledger.batches.map(b => b.propertyName ?? '').filter(Boolean))].sort();
  }, [ledger]);

  const filteredBatches = useMemo<BillBatchRowDto[]>(() => {
    if (!ledger) return [];
    return ledger.batches.filter(b => {
      if (propertyFilter !== 'ALL' && b.propertyName !== propertyFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          b.mainInvoiceNumber?.toLowerCase().includes(q) ||
          b.guestName?.toLowerCase().includes(q) ||
          b.propertyName?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [ledger, propertyFilter, searchQuery]);

  const filteredTotal = useMemo(
    () => filteredBatches.reduce((sum, b) => sum + (b.grandTotal ?? 0), 0),
    [filteredBatches],
  );

  const handleDownloadZip = async () => {
    const allBillIds = filteredBatches.flatMap(b => b.billIds);
    if (allBillIds.length > ZIP_LIMIT) {
      alert(`Too many bills (${allBillIds.length}). Narrow the date range or search to fewer invoices before downloading.`);
      return;
    }
    setZipping(true);
    try {
      await billingApi.downloadLedgerZip(allBillIds);
    } catch (err: any) {
      alert(err.message || 'Failed to download ZIP');
    } finally {
      setZipping(false);
    }
  };

  const handleExportCsv = () => {
    const headers = ['Invoice #', 'Date', 'Property', 'Guest', 'Grand Total'];
    const rows = filteredBatches.map(b => [
      b.mainInvoiceNumber ?? '',
      b.billDate ?? '',
      b.propertyName ?? '',
      b.guestName ?? '',
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

  const handleDownloadBatch = async (batch: BillBatchRowDto) => {
    setDownloadingBatchId(batch.batchId);
    try {
      await billingApi.downloadLedgerZip(batch.billIds);
    } catch (err: any) {
      alert(err.message || 'Failed to download bills.');
    } finally {
      setDownloadingBatchId(null);
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
            placeholder="Search invoice, guest, property…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={`${inputCls} flex-1 min-w-[130px]`}
          />
          <select
            value={propertyFilter}
            onChange={e => setPropertyFilter(e.target.value)}
            className={inputCls}
          >
            <option value="ALL">All Properties</option>
            {propertyNames.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary bar */}
      {ledger && !loading && (
        <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-3 flex-shrink-0 bg-slate-50/60">
          <span className="text-xs text-slate-500">
            <span className="font-semibold text-slate-800">{filteredBatches.length}</span> invoices
            {' · '}
            <span className="font-semibold text-slate-800">
              ₹{filteredTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleDownloadZip}
              disabled={zipping || filteredBatches.length === 0}
              title="Download all displayed invoices as ZIP"
              className={btnSecondary}
            >
              {zipping ? 'Packaging…' : 'Download ZIP'}
            </button>
            <button
              onClick={handleExportCsv}
              disabled={filteredBatches.length === 0}
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
        ) : !ledger || filteredBatches.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs font-medium text-slate-400">No invoices found for this period.</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-sm">
              <tr className="text-xs font-medium text-slate-400 border-b border-slate-100">
                <th className="px-4 py-2 font-medium">Invoice #</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Guest</th>
                <th className="px-3 py-2 font-medium">Property</th>
                <th className="px-3 py-2 font-medium text-right">Total</th>
                <th className="px-4 py-2 font-medium text-center">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBatches.map(batch => (
                <tr
                  key={batch.batchId}
                  className={`transition-colors hover:bg-slate-50/60 ${batch.isVoided ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] font-semibold text-slate-800">
                        {batch.mainInvoiceNumber}
                      </span>
                      {batch.isVoided && (
                        <span className="rounded-md bg-rose-100 px-1 py-0.5 text-[9px] font-bold uppercase text-rose-600">
                          Voided
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[11px] text-slate-500 whitespace-nowrap">
                    {formatDate(batch.billDate)}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700 max-w-[110px] truncate">
                    {batch.guestName ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500 max-w-[100px] truncate">
                    {batch.propertyName ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-semibold text-slate-800 whitespace-nowrap">
                    ₹{(batch.grandTotal ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => handleDownloadBatch(batch)}
                      disabled={downloadingBatchId === batch.batchId}
                      title={`Download ${batch.billIds.length > 1 ? `${batch.billIds.length} PDFs as ZIP` : 'PDF'}`}
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40 mx-auto"
                    >
                      <Download className="h-3.5 w-3.5" />
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
