import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Pencil } from 'lucide-react';
import propertyApi from '../api/propertyApi';
import unitApi from '../api/unitApi';
import mealPlanApi from '../api/mealPlanApi';
import type { Property, UnitDto, MealPlan, MealPlanType } from '../types';

import LoadingSpinner from '../components/LoadingSpinner';
import ModalShell from '../components/ModalShell';
import PropertyForm from '../components/PropertyForm';
import UnitForm from '../components/UnitForm';

/* ────────────────────────────────────────────────────────────── */
/* Types & Tokens                                               */
/* ────────────────────────────────────────────────────────────── */

type DialogState =
  | { type: 'view_property'; property: Property }
  | { type: 'add_property' }
  | { type: 'edit_property'; property: Property }
  | { type: 'delete_property'; property: Property }
  | { type: 'add_unit'; property: Property }
  | { type: 'edit_unit'; property: Property; unit: UnitDto }
  | null;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const btnDanger =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100';

/* ────────────────────────────────────────────────────────────── */
/* Page Component                                               */
/* ────────────────────────────────────────────────────────────── */

export default function Properties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Unified Dialog & Selection State
  const [dialog, setDialog] = useState<DialogState>(null);
  const [unitsForProperty, setUnitsForProperty] = useState<UnitDto[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [unitsError, setUnitsError] = useState<string | null>(null);

  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loadingMealPlans, setLoadingMealPlans] = useState(false);
  const [editingPlan, setEditingPlan] = useState<{ type: MealPlanType; adultPrice: string; childrenPrice: string } | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);

  /* ═══════════════════════════════════════════════════════════ */
  /* Data Loading                                                */
  /* ═══════════════════════════════════════════════════════════ */

  const loadProperties = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await propertyApi.getAll();
      setProperties(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load properties');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  const loadMealPlans = async (propertyId: string) => {
    setLoadingMealPlans(true);
    try {
      const data = await mealPlanApi.getByProperty(propertyId);
      setMealPlans(data || []);
    } catch {
      setMealPlans([]);
    } finally {
      setLoadingMealPlans(false);
    }
  };

  const loadUnits = async (propertyId: string) => {
    setLoadingUnits(true);
    setUnitsError(null);
    try {
      const units = await propertyApi.getUnits(propertyId);
      setUnitsForProperty(units || []);
    } catch {
      setUnitsForProperty([]);
      setUnitsError('Failed to load units');
    } finally {
      setLoadingUnits(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════ */
  /* Actions                                                     */
  /* ═══════════════════════════════════════════════════════════ */

  const handleViewProperty = (property: Property) => {
    setDialog({ type: 'view_property', property });
    setEditingPlan(null);
    void loadUnits(property.id);
    void loadMealPlans(property.id);
  };

  const handleSaveMealPlan = async () => {
    if (!editingPlan || dialog?.type !== 'view_property') return;
    const adultPrice = parseFloat(editingPlan.adultPrice);
    if (isNaN(adultPrice) || adultPrice <= 0) return;
    const childrenPrice = parseFloat(editingPlan.childrenPrice) || 0;
    setSavingPlan(true);
    try {
      const existing = mealPlans.find(p => p.mealPlanType === editingPlan.type);
      if (existing) {
        await mealPlanApi.update(dialog.property.id, existing.id, { pricePerNight: adultPrice, childrenPricePerNight: childrenPrice });
      } else {
        await mealPlanApi.create(dialog.property.id, { mealPlanType: editingPlan.type, pricePerNight: adultPrice, childrenPricePerNight: childrenPrice });
      }
      await loadMealPlans(dialog.property.id);
      setEditingPlan(null);
    } catch (err: any) {
      alert(`Failed to save meal plan: ${err.message}`);
    } finally {
      setSavingPlan(false);
    }
  };

  const handleSaveProperty = async (data: Partial<Property>) => {
    try {
      if (dialog?.type === 'edit_property') {
        await propertyApi.update(dialog.property.id, data);
      } else {
        await propertyApi.create(data);
      }
      setDialog(null);
      await loadProperties();
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    }
  };

  const handleDeleteProperty = async () => {
    if (dialog?.type !== 'delete_property') return;
    try {
      await propertyApi.delete(dialog.property.id);
      setDialog(null);
      await loadProperties();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const handleSaveUnit = async (data: { name: string; sortOrder: number }) => {
    if (dialog?.type !== 'add_unit' && dialog?.type !== 'edit_unit') return;
    const propId = dialog.property.id;
    try {
      if (dialog.type === 'edit_unit') {
        await unitApi.partialUpdate(propId, dialog.unit.id, data);
      } else {
        await unitApi.create(propId, data);
      }
      // Return to view property state and refresh units
      setDialog({ type: 'view_property', property: dialog.property });
      await loadUnits(propId);
    } catch (err: any) {
      alert(`Failed to save unit: ${err.message}`);
    }
  };

  /* ═══════════════════════════════════════════════════════════ */
  /* Rendering                                                   */
  /* ═══════════════════════════════════════════════════════════ */

  const filteredProperties = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return properties.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.address || '').toLowerCase().includes(q)
    );
  }, [properties, searchQuery]);

  const PLAN_LABELS: Record<MealPlanType, string> = {
    CP: 'Continental Plan',
    MAP: 'Modified American Plan',
    AP: 'All Inclusive',
  };

  if (loading && properties.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50">
        <LoadingSpinner text="Loading properties…" />
      </div>
    );
  }

  const activeProperty = dialog && 'property' in dialog ? dialog.property : null;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 pb-20">
      <div className="mx-auto max-w-7xl px-8 pt-8 sm:px-12 lg:px-16">

        {/* ─── Page Header ─── */}
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Administration</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Properties
            </h1>
          </div>
          <button type="button" className={btnPrimary} onClick={() => setDialog({ type: 'add_property' })}>
            + Add Property
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* ─── Search ─── */}
        <div className="mt-8 flex items-center max-w-md">
          <input
            type="text"
            placeholder="Search by name, code, or location..."
            className={inputCls}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* ─── Properties Grid ─── */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProperties.length === 0 && !loading && (
            <div className="col-span-full rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
              <p className="text-sm font-medium text-slate-400">
                {searchQuery ? 'No properties match your search.' : 'No properties configured yet.'}
              </p>
            </div>
          )}

          {filteredProperties.map((property) => (
            <button
              key={property.id}
              type="button"
              className="group flex flex-col items-start rounded-2xl border-2 border-slate-200 bg-white p-5 text-left transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
              onClick={() => handleViewProperty(property)}
            >
              <div className="flex w-full items-start justify-between">
                <div className="min-w-0 pr-4">
                  <h3 className="truncate text-lg font-bold tracking-tight text-slate-900 group-hover:text-emerald-700">
                    {property.name}
                  </h3>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {property.code}
                  </p>
                </div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors group-hover:bg-emerald-50 group-hover:text-emerald-600">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-5 flex w-full flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
                {property.country && (
                  <span className="rounded-md bg-slate-100 px-2 py-1">{property.country}</span>
                )}
                <span className="rounded-md bg-slate-100 px-2 py-1">{property.totalRooms} Rooms</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* MODALS                                                */}
      {/* ═══════════════════════════════════════════════════════ */}

      {/* 1. View Property Details */}
      {dialog?.type === 'view_property' && activeProperty && (
        <ModalShell title={activeProperty.name} subtitle={activeProperty.code} onClose={() => { setDialog(null); setEditingPlan(null); }}>
          <div className="space-y-6">
            
            {/* Property Info Grid */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 sm:col-span-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Address</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{activeProperty.address || 'Not specified'}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 sm:col-span-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Country</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{activeProperty.country}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Rooms</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{activeProperty.totalRooms}</p>
              </div>
            </div>

            {/* Units Section */}
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-sm font-bold tracking-tight text-slate-900">
                  Units ({unitsForProperty.length})
                </h3>
                <button type="button" onClick={() => setDialog({ type: 'add_unit', property: activeProperty })}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
                  + Add Unit
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {loadingUnits ? (
                  <p className="text-xs text-slate-400 animate-pulse py-4">Loading units...</p>
                ) : unitsError ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 py-4 text-center">
                    <p className="text-xs font-medium text-rose-600">{unitsError}</p>
                  </div>
                ) : unitsForProperty.length === 0 ? (
                  <div className="rounded-lg border-2 border-dashed border-slate-100 py-6 text-center">
                    <p className="text-xs font-medium text-slate-400">No units configured yet.</p>
                  </div>
                ) : (
                  unitsForProperty.map((unit) => (
                    <button key={unit.id} type="button" onClick={() => setDialog({ type: 'edit_unit', property: activeProperty, unit })}
                      className="group flex w-full items-center justify-between rounded-xl border border-slate-100 bg-white p-3 text-left transition-all hover:border-slate-300 hover:bg-slate-50">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{unit.name}</p>
                        <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                          Order: {unit.sortOrder} &nbsp;•&nbsp; Rooms: {unit.totalRooms}
                        </p>
                      </div>
                      <div className="text-slate-300 group-hover:text-slate-600">
                        <Pencil className="h-4 w-4" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Meal Plans Section */}
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-sm font-bold tracking-tight text-slate-900">Meal Plans</h3>
              </div>
              <div className="mt-3 space-y-2">
                {loadingMealPlans ? (
                  <p className="text-xs text-slate-400 animate-pulse py-4">Loading meal plans...</p>
                ) : (
                  (['CP', 'MAP', 'AP'] as MealPlanType[]).map((planType) => {
                    const plan = mealPlans.find(p => p.mealPlanType === planType);
                    const isEditing = editingPlan?.type === planType;
                    return (
                      <div key={planType} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3 py-2.5">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{planType}</p>
                          <p className="text-[11px] font-medium text-slate-400">{PLAN_LABELS[planType]}</p>
                        </div>
                        {isEditing ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500 w-20 shrink-0">Adult/person</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                value={editingPlan!.adultPrice}
                                onChange={e => setEditingPlan({ ...editingPlan!, adultPrice: e.target.value })}
                                disabled={savingPlan}
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') void handleSaveMealPlan(); if (e.key === 'Escape') setEditingPlan(null); }}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500 w-20 shrink-0">Child/person</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                value={editingPlan!.childrenPrice}
                                onChange={e => setEditingPlan({ ...editingPlan!, childrenPrice: e.target.value })}
                                disabled={savingPlan}
                                onKeyDown={e => { if (e.key === 'Enter') void handleSaveMealPlan(); if (e.key === 'Escape') setEditingPlan(null); }}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                                onClick={() => void handleSaveMealPlan()}
                                disabled={savingPlan}
                              >
                                {savingPlan ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                type="button"
                                className="text-xs font-medium text-slate-400 hover:text-slate-600"
                                onClick={() => setEditingPlan(null)}
                                disabled={savingPlan}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : plan ? (
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-semibold text-slate-900">
                                ₹{plan.pricePerNight.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                <span className="ml-1 text-[11px] font-medium text-slate-400">adult/night</span>
                              </p>
                              <p className="text-xs text-slate-400">
                                ₹{(plan.childrenPricePerNight ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                <span className="ml-1 text-[11px]">child/night</span>
                              </p>
                            </div>
                            <button
                              type="button"
                              className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                              onClick={() => setEditingPlan({ type: planType, adultPrice: String(plan.pricePerNight), childrenPrice: String(plan.childrenPricePerNight ?? 0) })}
                            >
                              Edit
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="text-xs font-bold text-slate-400 hover:text-emerald-600"
                            onClick={() => setEditingPlan({ type: planType, adultPrice: '', childrenPrice: '' })}
                          >
                            Set price
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap justify-between gap-3 pt-4 border-t border-slate-100">
              <button type="button" className={btnDanger} onClick={() => setDialog({ type: 'delete_property', property: activeProperty })}>
                Delete Property
              </button>
              <button type="button" className={btnPrimary} onClick={() => setDialog({ type: 'edit_property', property: activeProperty })}>
                Edit Property Info
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* 2. Add / Edit Property Form */}
      {(dialog?.type === 'add_property' || dialog?.type === 'edit_property') && (
        <ModalShell title={dialog.type === 'add_property' ? 'Add New Property' : `Edit ${dialog.property.name}`} onClose={() => setDialog(null)}>
          <PropertyForm
            property={dialog.type === 'edit_property' ? dialog.property : null}
            onSave={handleSaveProperty}
            onCancel={() => setDialog(null)}
          />
        </ModalShell>
      )}

      {/* 3. Add / Edit Unit Form */}
      {(dialog?.type === 'add_unit' || dialog?.type === 'edit_unit') && activeProperty && (
        <ModalShell title={dialog.type === 'add_unit' ? 'Add New Unit' : `Edit ${dialog.unit.name}`} subtitle={activeProperty.name} onClose={() => setDialog({ type: 'view_property', property: activeProperty })}>
          <UnitForm
            propertyId={activeProperty.id}
            unit={dialog.type === 'edit_unit' ? dialog.unit : null}
            onSave={handleSaveUnit}
            onCancel={() => setDialog({ type: 'view_property', property: activeProperty })}
          />
        </ModalShell>
      )}

      {/* 4. Delete Confirmation */}
      {dialog?.type === 'delete_property' && activeProperty && (
        <ModalShell title={`Delete ${activeProperty.name}?`} onClose={() => setDialog({ type: 'view_property', property: activeProperty })}>
          <div className="space-y-5">
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
              <strong>Warning:</strong> This action cannot be undone. You are permanently removing this property and all its associations.
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className={btnSecondary} onClick={() => setDialog({ type: 'view_property', property: activeProperty })}>
                Cancel
              </button>
              <button type="button" className={btnDanger} onClick={handleDeleteProperty}>
                Confirm Deletion
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}