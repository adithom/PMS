import BillLedgerTab from '../components/Billing/BillLedgerTab';

export default function Invoices() {
  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col bg-slate-50 overflow-hidden">
      <div className="flex flex-col flex-1 min-h-0 mx-auto w-full max-w-[1800px] px-8 sm:px-12 lg:px-16">

        {/* ─── Page Header ─── */}
        <div className="flex items-center justify-between flex-shrink-0 pt-4 pb-3">
          <div>
            <p className="text-[10px] font-semibold text-emerald-600 tracking-wide">Billing</p>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 leading-tight">Invoices</h1>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 pb-4">
          <div className="flex flex-col flex-1 min-h-0 rounded-2xl border-2 border-slate-200 bg-white">
            <BillLedgerTab />
          </div>
        </div>

      </div>
    </div>
  );
}
