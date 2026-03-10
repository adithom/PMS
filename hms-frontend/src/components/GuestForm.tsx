// src/components/GuestForm.tsx
import { useState, useEffect } from 'react';
import type { Guest } from '../types';

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
        preferences: (guest as any).preferences || ''
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

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

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
    } catch (err) {
      setErrors({ submit: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div 
      className="modal-overlay"
      onClick={onCancel}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '12px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
        }}
      >
        {/* Header */}
        <div className="modal-header" style={{
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>
            {guest ? 'Edit Guest' : 'Add Guest'}
          </h2>
          <button
            onClick={onCancel}
            className="modal-close"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '0.25rem',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ 
          padding: '1.5rem', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1rem' 
        }}>
          {/* First Name */}
          <div className="form-group">
            <label className="form-label" style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#374151'
            }}>
              First Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              placeholder="John"
              disabled={submitting}
              className="form-input"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem',
                outline: 'none'
              }}
            />
            {errors.firstName && (
              <div className="form-error" style={{ 
                color: '#dc2626', 
                fontSize: '0.875rem', 
                marginTop: '0.25rem' 
              }}>
                {errors.firstName}
              </div>
            )}
          </div>

          {/* Last Name */}
          <div className="form-group">
            <label className="form-label" style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#374151'
            }}>
              Last Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Doe"
              disabled={submitting}
              className="form-input"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem',
                outline: 'none'
              }}
            />
            {errors.lastName && (
              <div className="form-error" style={{ 
                color: '#dc2626', 
                fontSize: '0.875rem', 
                marginTop: '0.25rem' 
              }}>
                {errors.lastName}
              </div>
            )}
          </div>

          {/* Email */}
          <div className="form-group">
            <label className="form-label" style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#374151'
            }}>
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="john@example.com"
              disabled={submitting}
              className="form-input"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem',
                outline: 'none'
              }}
            />
            {errors.email && (
              <div className="form-error" style={{ 
                color: '#dc2626', 
                fontSize: '0.875rem', 
                marginTop: '0.25rem' 
              }}>
                {errors.email}
              </div>
            )}
          </div>

          {/* Phone */}
          <div className="form-group">
            <label className="form-label" style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#374151'
            }}>
              Phone
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+91-9876543210"
              disabled={submitting}
              className="form-input"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem',
                outline: 'none'
              }}
            />
          </div>

          {/* Document ID */}
          <div className="form-group">
            <label className="form-label" style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#374151'
            }}>
              Document ID
            </label>
            <input
              type="text"
              name="docId"
              value={formData.docId}
              onChange={handleChange}
              placeholder="DL123456"
              disabled={submitting}
              className="form-input"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem',
                outline: 'none'
              }}
            />
            <div style={{ 
              fontSize: '0.75rem', 
              color: '#6b7280', 
              marginTop: '0.25rem' 
            }}>
              e.g., Driver's License, Passport, National ID
            </div>
          </div>

          {/* Preferences */}
          <div className="form-group">
            <label className="form-label" style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#374151'
            }}>
              Preferences
            </label>
            <textarea
              name="preferences"
              value={formData.preferences}
              onChange={handleChange}
              placeholder="e.g., Ground floor room, vegetarian meals, extra pillows"
              disabled={submitting}
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem',
                outline: 'none',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
            <div style={{ 
              fontSize: '0.75rem', 
              color: '#6b7280', 
              marginTop: '0.25rem' 
            }}>
              Guest preferences and special requirements
            </div>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div style={{
              padding: '0.75rem',
              background: '#fee2e2',
              color: '#991b1b',
              borderRadius: '6px',
              fontSize: '0.875rem'
            }}>
              {errors.submit}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{
          padding: '1.5rem',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: '0.75rem',
          justifyContent: 'flex-end'
        }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="btn btn-secondary"
            style={{
              padding: '0.75rem 1.5rem',
              background: 'white',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting}
            className="btn btn-primary"
            style={{
              padding: '0.75rem 1.5rem',
              background: submitting ? '#93c5fd' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500
            }}
          >
            {submitting ? 'Saving...' : guest ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}