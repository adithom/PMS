// src/pages/Properties.tsx
import { useState, useEffect } from 'react';
import propertyApi from '../api/propertyApi';
import unitApi from '../api/unitApi';
import type { Property, UnitDto } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import PropertyForm from '../components/PropertyForm';
import UnitForm from '../components/UnitForm';
import ConfirmDialog from '../components/ConfirmDialog';
import './Properties.css';

export default function Properties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Property | null>(null);

  // Property detail modal states
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [propertyUnits, setPropertyUnits] = useState<UnitDto[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);

  // Unit form states
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitDto | null>(null);

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await propertyApi.getAll();
      setProperties(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadPropertyUnits = async (propertyId: string) => {
    setLoadingUnits(true);
    try {
      const units = await propertyApi.getUnits(propertyId);
      setPropertyUnits(units);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingUnits(false);
    }
  };

  const handlePropertyClick = async (property: Property) => {
    setSelectedProperty(property);
    await loadPropertyUnits(property.id);
  };

  const handleCreateProperty = () => {
    setEditingProperty(null);
    setShowPropertyForm(true);
  };

  const handleEditProperty = (property: Property) => {
    setEditingProperty(property);
    setShowPropertyForm(true);
  };

  const handleSaveProperty = async (data: Partial<Property>) => {
    if (editingProperty) {
      await propertyApi.update(editingProperty.id, data);
    } else {
      await propertyApi.create(data);
    }
    setShowPropertyForm(false);
    setEditingProperty(null);
    loadProperties();
  };

  const handleDeleteProperty = async () => {
    if (!deleteConfirm) return;

    try {
      await propertyApi.delete(deleteConfirm.id);
      setDeleteConfirm(null);
      setSelectedProperty(null);
      loadProperties();
    } catch (err) {
      alert(`Failed to delete: ${(err as Error).message}`);
    }
  };

  const handleCreateUnit = () => {
    setEditingUnit(null);
    setShowUnitForm(true);
  };

  const handleEditUnit = (unit: UnitDto) => {
    setEditingUnit(unit);
    setShowUnitForm(true);
  };

  const handleSaveUnit = async (data: { name: string; sortOrder: number }) => {
    if (!selectedProperty) return;

    if (editingUnit) {
      await unitApi.partialUpdate(selectedProperty.id, editingUnit.id, data);
    } else {
      await unitApi.create(selectedProperty.id, data);
    }
    setShowUnitForm(false);
    setEditingUnit(null);
    await loadPropertyUnits(selectedProperty.id);
  };

  const filteredProperties = properties.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={loadProperties} />;

  return (
    <div className="properties-container">
      {/* Header */}
      <div className="properties-header">
        <h1 className="properties-title">Properties</h1>
        <button
          onClick={handleCreateProperty}
          className="btn btn-primary"
        >
          + Add Property
        </button>
      </div>

      {/* Search Bar */}
      <div className="search-container">
        <input
          type="text"
          placeholder="Search properties..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input"
        />
      </div>

      {/* Properties Grid */}
      <div className="properties-grid">
        {filteredProperties.map((property) => (
          <div
            key={property.code}
            onClick={() => handlePropertyClick(property)}
            className="property-card"
          >
            <div className="property-card-header">
              <div>
                <h3 className="property-name">{property.name}</h3>
                <div className="property-details">
                  <span className="property-detail-item">Code: {property.code}</span>
                  <span className="property-detail-item">•</span>
                  <span className="property-detail-item">{property.country}</span>
                  <span className="property-detail-item">•</span>
                  <span className="property-detail-item">{property.totalRooms} Rooms</span>
                </div>
              </div>
              <div className="arrow-icon">→</div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredProperties.length === 0 && (
        <div className="empty-state">
          <p>
            {searchQuery ? 'No properties match your search' : 'No properties found'}
          </p>
        </div>
      )}

      {/* Property Detail Modal */}
      {selectedProperty && (
        <div className="modal-overlay" onClick={() => {
          setSelectedProperty(null);
          setPropertyUnits([]);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="modal-header">
              <div>
                <h2 className="modal-title">{selectedProperty.name}</h2>
                <div className="modal-subtitle">{selectedProperty.code}</div>
              </div>
              <button
                onClick={() => {
                  setSelectedProperty(null);
                  setPropertyUnits([]);
                }}
                className="close-btn"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="modal-body">
              {/* Property Information */}
              <div className="modal-section">
                <h3 className="section-title">Property Information</h3>
                <div className="info-grid">
                  <div>
                    <div className="info-label">Address</div>
                    <div className="info-value">{selectedProperty.address || 'Not specified'}</div>
                  </div>
                  <div>
                    <div className="info-label">Country</div>
                    <div className="info-value">{selectedProperty.country}</div>
                  </div>
                  <div>
                    <div className="info-label">Total Rooms</div>
                    <div className="info-value">{selectedProperty.totalRooms}</div>
                  </div>
                </div>
              </div>

              {/* Units Section */}
              <div>
                <div className="units-header">
                  <h3 className="section-title" style={{ margin: 0 }}>
                    Units ({propertyUnits.length})
                  </h3>
                  <button
                    onClick={handleCreateUnit}
                    className="btn btn-primary"
                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                  >
                    + Add Unit
                  </button>
                </div>

                {loadingUnits ? (
                  <div className="text-center text-muted p-4">Loading units...</div>
                ) : propertyUnits.length === 0 ? (
                  <div className="empty-state" style={{ padding: '2rem' }}>
                    No units created yet
                  </div>
                ) : (
                  <div className="units-list">
                    {propertyUnits.map((unit) => (
                      <div
                        key={unit.id}
                        onClick={() => handleEditUnit(unit)}
                        className="unit-item"
                      >
                        <div>
                          <div className="unit-name">{unit.name}</div>
                          <div className="unit-details">
                            Sort Order: {unit.sortOrder} • Rooms: {unit.totalRooms}
                          </div>
                        </div>
                        <div className="arrow-icon" style={{ fontSize: '1rem' }}>→</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="modal-footer">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditProperty(selectedProperty);
                  setSelectedProperty(null);
                }}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Edit Property
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirm(selectedProperty);
                }}
                className="btn btn-danger"
                style={{ flex: 1 }}
              >
                Delete Property
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Property Form Modal */}
      {showPropertyForm && (
        <PropertyForm
          property={editingProperty}
          onSave={handleSaveProperty}
          onCancel={() => {
            setShowPropertyForm(false);
            setEditingProperty(null);
          }}
        />
      )}

      {/* Unit Form Modal */}
      {showUnitForm && selectedProperty && (
        <UnitForm
          propertyId={selectedProperty.id}
          unit={editingUnit}
          onSave={handleSaveUnit}
          onCancel={() => {
            setShowUnitForm(false);
            setEditingUnit(null);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <ConfirmDialog
          title="Delete Property"
          message={`Are you sure you want to delete "${deleteConfirm.name}"? This action cannot be undone.`}
          onConfirm={handleDeleteProperty}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}