import { useState, useEffect } from 'react';
import paymentApi from '../../api/paymentApi';
import type { PaymentCreationDto } from '../../api/paymentApi';

/* ────────────────────────────────────────────────────────────── */
/* Tokens & Styles                                              */
/* ────────────────────────────────────────────────────────────── */
const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const btnSecondary = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed';
const labelCls = 'mb-1.5 block text-sm font-medium text-slate-700';

interface PaymentFormProps {
  propertyId: string;
  folioId: string;
  balanceDue?: number; // Pre-fill amount
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PaymentForm({ propertyId, folioId, balanceDue = 0, onSuccess, onCancel }: PaymentFormProps) {
  const [formData, setFormData] = useState<Partial<PaymentCreationDto>>({
    amount: balanceDue > 0 ? balanceDue : 0,
    paymentMethod: 'CREDIT_CARD',
  });
  
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auto-clear irrelevant fields if payment method changes
  useEffect(() => {
    if (formData.paymentMethod === 'CASH') {
      setFormData(prev => ({ ...prev, cardLastFour: '', transactionId: '', upiId: '', bankName: '', referenceNumber: '' }));
    }
  }, [formData.paymentMethod]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? undefined : parseFloat(value)) : value
    }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || formData.amount <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    setSubmitting(true);
    try {
      await paymentApi.recordPayment(propertyId, folioId, formData as PaymentCreationDto);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to process payment');
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

      {/* Massive Amount Input to prevent typos */}
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
        <label>
          <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-emerald-700">Payment Amount *</span>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">₹</span>
            <input 
              type="number" 
              name="amount" 
              value={formData.amount || ''} 
              onChange={handleChange} 
              disabled={submitting} 
              min="0.01" 
              step="0.01" 
              className="w-full rounded-lg border-2 border-emerald-200 bg-white py-3 pl-10 pr-4 text-2xl font-extrabold text-slate-900 shadow-sm outline-none focus:border-emerald-500 focus:ring-0" 
              required 
            />
          </div>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={labelCls}>Method *</span>
          <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange} disabled={submitting} className={inputCls} required>
            <option value="CASH">Cash</option>
            <option value="CREDIT_CARD">Credit Card</option>
            <option value="DEBIT_CARD">Debit Card</option>
            <option value="UPI">UPI / QR Code</option>
            <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
          </select>
        </label>

      </div>

      {/* Conditional Fields based on Payment Method */}
      {(formData.paymentMethod === 'CREDIT_CARD' || formData.paymentMethod === 'DEBIT_CARD') && (
        <div className="grid gap-4 sm:grid-cols-2 rounded-lg border border-slate-100 bg-slate-50 p-4">
          <label>
            <span className={labelCls}>Card Last 4</span>
            <input type="text" name="cardLastFour" value={formData.cardLastFour || ''} onChange={handleChange} disabled={submitting} placeholder="e.g. 4242" maxLength={4} className={inputCls} />
          </label>
          <label>
            <span className={labelCls}>Transaction ID</span>
            <input type="text" name="transactionId" value={formData.transactionId || ''} onChange={handleChange} disabled={submitting} placeholder="EDC Auth Code" className={inputCls} />
          </label>
        </div>
      )}

      {formData.paymentMethod === 'UPI' && (
        <div className="grid gap-4 sm:grid-cols-2 rounded-lg border border-slate-100 bg-slate-50 p-4">
          <label>
            <span className={labelCls}>UPI ID</span>
            <input type="text" name="upiId" value={formData.upiId || ''} onChange={handleChange} disabled={submitting} placeholder="e.g. guest@okhdfc" className={inputCls} />
          </label>
          <label>
            <span className={labelCls}>Transaction Ref</span>
            <input type="text" name="transactionId" value={formData.transactionId || ''} onChange={handleChange} disabled={submitting} placeholder="UTR Number" className={inputCls} />
          </label>
        </div>
      )}

      {formData.paymentMethod === 'BANK_TRANSFER' && (
        <div className="grid gap-4 sm:grid-cols-2 rounded-lg border border-slate-100 bg-slate-50 p-4">
          <label>
            <span className={labelCls}>Bank Name</span>
            <input type="text" name="bankName" value={formData.bankName || ''} onChange={handleChange} disabled={submitting} placeholder="e.g. SBI" className={inputCls} />
          </label>
          <label>
            <span className={labelCls}>Reference Number</span>
            <input type="text" name="referenceNumber" value={formData.referenceNumber || ''} onChange={handleChange} disabled={submitting} placeholder="NEFT/RTGS UTR" className={inputCls} />
          </label>
        </div>
      )}

      <label>
        <span className={labelCls}>Notes</span>
        <input type="text" name="notes" value={formData.notes || ''} onChange={handleChange} disabled={submitting} placeholder="Optional notes..." className={inputCls} />
      </label>

      <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
        <button type="button" onClick={onCancel} className={btnSecondary} disabled={submitting}>Cancel</button>
        <button type="submit" className={btnPrimary} disabled={submitting}>{submitting ? 'Processing...' : 'Record Payment'}</button>
      </div>
    </form>
  );
}