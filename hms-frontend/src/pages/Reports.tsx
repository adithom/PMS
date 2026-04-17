import { useState } from 'react';
import UpcomingFeature from '../components/UpcomingFeature';
import NightAuditModal from '../components/NightAuditModal';

export default function Reports() {
  const [auditOpen, setAuditOpen] = useState(false);

  return (
    <div className="relative">
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={() => setAuditOpen(true)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:border-slate-300"
        >
          Run Night Audit
        </button>
      </div>

      <UpcomingFeature title="Reports is under construction." />

      {auditOpen && <NightAuditModal onClose={() => setAuditOpen(false)} />}
    </div>
  );
}
