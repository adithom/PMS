// src/components/PropertyForm.tsx
import { useState, useEffect } from 'react';
import type { Property } from '../types';

interface PropertyFormProps {
  property: Property | null; // null = create, non-null = edit
  onSave: (data: Partial<Property>) => Promise<void>;
  onCancel: () => void;
}

export default function PropertyForm({ property, onSave, onCancel }: PropertyFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    region: '',
    country: 'IN',
    postalCode: '',
    phone: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Populate form if editing
  useEffect(() => {
    if (property) {
      setFormData({
        name: property.name,
        code: property.code,
        address: property.address || '',
        region: '', // Not in your DTO, but in backend
        country: property.country,
        postalCode: '',
        phone: '',
      });
    }
  }, [property]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Property name is required';
    }

    if (!formData.code.trim()) {
      newErrors.code = 'Property code is required';
    } else if (formData.code.length < 2) {
      newErrors.code = 'Code must be at least 2 characters';
    }

    if (!formData.country.trim()) {
      newErrors.country = 'Country is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setSubmitting(true);
    try {
      await onSave(formData);
      // Parent will close modal on success
    } catch (err) {
      setErrors({ submit: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{property ? 'Edit Property' : 'Create Property'}</h2>
          <button onClick={onCancel} className="modal-close">×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Name */}
            <div className="form-group">
              <label className="form-label">
                Property Name <span style={{ color: 'var(--danger-color)' }}>*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="form-input"
                placeholder="Grand Hotel"
                disabled={submitting}
              />
              {errors.name && <div className="form-error">{errors.name}</div>}
            </div>

            {/* Code */}
            <div className="form-group">
              <label className="form-label">
                Property Code <span style={{ color: 'var(--danger-color)' }}>*</span>
              </label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleChange}
                className="form-input"
                placeholder="GH001"
                disabled={submitting || !!property} // Can't edit code
                style={{ textTransform: 'uppercase' }}
              />
              {errors.code && <div className="form-error">{errors.code}</div>}
              {property && (
                <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', marginTop: '0.25rem' }}>
                  Property code cannot be changed
                </div>
              )}
            </div>

            {/* Address */}
            <div className="form-group">
              <label className="form-label">Address</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="form-input"
                placeholder="123 Main Street"
                disabled={submitting}
              />
            </div>

            {/* Region & Country in same row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Region/State</label>
                <input
                  type="text"
                  name="region"
                  value={formData.region}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Kerala"
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Country <span style={{ color: 'var(--danger-color)' }}>*</span>
                </label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="IN"
                  disabled={submitting}
                  maxLength={2}
                  style={{ textTransform: 'uppercase' }}
                />
                {errors.country && <div className="form-error">{errors.country}</div>}
              </div>
            </div>

            {/* Postal Code & Phone */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Postal Code</label>
                <input
                  type="text"
                  name="postalCode"
                  value={formData.postalCode}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="682001"
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="+91-9876543210"
                  disabled={submitting}
                />
              </div>
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div style={{ 
                padding: '0.75rem', 
                background: '#fee2e2', 
                color: '#991b1b',
                borderRadius: 'var(--border-radius)',
                fontSize: '0.875rem'
              }}>
                {errors.submit}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-secondary"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : property ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}