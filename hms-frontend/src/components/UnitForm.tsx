// src/components/UnitForm.tsx
import { useState, useEffect } from 'react';

import type { UnitDto } from '../types';

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
      // Reset for create mode
      setFormData({
        name: '',
        sortOrder: 0,
      });
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
      // Parent will close modal on success
    } catch (err) {
      const errorMessage = (err as Error).message;
      setErrors({ submit: errorMessage });
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
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '12px',
          minWidth: '450px',
          maxWidth: '500px',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
        }}
      >
        <div 
          className="modal-header"
          style={{
            padding: '1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600' }}>
            {unit ? 'Edit Unit' : 'Create Unit'}
          </h2>
          <button 
            onClick={onCancel} 
            className="modal-close"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#64748b',
              padding: '0.25rem',
              lineHeight: 1,
            }}
            disabled={submitting}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div 
            className="modal-body"
            style={{
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            {/* Unit Name */}
            <div className="form-group">
              <label 
                className="form-label"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '500',
                  fontSize: '0.875rem',
                  color: '#0f172a',
                }}
              >
                Unit Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="form-input"
                placeholder="Building A, Tower 1, etc."
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
              {errors.name && (
                <div 
                  className="form-error"
                  style={{
                    marginTop: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#dc2626',
                  }}
                >
                  {errors.name}
                </div>
              )}
            </div>

            {/* Sort Order */}
            <div className="form-group">
              <label 
                className="form-label"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '500',
                  fontSize: '0.875rem',
                  color: '#0f172a',
                }}
              >
                Sort Order
              </label>
              <input
                type="number"
                name="sortOrder"
                value={formData.sortOrder}
                onChange={handleChange}
                className="form-input"
                placeholder="0"
                disabled={submitting}
                min="0"
                step="1"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
              <div 
                style={{ 
                  fontSize: '0.75rem', 
                  color: '#64748b', 
                  marginTop: '0.25rem' 
                }}
              >
                Lower numbers appear first in lists (0 = first)
              </div>
              {errors.sortOrder && (
                <div 
                  className="form-error"
                  style={{
                    marginTop: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#dc2626',
                  }}
                >
                  {errors.sortOrder}
                </div>
              )}
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div 
                style={{ 
                  padding: '0.75rem', 
                  background: '#fee2e2', 
                  color: '#991b1b',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                }}
              >
                {errors.submit}
              </div>
            )}
          </div>

          <div 
            className="modal-footer"
            style={{
              padding: '1.5rem',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
            }}
          >
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-secondary"
              disabled={submitting}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'white',
                color: '#475569',
                border: '2px solid #e2e8f0',
                borderRadius: '6px',
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                fontWeight: '500',
                transition: 'all 0.2s',
                opacity: submitting ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{
                padding: '0.75rem 1.5rem',
                background: submitting ? '#94a3b8' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                fontWeight: '500',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!submitting) e.currentTarget.style.background = '#1d4ed8';
              }}
              onMouseLeave={(e) => {
                if (!submitting) e.currentTarget.style.background = '#2563eb';
              }}
            >
              {submitting ? 'Saving...' : unit ? 'Update Unit' : 'Create Unit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}