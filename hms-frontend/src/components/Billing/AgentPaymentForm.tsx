import { useState } from 'react';
import paymentApi from '../../api/paymentApi';

const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const btnSecondary = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed';
const labelCls = 'mb-1.5 block text-sm font-medium text-slate-700';

interface AgentPaymentFormProps {
  propertyId: string;
  folioId: string;
  travelAgentId: string;
  travelAgentName: string;
  balanceDue?: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AgentPaymentForm({
  propertyId,
  folioId,
  travelAgentId,
  travelAgentName,
  balanceDue = 0,
  onSuccess,
  onCancel,
}: AgentPaymentFormProps) {
  const [amount, setAmount] = useState<string>(balanceDue > 0 ? String(balanceDue) : '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!amount || numAmount <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    setSubmitting(true);
    try {
      await paymentApi.recordPayment(propertyId, folioId, {
        amount: numAmount,
        paymentMethod: 'AGENT_BILLING',
        travelAgentId,
        notes: notes || `Assigned to agent: ${travelAgentName}`,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to assign payment to agent');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {/* Agent info banner */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-700">Travel Agent</p>
        <p className="mt-0.5 text-base font-semibold text-slate-900">{travelAgentName}</p>
      </div>

      {/* Amount */}
      <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
        <label>
          <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-amber-700">Amount to Assign *</span>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">₹</span>
            <input
              type="number"
              value={amount}
              onChange={e => { setAmount(e.target.value); setError(''); }}
              disabled={submitting}
              min="0.01"
              step="0.01"
              className="w-full rounded-lg border-2 border-amber-200 bg-white py-3 pl-10 pr-4 text-2xl font-extrabold text-slate-900 shadow-sm outline-none focus:border-amber-500 focus:ring-0"
              required
            />
          </div>
        </label>
      </div>

      {/* Notes */}
      <label>
        <span className={labelCls}>Notes</span>
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          disabled={submitting}
          placeholder="Optional notes..."
          className={inputCls}
        />
      </label>

      <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
        <button type="button" onClick={onCancel} className={btnSecondary} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className={btnPrimary} disabled={submitting}>
          {submitting ? 'Assigning...' : 'Assign to Agent'}
        </button>
      </div>
    </form>
  );
}
