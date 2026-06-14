import { useState, useEffect } from 'react';
import type { Property } from '../types';

/* ────────────────────────────────────────────────────────────── */
/* Tokens & Styles                                              */
/* ────────────────────────────────────────────────────────────── */
const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const btnSecondary = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed uppercase-placeholder';
const labelCls = 'mb-1.5 block text-sm font-medium text-slate-700';
const sectionLabel = 'mb-3 mt-5 text-xs font-semibold uppercase tracking-wider text-slate-400';

interface PropertyFormProps {
  property: Property | null; // null = create, non-null = edit
  onSave: (data: Partial<Property>) => Promise<void>;
  onCancel: () => void;
}

const emptyForm = {
  name: '',
  code: '',
  address: '',
  addressLine2: '',
  region: '',
  country: 'IN',
  postalCode: '',
  phone: '',
  checkInTime: '',
  checkOutTime: '',
  gstNumber: '',
  pan: '',
  cin: '',
  stateName: '',
  stateCode: '',
  udyamRegistrationNo: '',
  fssaiNumber: '',
};

export default function PropertyForm({ property, onSave, onCancel }: PropertyFormProps) {
  const [formData, setFormData] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (property) {
      setFormData({
        name: property.name ?? '',
        code: property.code ?? '',
        address: property.address ?? '',
        addressLine2: property.addressLine2 ?? '',
        region: property.region ?? '',
        country: property.country ?? 'IN',
        postalCode: property.postalCode ?? '',
        phone: property.phone ?? '',
        checkInTime: property.checkInTime ?? '',
        checkOutTime: property.checkOutTime ?? '',
        gstNumber: property.gstNumber ?? '',
        pan: property.pan ?? '',
        cin: property.cin ?? '',
        stateName: property.stateName ?? '',
        stateCode: property.stateCode ?? '',
        udyamRegistrationNo: property.udyamRegistrationNo ?? '',
        fssaiNumber: property.fssaiNumber ?? '',
      });
    }
  }, [property]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Property name is required';
    if (!formData.code.trim()) {
      newErrors.code = 'Property code is required';
    } else if (formData.code.length < 2) {
      newErrors.code = 'Code must be at least 2 characters';
    }
    if (!formData.country.trim()) newErrors.country = 'Country is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSave(formData);
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

      {/* ── Basic info ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={labelCls}>Property Name *</span>
          <input type="text" name="name" value={formData.name} onChange={handleChange} disabled={submitting} placeholder="e.g. Grand Hotel" className={inputCls} />
          {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name}</p>}
        </label>

        <label>
          <span className={labelCls}>Property Code *</span>
          <input type="text" name="code" value={formData.code} onChange={handleChange} disabled={submitting || !!property} placeholder="GH001" className={`${inputCls} uppercase`} />
          {errors.code ? (
            <p className="mt-1 text-xs text-rose-500">{errors.code}</p>
          ) : property ? (
            <p className="mt-1 text-[10px] text-slate-400">Property code cannot be changed.</p>
          ) : null}
        </label>
      </div>

      <label>
        <span className={labelCls}>Address Line 1</span>
        <input type="text" name="address" value={formData.address} onChange={handleChange} disabled={submitting} placeholder="123 Main Street" className={inputCls} />
      </label>

      <label>
        <span className={labelCls}>Address Line 2</span>
        <input type="text" name="addressLine2" value={formData.addressLine2} onChange={handleChange} disabled={submitting} placeholder="Village, Landmark" className={inputCls} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={labelCls}>Region / State</span>
          <input type="text" name="region" value={formData.region} onChange={handleChange} disabled={submitting} placeholder="Kerala" className={inputCls} />
        </label>

        <label>
          <span className={labelCls}>Country *</span>
          <input type="text" name="country" value={formData.country} onChange={handleChange} disabled={submitting} placeholder="IN" maxLength={2} className={`${inputCls} uppercase`} />
          {errors.country && <p className="mt-1 text-xs text-rose-500">{errors.country}</p>}
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={labelCls}>Postal Code</span>
          <input type="text" name="postalCode" value={formData.postalCode} onChange={handleChange} disabled={submitting} placeholder="682001" className={inputCls} />
        </label>

        <label>
          <span className={labelCls}>Phone</span>
          <input type="tel" name="phone" value={formData.phone} onChange={handleChange} disabled={submitting} placeholder="+91-9876543210" className={inputCls} />
        </label>
      </div>

      {/* ── Operational ── */}
      <p className={sectionLabel}>Operational</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={labelCls}>Check-in Time</span>
          <input type="time" name="checkInTime" value={formData.checkInTime} onChange={handleChange} disabled={submitting} className={inputCls} />
        </label>

        <label>
          <span className={labelCls}>Check-out Time</span>
          <input type="time" name="checkOutTime" value={formData.checkOutTime} onChange={handleChange} disabled={submitting} className={inputCls} />
        </label>
      </div>

      {/* ── Compliance / Registration ── */}
      <p className={sectionLabel}>Compliance &amp; Registration</p>

      <label>
        <span className={labelCls}>GST Number</span>
        <input type="text" name="gstNumber" value={formData.gstNumber} onChange={handleChange} disabled={submitting} placeholder="22AAAAA0000A1Z5" className={`${inputCls} uppercase`} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={labelCls}>PAN</span>
          <input type="text" name="pan" value={formData.pan} onChange={handleChange} disabled={submitting} placeholder="AAAAA0000A" maxLength={10} className={`${inputCls} uppercase`} />
        </label>

        <label>
          <span className={labelCls}>CIN</span>
          <input type="text" name="cin" value={formData.cin} onChange={handleChange} disabled={submitting} placeholder="U55101KL2000PTC012345" maxLength={21} className={`${inputCls} uppercase`} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={labelCls}>State Name</span>
          <input type="text" name="stateName" value={formData.stateName} onChange={handleChange} disabled={submitting} placeholder="Kerala" className={inputCls} />
        </label>

        <label>
          <span className={labelCls}>State Code</span>
          <input type="text" name="stateCode" value={formData.stateCode} onChange={handleChange} disabled={submitting} placeholder="32" maxLength={4} className={inputCls} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={labelCls}>Udyam Registration No.</span>
          <input type="text" name="udyamRegistrationNo" value={formData.udyamRegistrationNo} onChange={handleChange} disabled={submitting} placeholder="UDYAM-KL-00-0000000" maxLength={30} className={`${inputCls} uppercase`} />
        </label>

        <label>
          <span className={labelCls}>FSSAI Number</span>
          <input type="text" name="fssaiNumber" value={formData.fssaiNumber} onChange={handleChange} disabled={submitting} placeholder="12345678901234" maxLength={20} className={inputCls} />
        </label>
      </div>

      <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
        <button type="button" onClick={onCancel} className={btnSecondary} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className={btnPrimary} disabled={submitting}>
          {submitting ? 'Saving...' : property ? 'Update Property' : 'Create Property'}
        </button>
      </div>
    </form>
  );
}
