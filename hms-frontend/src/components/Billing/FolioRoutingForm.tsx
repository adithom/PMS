import { useState } from 'react';
import folioApi from '../../api/folioApi';
import type { ChargeDto } from '../../api/folioApi';

/* ────────────────────────────────────────────────────────────── */
/* Tokens & Styles                                              */
/* ────────────────────────────────────────────────────────────── */
const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const btnSecondary = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed';
const labelCls = 'mb-1.5 block text-sm font-medium text-slate-700';

interface FolioRoutingFormProps {
  propertyId: string;
  folioId: string;
  charges: ChargeDto[];
  currency: string;
  onSuccess: () => void;
  onCancel: () => void;
}

type RoutingDestination = 'PARENT' | 'SPECIFIC';

export default function FolioRoutingForm({ propertyId, folioId, charges, currency, onSuccess, onCancel }: FolioRoutingFormProps) {
  // Filter out voided charges since they can't be routed
  const availableCharges = charges.filter(c => !c.isVoided);
  
  const [selectedChargeIds, setSelectedChargeIds] = useState<Set<string>>(new Set());
  const [destination, setDestination] = useState<RoutingDestination>('PARENT');
  const [targetFolioId, setTargetFolioId] = useState('');
  
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleToggleCharge = (chargeId: string) => {
    setSelectedChargeIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chargeId)) newSet.delete(chargeId);
      else newSet.add(chargeId);
      return newSet;
    });
    setError('');
  };

  const handleToggleAll = () => {
    if (selectedChargeIds.size === availableCharges.length) {
      setSelectedChargeIds(new Set());
    } else {
      setSelectedChargeIds(new Set(availableCharges.map(c => c.id)));
    }
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedChargeIds.size === 0) {
      setError('Please select at least one charge to route.');
      return;
    }
    if (destination === 'SPECIFIC' && !targetFolioId.trim()) {
      setError('Target Folio ID is required when routing to a specific folio.');
      return;
    }

    setSubmitting(true);
    try {
      // Fire all routing requests in parallel for speed
      const routePromises = Array.from(selectedChargeIds).map(chargeId => 
        folioApi.routeCharge(
          propertyId, 
          folioId, 
          chargeId, 
          destination === 'SPECIFIC' ? targetFolioId.trim() : undefined
        )
      );

      await Promise.all(routePromises);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to route some or all charges. Please check IDs and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate total amount being routed for preview
  const routingTotal = availableCharges
    .filter(c => selectedChargeIds.has(c.id))
    .reduce((sum, c) => sum + (c.totalAmount || 0), 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {/* 1. Destination Selection */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-5">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-indigo-700">1. Routing Destination</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="radio" 
              name="destination" 
              checked={destination === 'PARENT'} 
              onChange={() => { setDestination('PARENT'); setError(''); }}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-slate-900">Route to Parent Booking (Master Folio)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="radio" 
              name="destination" 
              checked={destination === 'SPECIFIC'} 
              onChange={() => { setDestination('SPECIFIC'); setError(''); }}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-slate-900">Route to a Specific Folio ID</span>
          </label>

          {destination === 'SPECIFIC' && (
            <div className="ml-7 mt-2 animate-in slide-in-from-top-2 fade-in duration-200">
              <input 
                type="text" 
                value={targetFolioId} 
                onChange={(e) => { setTargetFolioId(e.target.value); setError(''); }}
                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000" 
                className={inputCls} 
                disabled={submitting}
              />
              <p className="mt-1 text-[10px] text-slate-500">Paste the exact Folio System ID (UUID) of the target account.</p>
            </div>
          )}
        </div>
      </div>

      {/* 2. Charge Selection */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">2. Select Charges to Route</h3>
          <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700">
            {selectedChargeIds.size} Selected
          </span>
        </div>

        <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-3 pl-4">
                  <input 
                    type="checkbox" 
                    checked={selectedChargeIds.size > 0 && selectedChargeIds.size === availableCharges.length}
                    onChange={handleToggleAll}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="p-3 text-[11px] font-bold uppercase text-slate-500">Date</th>
                <th className="p-3 text-[11px] font-bold uppercase text-slate-500">Item</th>
                <th className="p-3 pr-4 text-right text-[11px] font-bold uppercase text-slate-500">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {availableCharges.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-sm text-slate-400">No active charges available to route.</td>
                </tr>
              ) : (
                availableCharges.map(charge => (
                  <tr key={charge.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 pl-4">
                      <input 
                        type="checkbox" 
                        checked={selectedChargeIds.has(charge.id)}
                        onChange={() => handleToggleCharge(charge.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>
                    <td className="p-3 text-slate-600">
                      {new Date(charge.chargeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="p-3">
                      <span className="block font-medium text-slate-900">{charge.description || charge.chargeCode}</span>
                    </td>
                    <td className="p-3 pr-4 text-right font-bold text-slate-900">
                      {currency} {charge.totalAmount?.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Footer Actions */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-5 mt-6">
        <div className="text-sm font-medium text-slate-500">
          Routing Total: <span className="text-lg font-bold text-slate-900">{currency} {routingTotal.toFixed(2)}</span>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className={btnSecondary} disabled={submitting}>Cancel</button>
          <button type="submit" className={btnPrimary} disabled={submitting || selectedChargeIds.size === 0}>
            {submitting ? 'Routing...' : 'Execute Routing'}
          </button>
        </div>
      </div>
    </form>
  );
}