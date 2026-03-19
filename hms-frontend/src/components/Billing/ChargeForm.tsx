import { useState } from 'react';
import folioApi from '../../api/folioApi';
import type { ChargeCreationDto } from '../../api/folioApi';

/* ────────────────────────────────────────────────────────────── */
/* Tokens & Styles                                              */
/* ────────────────────────────────────────────────────────────── */
const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const btnSecondary = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed';
const labelCls = 'mb-1.5 block text-sm font-medium text-slate-700';

interface ChargeFormProps {
  propertyId: string;
  folioId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ChargeForm({ propertyId, folioId, onSuccess, onCancel }: ChargeFormProps) {
  const [formData, setFormData] = useState<Partial<ChargeCreationDto>>({
    chargeCode: 'MISC',
    chargeDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    description: '',
    unitPrice: 0,
    quantity: 1,
    taxRate: 0, // e.g., 18 for 18%
    notes: ''
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.unitPrice || formData.unitPrice <= 0) {
      setError('Unit price must be greater than 0');
      return;
    }

    setSubmitting(true);
    try {
      await folioApi.addCharge(propertyId, folioId, formData as ChargeCreationDto);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to post charge');
    } finally {
      setSubmitting(false);
    }
  };

  // Live Math for Agent Preview
  const quantity = formData.quantity || 1;
  const unitPrice = formData.unitPrice || 0;
  const taxRate = formData.taxRate || 0;
  const subtotal = unitPrice * quantity;
  const taxAmount = subtotal * (taxRate / 100);
  const totalAmount = subtotal + taxAmount;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={labelCls}>Charge Code *</span>
          <select name="chargeCode" value={formData.chargeCode} onChange={handleChange} disabled={submitting} className={inputCls} required>
            <option value="ROOM_RENT">Room Rent</option>
            <option value="RESTAURANT">Restaurant / F&B</option>
            <option value="LAUNDRY">Laundry</option>
            <option value="SPA">Spa & Wellness</option>
            <option value="TRAVEL_DESK">Travel Desk</option>
            <option value="SHOP">Gift Shop</option>
            <option value="MISC">Miscellaneous</option>
          </select>
        </label>

        <label>
          <span className={labelCls}>Date *</span>
          <input type="date" name="chargeDate" value={formData.chargeDate} onChange={handleChange} disabled={submitting} className={inputCls} required />
        </label>
      </div>

      <label>
        <span className={labelCls}>Description</span>
        <input type="text" name="description" value={formData.description} onChange={handleChange} disabled={submitting} placeholder="e.g. Extra Bed, Airport Transfer" className={inputCls} required />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label>
          <span className={labelCls}>Unit Price *</span>
          <input type="number" name="unitPrice" value={formData.unitPrice || ''} onChange={handleChange} disabled={submitting} min="0.01" step="0.01" className={inputCls} required />
        </label>
        <label>
          <span className={labelCls}>Qty *</span>
          <input type="number" name="quantity" value={formData.quantity} onChange={handleChange} disabled={submitting} min="1" step="1" className={inputCls} required />
        </label>
        <label>
          <span className={labelCls}>Tax Rate (%)</span>
          <input type="number" name="taxRate" value={formData.taxRate || ''} onChange={handleChange} disabled={submitting} min="0" max="100" step="0.1" className={inputCls} />
        </label>
      </div>

      <label>
        <span className={labelCls}>Internal Notes</span>
        <textarea name="notes" value={formData.notes} onChange={handleChange} disabled={submitting} rows={2} placeholder="Optional notes..." className={inputCls} />
      </label>

      {/* Live Total Preview */}
      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
        <div className="flex justify-between text-sm text-slate-500">
          <span>Subtotal</span>
          <span>{subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-slate-500">
          <span>Taxes</span>
          <span>{taxAmount.toFixed(2)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
          <span>Total to Post</span>
          <span>{totalAmount.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
        <button type="button" onClick={onCancel} className={btnSecondary} disabled={submitting}>Cancel</button>
        <button type="submit" className={btnPrimary} disabled={submitting}>{submitting ? 'Posting...' : 'Post Charge'}</button>
      </div>
    </form>
  );
}