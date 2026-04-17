import { useState } from 'react';
import ModalShell from './ModalShell';
import LoadingSpinner from './LoadingSpinner';
import { runNightAudit, type NightAuditResult } from '../api/nightAuditApi';

type Step = 'confirm' | 'loading' | 'result';

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

interface Props {
  onClose: () => void;
}

export default function NightAuditModal({ onClose }: Props) {
  const [step, setStep] = useState<Step>('confirm');
  const [date, setDate] = useState(yesterday);
  const [result, setResult] = useState<NightAuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (step === 'loading') return;
    onClose();
  }

  async function handleRun() {
    setStep('loading');
    setError(null);
    try {
      const res = await runNightAudit(date);
      setResult(res);
      setStep('result');
    } catch (e: any) {
      setError(e?.message ?? 'An unexpected error occurred.');
      setStep('result');
    }
  }

  const title =
    step === 'confirm' ? 'Run Night Audit' :
    step === 'loading' ? 'Running Night Audit…' :
    'Night Audit Complete';

  const subtitle =
    step === 'confirm' ? 'Post room and meal plan charges for all checked-in guests on the selected date.' :
    step === 'loading' ? `Posting charges for ${date}…` :
    undefined;

  return (
    <ModalShell title={title} subtitle={subtitle} onClose={handleClose}>
      {step === 'confirm' && (
        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Audit date
            </label>
            <input
              type="date"
              value={date}
              max={yesterday()}
              onChange={e => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Already-posted charges are skipped — safe to re-run.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={handleClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleRun}
              disabled={!date}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
            >
              Run Audit
            </button>
          </div>
        </div>
      )}

      {step === 'loading' && (
        <LoadingSpinner text={`Posting charges for ${date}…`} />
      )}

      {step === 'result' && error && (
        <div className="space-y-5">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-semibold text-red-700">Audit failed</p>
            <p className="mt-1 text-sm text-red-600">{error}</p>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {step === 'result' && result && (
        <div className="space-y-5">
          <p className="text-sm font-medium text-slate-500">
            Audit date:{' '}
            <span className="font-semibold text-slate-800">{result.date}</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Room charges posted" value={result.chargesPosted} accent="green" />
            <Stat label="Already posted" value={result.skippedAlreadyPosted} />
            <Stat label="Folio not open" value={result.skippedFolioNotOpen} accent={result.skippedFolioNotOpen > 0 ? 'amber' : undefined} />
            <Stat label="No folio" value={result.skippedNoFolio} accent={result.skippedNoFolio > 0 ? 'amber' : undefined} />
            <Stat label="Meal plan charges posted" value={result.mealPlanChargesPosted} accent="green" />
            <Stat label="Meal plan charges skipped" value={result.mealPlanChargesSkipped} />
            <Stat label="Total assignments" value={result.totalAssignments} />
            <Stat label="Errors" value={result.errors} accent={result.errors > 0 ? 'red' : undefined} />
          </div>
          {result.errors > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Some charges could not be posted. Check server logs for details.
            </div>
          )}
          <div className="flex justify-end">
            <button
              onClick={handleClose}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: 'green' | 'amber' | 'red' }) {
  const valueClass =
    accent === 'green' ? 'text-emerald-700' :
    accent === 'amber' ? 'text-amber-600' :
    accent === 'red' ? 'text-red-600' :
    'text-slate-800';

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}
