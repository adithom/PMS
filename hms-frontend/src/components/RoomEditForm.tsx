import { useState } from 'react';
import roomApi from '../api/roomApi';
import type { Room, RoomStatus, UnitDto } from '../types';

/* ────────────────────────────────────────────────────────────── */
/* Tokens & Styles                                              */
/* ────────────────────────────────────────────────────────────── */
const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const btnSecondary = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100';
const labelCls = 'mb-1.5 block text-sm font-medium text-slate-700';

type Props = {
  propertyId: string;
  initialRoom?: Room | null;
  units?: UnitDto[];
  onSuccess: () => void;
  onCancel: () => void;
};

export default function RoomForm({ propertyId, initialRoom, units = [], onSuccess, onCancel }: Props) {
  const isEditMode = !!initialRoom;
  const roomId = initialRoom ? ((initialRoom as any).roomId ?? (initialRoom as any).id) : null;

  const [formData, setFormData] = useState({
    unitId: (initialRoom as any)?.unitId ?? '',
    number: initialRoom?.number ?? '',
    type: initialRoom?.type ?? '',
    capacity: initialRoom?.capacity ?? 2,
    baseRate: initialRoom?.baseRate ?? 0,
    status: initialRoom?.status ?? 'ACTIVE',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!isEditMode && !formData.unitId) {
        setError('Unit is required.');
        return;
      }

      const payload: Partial<Room> & { unitId?: string } = {
        number: formData.number,
        type: formData.type,
        capacity: formData.capacity,
        baseRate: formData.baseRate,
        status: formData.status as RoomStatus,
      };

      if (!isEditMode) {
        payload.unitId = formData.unitId;
      }

      if (isEditMode && roomId) {
        await roomApi.partialUpdate(propertyId, roomId, payload);
      } else {
        await roomApi.create(propertyId, payload);
      }
      onSuccess();
    } catch (err) {
      setError((err as Error).message || 'Failed to save room.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {/* Unit Selection (Only shown when creating a new room) */}
      {!isEditMode && (
        <label>
          <span className={labelCls}>Unit *</span>
          <select required className={inputCls} value={formData.unitId} onChange={(e) => handleChange('unitId', e.target.value)}>
            <option value="">-- Select unit --</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.name}</option>
            ))}
          </select>
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={labelCls}>Room number *</span>
          <input required className={inputCls} type="text" value={formData.number} onChange={(e) => handleChange('number', e.target.value)} placeholder="e.g. 101" />
        </label>
        <label>
          <span className={labelCls}>Type</span>
          <input className={inputCls} type="text" value={formData.type} onChange={(e) => handleChange('type', e.target.value)} placeholder="e.g. Deluxe Suite" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={labelCls}>Capacity</span>
          <input required className={inputCls} type="number" min="1" value={formData.capacity} onChange={(e) => handleChange('capacity', Number(e.target.value) || 1)} />
        </label>
        <label>
          <span className={labelCls}>Base Rate (₹)</span>
          <input required className={inputCls} type="number" min="0" step="100" value={formData.baseRate} onChange={(e) => handleChange('baseRate', Number(e.target.value) || 0)} />
        </label>
      </div>

      <label>
        <span className={labelCls}>Status</span>
        <select className={inputCls} value={formData.status} onChange={(e) => handleChange('status', e.target.value)}>
          <option value="ACTIVE">Active</option>
          <option value="IN_MAINTENANCE">In Maintenance</option>
          {isEditMode && <option value="QUEUED_FOR_MAINTENANCE">Queued for Maintenance</option>}
          <option value="INACTIVE">Inactive</option>
        </select>
      </label>

      <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
        <button type="button" className={btnSecondary} onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button type="submit" className={btnPrimary} disabled={loading}>
          {loading ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Room'}
        </button>
      </div>
    </form>
  );
}