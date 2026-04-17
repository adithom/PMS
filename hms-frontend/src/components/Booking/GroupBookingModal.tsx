import { useState, useEffect } from 'react';
import groupBookingApi from '../../api/groupBookingApi';
import type { GroupBookingCreationDto, GroupRoomRequestDto } from '../../api/groupBookingApi';
import guestApi from '../../api/guestApi';
import unitApi from '../../api/unitApi';
import ModalShell from '../ModalShell';

interface GroupBookingModalProps {
  propertyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function GroupBookingModal({ propertyId, onClose, onSuccess }: GroupBookingModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [initialDataLoading, setInitialDataLoading] = useState(true);
  const [error, setError] = useState('');

  // Data state
  const [guests, setGuests] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);

  // Form State
  const [formData, setFormData] = useState<GroupBookingCreationDto>({
    organizerGuestId: '',
    checkIn: '',
    checkOut: '',
    groupReference: '',
    billingMode: 'SEPARATE',
    roomRequests: [
      { unitId: '', adults: 1, children: 0, nightlyRate: 0 }
    ]
  });

  /* ────────────────────────────────────────────────────────────── */
  /* Data Fetching                                                */
  /* ────────────────────────────────────────────────────────────── */

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setInitialDataLoading(true);
        // Fetch both guests and units simultaneously
        const [guestsData, unitsData] = await Promise.all([
          guestApi.getAll(),
          unitApi.getByProperty(propertyId)
        ]);
        
        // Handle possible paginated responses or direct arrays
        setGuests(Array.isArray(guestsData) ? guestsData : (guestsData as any).content || []);
        setUnits(Array.isArray(unitsData) ? unitsData : (unitsData as any).content || []);
      } catch (err: any) {
        setError('Failed to load guests and units. Please close and try again.');
      } finally {
        setInitialDataLoading(false);
      }
    };

    fetchInitialData();
  }, [propertyId]);

  /* ────────────────────────────────────────────────────────────── */
  /* Form Handlers                                                */
  /* ────────────────────────────────────────────────────────────── */

  const updateField = (field: keyof GroupBookingCreationDto, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const addRoomRequest = () => {
    setFormData(prev => ({
      ...prev,
      roomRequests: [...prev.roomRequests, { unitId: '', adults: 1, children: 0, nightlyRate: 0 }]
    }));
  };

  const removeRoomRequest = (index: number) => {
    setFormData(prev => ({
      ...prev,
      roomRequests: prev.roomRequests.filter((_, i) => i !== index)
    }));
  };

  const updateRoomRequest = (index: number, field: keyof GroupRoomRequestDto, value: any) => {
    setFormData(prev => {
      const newRequests = [...prev.roomRequests];
      newRequests[index] = { ...newRequests[index], [field]: value };
      return { ...prev, roomRequests: newRequests };
    });
  };

  /* ────────────────────────────────────────────────────────────── */
  /* Navigation & Validation                                        */
  /* ────────────────────────────────────────────────────────────── */

  const handleNext = () => {
    if (step === 1) {
      if (!formData.organizerGuestId || !formData.checkIn || !formData.checkOut) {
        setError('Please select an Organizer and specify Check-In and Check-Out dates.');
        return;
      }
      const today = new Date().toISOString().split('T')[0];
      if (new Date(formData.checkIn) < new Date(today)) {
        setError('Check-in date cannot be in the past.');
        return;
      }
      if (new Date(formData.checkIn) >= new Date(formData.checkOut)) {
        setError('Check-Out date must be after Check-In date.');
        return;
      }
    }
    
    if (step === 2) {
      if (formData.roomRequests.length === 0) {
        setError('You must add at least one room to this group booking.');
        return;
      }
      const hasEmptyUnits = formData.roomRequests.some(r => !r.unitId);
      if (hasEmptyUnits) {
        setError('Please select a Unit Type for all requested rooms.');
        return;
      }
    }

    setError('');
    setStep(prev => (prev + 1) as 1 | 2 | 3);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      // Clean up empty optional fields before sending
      const payload = {
        ...formData,
        roomRequests: formData.roomRequests.map(req => ({
          ...req,
          childGuestId: req.childGuestId === '' ? undefined : req.childGuestId
        }))
      };

      await groupBookingApi.createGroupBooking(propertyId, payload);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create group booking.');
      setLoading(false);
    }
  };

  /* ────────────────────────────────────────────────────────────── */
  /* Render Helpers                                                 */
  /* ────────────────────────────────────────────────────────────── */

  const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500";

  return (
    <ModalShell title="New Group Block" size="wide" onClose={onClose}>
      <div className="flex h-[650px] flex-col">
        
        {/* Progress Bar */}
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4 shrink-0">
          <div className="flex items-center justify-between">
            {['Group Details', 'Room Roster', 'Review & Confirm'].map((label, i) => {
              const stepNumber = i + 1;
              const isActive = step === stepNumber;
              const isPast = step > stepNumber;
              
              return (
                <div key={label} className="flex flex-1 items-center">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    isActive ? 'bg-indigo-600 text-white shadow-md' : 
                    isPast ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {isPast ? '✓' : stepNumber}
                  </div>
                  <span className={`ml-3 text-xs font-bold uppercase tracking-widest ${
                    isActive ? 'text-indigo-900' : isPast ? 'text-indigo-700' : 'text-slate-400'
                  }`}>
                    {label}
                  </span>
                  {stepNumber !== 3 && (
                    <div className="mx-4 h-px flex-1 bg-slate-200"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {initialDataLoading ? (
            <div className="flex h-full items-center justify-center text-slate-500">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-indigo-600"></div>
                Loading property data...
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800 shadow-sm">
                  {error}
                </div>
              )}

              {/* STEP 1: GROUP DETAILS */}
              {step === 1 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-500">Group Organizer *</label>
                      <select 
                        className={inputCls} 
                        value={formData.organizerGuestId} 
                        onChange={e => updateField('organizerGuestId', e.target.value)}
                      >
                        <option value="" disabled>Select the main contact...</option>
                        {guests.map(g => (
                          <option key={g.id} value={g.id}>{g.firstName} {g.lastName} {g.email ? `(${g.email})` : ''}</option>
                        ))}
                      </select>
                      <p className="mt-1 text-[10px] text-slate-400">The person responsible for the master booking.</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-500">Group Reference Name</label>
                      <input 
                        type="text" 
                        className={inputCls} 
                        placeholder="e.g., Sharma Wedding Party"
                        value={formData.groupReference}
                        onChange={e => updateField('groupReference', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-500">Check-In Date *</label>
                      <input
                        type="date"
                        className={inputCls}
                        value={formData.checkIn}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={e => updateField('checkIn', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-500">Check-Out Date *</label>
                      <input
                        type="date"
                        className={inputCls}
                        value={formData.checkOut}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={e => updateField('checkOut', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200">
                    <label className="mb-3 block text-xs font-bold uppercase tracking-widest text-slate-500">Master Billing Rules</label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
                        formData.billingMode === 'SEPARATE' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}>
                        <div className="flex items-center gap-3">
                          <input 
                            type="radio" 
                            name="billingMode" 
                            checked={formData.billingMode === 'SEPARATE'} 
                            onChange={() => updateField('billingMode', 'SEPARATE')}
                            className="h-4 w-4 text-indigo-600"
                          />
                          <span className="font-bold text-slate-900">Separate Billing</span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500 ml-7">Each room settles their own folio independently at checkout.</p>
                      </label>

                      <label className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
                        formData.billingMode === 'CONSOLIDATED' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}>
                        <div className="flex items-center gap-3">
                          <input 
                            type="radio" 
                            name="billingMode" 
                            checked={formData.billingMode === 'CONSOLIDATED'} 
                            onChange={() => updateField('billingMode', 'CONSOLIDATED')}
                            className="h-4 w-4 text-indigo-600"
                          />
                          <span className="font-bold text-slate-900">Consolidated Billing</span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500 ml-7">All room and ancillary charges route directly to the Organizer's Master Folio.</p>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: ROOM ROSTER */}
              {step === 2 && (
                <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">Requested Rooms</h3>
                    <button onClick={addRoomRequest} className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
                      + Add Another Room
                    </button>
                  </div>

                  {formData.roomRequests.map((req, index) => (
                    <div key={index} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm relative group">
                      <div className="absolute -left-3 top-5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 font-bold text-white text-xs shadow-sm">
                        {index + 1}
                      </div>
                      
                      <div className="grid gap-4 sm:grid-cols-2 ml-4">
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Unit Type *</label>
                          <select 
                            className={inputCls}
                            value={req.unitId}
                            onChange={(e) => updateRoomRequest(index, 'unitId', e.target.value)}
                          >
                            <option value="" disabled>Select Category...</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Guest (Optional)</label>
                          <select 
                            className={inputCls}
                            value={req.childGuestId || ''}
                            onChange={(e) => updateRoomRequest(index, 'childGuestId', e.target.value)}
                          >
                            <option value="">-- Same as Organizer --</option>
                            {guests.map(g => (
                              <option key={g.id} value={g.id}>{g.firstName} {g.lastName}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-3 ml-4">
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Adults</label>
                          <input 
                            type="number" min="1" className={inputCls} 
                            value={req.adults} onChange={(e) => updateRoomRequest(index, 'adults', parseInt(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Children</label>
                          <input 
                            type="number" min="0" className={inputCls} 
                            value={req.children} onChange={(e) => updateRoomRequest(index, 'children', parseInt(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Nightly Rate</label>
                          <input
                            type="number" min="0" step="0.01" className={inputCls}
                            value={req.nightlyRate} onChange={(e) => updateRoomRequest(index, 'nightlyRate', parseFloat(e.target.value))}
                          />
                        </div>
                      </div>

                      {formData.roomRequests.length > 1 && (
                        <button 
                          onClick={() => removeRoomRequest(index)}
                          className="absolute -right-2 -top-2 rounded-full bg-white p-1.5 text-slate-400 shadow-sm ring-1 ring-slate-200 transition-all hover:bg-rose-50 hover:text-rose-600"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* STEP 3: REVIEW */}
              {step === 3 && (
                <div className="flex h-full flex-col items-center justify-center text-center animate-in zoom-in-95 fade-in duration-300">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 mb-6">
                    <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1v1H9V7zm5 0h1v1h-1V7zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-extrabold text-slate-900">Ready to build the block?</h2>
                  <p className="mt-2 max-w-md text-sm text-slate-500">
                    You are about to create <strong>1 Master Group Booking</strong> and <strong>{formData.roomRequests.length} Child Room Bookings</strong> for the dates <strong>{formData.checkIn}</strong> to <strong>{formData.checkOut}</strong>.
                  </p>
                  
                  <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm w-full max-w-sm">
                     <div className="flex justify-between border-b border-slate-100 pb-2 mb-2 text-sm">
                       <span className="text-slate-500">Organizer</span>
                       <span className="font-bold text-slate-900">
                         {guests.find(g => g.id === formData.organizerGuestId)?.firstName || 'Selected Guest'}
                       </span>
                     </div>
                     <div className="flex justify-between border-b border-slate-100 pb-2 mb-2 text-sm">
                       <span className="text-slate-500">Group Reference</span>
                       <span className="font-bold text-slate-900">{formData.groupReference || 'None'}</span>
                     </div>
                     <div className="flex justify-between text-sm">
                       <span className="text-slate-500">Billing Structure</span>
                       <span className="font-bold text-indigo-600">{formData.billingMode}</span>
                     </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4 shrink-0">
          <button 
            onClick={() => step === 1 ? onClose() : setStep(prev => (prev - 1) as 1 | 2)}
            className="rounded-lg px-4 py-2 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100"
            disabled={loading || initialDataLoading}
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 3 ? (
            <button 
              onClick={handleNext}
              disabled={initialDataLoading}
              className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              Next Step
            </button>
          ) : (
            <button 
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Create Group Block'}
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}