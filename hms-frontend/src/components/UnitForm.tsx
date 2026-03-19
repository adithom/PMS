import { useState, useEffect } from 'react';
import type { UnitDto } from '../types';

/* ────────────────────────────────────────────────────────────── */
/* Tokens & Styles                                              */
/* ────────────────────────────────────────────────────────────── */
const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const btnSecondary = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed';
const labelCls = 'mb-1.5 block text-sm font-medium text-slate-700';

interface UnitFormProps {
  propertyId: string;
  unit: UnitDto | null; // null = create mode, non-null = edit mode
  onSave: (data: { name: string; sortOrder: number }) => Promise<void>;
  onCancel: () => void;
}

export default function UnitForm({ propertyId, unit, onSave, onCancel }: UnitFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    sortOrder: 0,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Populate form if editing
  useEffect(() => {
    if (unit) {
      setFormData({
        name: unit.name,
        sortOrder: unit.sortOrder ?? 0,
      });
    } else {
      setFormData({ name: '', sortOrder: 0 });
    }
  }, [unit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value,
    }));
    
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Unit name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Unit name must be at least 2 characters';
    }

    if (formData.sortOrder < 0) {
      newErrors.sortOrder = 'Sort order cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await onSave({
        name: formData.name.trim(),
        sortOrder: formData.sortOrder,
      });
    } catch (err: any) {
      setErrors({ submit: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.submit && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {errors.submit}
        </div>
      )}

      <label>
        <span className={labelCls}>Unit Name *</span>
        <input type="text" name="name" value={formData.name} onChange={handleChange} disabled={submitting} placeholder="e.g. Tower 1, Main Building" className={inputCls} />
        {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name}</p>}
      </label>

      <label>
        <span className={labelCls}>Sort Order</span>
        <input type="number" name="sortOrder" value={formData.sortOrder} onChange={handleChange} disabled={submitting} min="0" step="1" className={inputCls} />
        {errors.sortOrder ? (
          <p className="mt-1 text-xs text-rose-500">{errors.sortOrder}</p>
        ) : (
          <p className="mt-1 text-[10px] text-slate-400">Lower numbers appear first in lists (0 = first)</p>
        )}
      </label>

      <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
        <button type="button" onClick={onCancel} className={btnSecondary} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className={btnPrimary} disabled={submitting}>
          {submitting ? 'Saving...' : unit ? 'Update Unit' : 'Create Unit'}
        </button>
      </div>
    </form>
  );
}