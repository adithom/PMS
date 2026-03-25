import { useState, useEffect } from 'react';
import type { Guest } from '../types';

/* ────────────────────────────────────────────────────────────── */
/* Tokens & Styles                                              */
/* ────────────────────────────────────────────────────────────── */
const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const btnSecondary = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed';
const labelCls = 'mb-1.5 block text-sm font-medium text-slate-700';

interface GuestFormProps {
  guest: Guest | null;
  onSave: (data: Partial<Guest>) => Promise<void>;
  onCancel: () => void;
}

export default function GuestForm({ guest, onSave, onCancel }: GuestFormProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    docId: '',
    dateOfBirth: '',
    preferences: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (guest) {
      setFormData({
        firstName: guest.firstName,
        lastName: guest.lastName,
        email: guest.email || '',
        phone: guest.phone || '',
        docId: guest.docId || '',
        preferences: guest.preferences || ''
      });
    }
  }, [guest]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      // Only send non-empty optional fields
      const payload: any = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
      };

      if (formData.email.trim()) payload.email = formData.email.trim();
      if (formData.phone.trim()) payload.phone = formData.phone.trim();
      if (formData.docId.trim()) payload.docId = formData.docId.trim();
      if (formData.preferences.trim()) payload.preferences = formData.preferences.trim();

      await onSave(payload);
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

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={labelCls}>First Name *</span>
          <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} disabled={submitting} placeholder="e.g. John" className={inputCls} />
          {errors.firstName && <p className="mt-1 text-xs text-rose-500">{errors.firstName}</p>}
        </label>

        <label>
          <span className={labelCls}>Last Name *</span>
          <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} disabled={submitting} placeholder="e.g. Doe" className={inputCls} />
          {errors.lastName && <p className="mt-1 text-xs text-rose-500">{errors.lastName}</p>}
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={labelCls}>Email</span>
          <input type="email" name="email" value={formData.email} onChange={handleChange} disabled={submitting} placeholder="john@example.com" className={inputCls} />
          {errors.email && <p className="mt-1 text-xs text-rose-500">{errors.email}</p>}
        </label>

        <label>
          <span className={labelCls}>Phone</span>
          <input type="tel" name="phone" value={formData.phone} onChange={handleChange} disabled={submitting} placeholder="+91-9876543210" className={inputCls} />
        </label>
      </div>

      <label>
        <span className={labelCls}>Document ID</span>
        <input type="text" name="docId" value={formData.docId} onChange={handleChange} disabled={submitting} placeholder="e.g. DL123456" className={inputCls} />
        <p className="mt-1 text-[10px] text-slate-400">Driver's License, Passport, or National ID</p>
      </label>

      <label>
        <span className={labelCls}>Preferences</span>
        <textarea name="preferences" value={formData.preferences} onChange={handleChange} disabled={submitting} rows={3} placeholder="e.g., Ground floor room, vegetarian meals..." className={inputCls} />
        <p className="mt-1 text-[10px] text-slate-400">Guest preferences and special requirements</p>
      </label>

      <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
        <button type="button" onClick={onCancel} className={btnSecondary} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className={btnPrimary} disabled={submitting}>
          {submitting ? 'Saving...' : guest ? 'Update Guest' : 'Create Guest'}
        </button>
      </div>
    </form>
  );
}