import { useEffect, useState } from 'react';
import authApi, { type UserInfo, type UpdateUserRequest, type CreateUserRequest } from '../api/authApi';
import propertyApi from '../api/propertyApi';
import posApi from '../api/posApi';
import type { Property } from '../types';
import type { PosLocation } from '../types/pos';
import ModalShell from '../components/ModalShell';

/* ────────────────────────────────────────────────────────────── */
/* Tokens                                                        */
/* ────────────────────────────────────────────────────────────── */

const ROLES = ['ADMIN', 'MANAGER', 'FRONTDESK', 'HOUSEKEEPING', 'AGENCY', 'POS'] as const;
const ROLES_NO_ADMIN = ROLES.filter(r => r !== 'ADMIN');

const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const btnDanger =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100';

const roleBadgeClass: Record<string, string> = {
  ADMIN: 'bg-slate-800 text-white border-slate-700',
  MANAGER: 'bg-blue-100 text-blue-800 border-blue-200',
  FRONTDESK: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  HOUSEKEEPING: 'bg-purple-100 text-purple-800 border-purple-200',
  AGENCY: 'bg-amber-100 text-amber-800 border-amber-200',
  POS: 'bg-rose-100 text-rose-800 border-rose-200',
};

/* ────────────────────────────────────────────────────────────── */
/* Dialog State                                                  */
/* ────────────────────────────────────────────────────────────── */

type DialogState =
  | { type: 'edit_user'; user: UserInfo }
  | { type: 'create_user' }
  | { type: 'delete_user'; user: UserInfo }
  | null;

/* ────────────────────────────────────────────────────────────── */
/* Page Component                                                */
/* ────────────────────────────────────────────────────────────── */

export default function AdminConsole() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [allPosLocations, setAllPosLocations] = useState<PosLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);

  /* ═══════════════════════════════════════════════════════════ */
  /* Data Loading                                                */
  /* ═══════════════════════════════════════════════════════════ */

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [userList, properties] = await Promise.all([
        authApi.listUsers(),
        propertyApi.getAll(),
      ]);
      const locationArrays = await Promise.all(
        properties.map(p => posApi.getLocations(p.id).catch(() => [] as PosLocation[]))
      );
      setUsers(userList);
      setAllProperties(properties);
      setAllPosLocations(locationArrays.flat());
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  /* ═══════════════════════════════════════════════════════════ */
  /* Actions                                                     */
  /* ═══════════════════════════════════════════════════════════ */

  const handleDeleteUser = async () => {
    if (dialog?.type !== 'delete_user') return;
    try {
      await authApi.deleteUser(dialog.user.id);
      setDialog(null);
      await loadData();
    } catch (e: any) {
      alert(`Failed to delete: ${e.message}`);
    }
  };

  const handleSaveEdit = async (data: UpdateUserRequest) => {
    if (dialog?.type !== 'edit_user') return;
    await authApi.updateUser(dialog.user.id, data);
    setDialog(null);
    await loadData();
  };

  const handleCreateUser = async (data: CreateUserRequest) => {
    await authApi.register(data);
    setDialog(null);
    await loadData();
  };

  /* ═══════════════════════════════════════════════════════════ */
  /* Rendering                                                   */
  /* ═══════════════════════════════════════════════════════════ */

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col bg-slate-50 overflow-hidden">
      <div className="flex flex-col flex-1 min-h-0 mx-auto w-full max-w-[1800px] px-8 pt-8 sm:px-12 lg:px-16">

        {/* ─── Page Header ─── */}
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left flex-shrink-0">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">System</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Admin Console
            </h1>
          </div>
          <button
            type="button"
            onClick={() => alert('Server restart is not yet implemented.')}
            className={btnSecondary}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Restart Server
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm flex-shrink-0">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* ─── Two-Panel Layout ─── */}
        <div className="mt-6 flex flex-1 gap-6 min-h-0 pb-6">

          {/* ── User Management ── */}
          <div className="flex flex-col w-1/2 min-h-0 rounded-2xl border-2 border-slate-200 bg-white">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
                User Management
                <span className="ml-2 text-slate-300">({users.length})</span>
              </h2>
              <button type="button" className={btnPrimary} onClick={() => setDialog({ type: 'create_user' })}>
                + Create User
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-slate-400 animate-pulse">Loading users…</p>
                </div>
              ) : users.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm font-medium text-slate-400">No users found.</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-sm">
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      <th className="px-6 py-3">Username</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Properties</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map(u => (
                      <tr key={u.id} className="transition-colors hover:bg-slate-50/60">
                        <td className="px-6 py-3.5">
                          <p className="text-sm font-bold text-slate-900">{u.username}</p>
                          {u.email && (
                            <p className="mt-0.5 text-[11px] text-slate-400">{u.email}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${roleBadgeClass[u.role] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {u.properties.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {u.properties.map(p => (
                                <span key={p.id} className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                  {p.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          {u.role !== 'ADMIN' ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setDialog({ type: 'edit_user', user: u })}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                title="Edit user"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDialog({ type: 'delete_user', user: u })}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                title="Delete user"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">Protected</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ── Bill Ledger ── */}
          <div className="flex flex-col w-1/2 min-h-0 rounded-2xl border-2 border-slate-200 bg-white">
            <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Bill Ledger</h2>
            </div>
            <div className="overflow-y-auto flex-1 flex items-center justify-center">
              <div className="text-center select-none">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 text-2xl">
                  🚧
                </div>
                <p className="text-sm font-bold text-slate-500">Coming Soon</p>
                <p className="mt-1 text-xs text-slate-400">Bill ledger is not yet available.</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* MODALS                                                */}
      {/* ═══════════════════════════════════════════════════════ */}

      {/* Edit User */}
      {dialog?.type === 'edit_user' && (
        <ModalShell title={`Edit ${dialog.user.username}`} subtitle="Update user details" onClose={() => setDialog(null)}>
          <UserForm
            mode="edit"
            initialData={dialog.user}
            allProperties={allProperties}
            allPosLocations={allPosLocations}
            onSubmit={async (data) => handleSaveEdit(data as UpdateUserRequest)}
            onCancel={() => setDialog(null)}
          />
        </ModalShell>
      )}

      {/* Create User */}
      {dialog?.type === 'create_user' && (
        <ModalShell title="Create User" subtitle="Add a new system user" onClose={() => setDialog(null)}>
          <UserForm
            mode="create"
            allProperties={allProperties}
            allPosLocations={allPosLocations}
            onSubmit={async (data) => handleCreateUser(data as CreateUserRequest)}
            onCancel={() => setDialog(null)}
          />
        </ModalShell>
      )}

      {/* Delete Confirmation */}
      {dialog?.type === 'delete_user' && (
        <ModalShell title={`Delete ${dialog.user.username}?`} onClose={() => setDialog(null)}>
          <div className="space-y-5">
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
              <strong>Warning:</strong> This action cannot be undone. The user
              <strong> {dialog.user.username} </strong>
              ({dialog.user.role}) will be permanently removed.
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className={btnSecondary} onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button type="button" className={btnDanger} onClick={handleDeleteUser}>
                Confirm Deletion
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Shared User Form                                              */
/* ────────────────────────────────────────────────────────────── */

const inputCls_ = inputCls; // alias for use inside sub-component

interface UserFormProps {
  mode: 'create' | 'edit';
  initialData?: UserInfo;
  allProperties: Property[];
  allPosLocations: PosLocation[];
  onSubmit: (data: CreateUserRequest | UpdateUserRequest) => Promise<void>;
  onCancel: () => void;
}

function UserForm({ mode, initialData, allProperties, allPosLocations, onSubmit, onCancel }: UserFormProps) {
  const [username, setUsername] = useState(initialData?.username ?? '');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState(initialData?.email ?? '');
  const [role, setRole] = useState(initialData?.role ?? 'FRONTDESK');
  const [propertyIds, setPropertyIds] = useState<string[]>(initialData?.properties.map(p => p.id) ?? []);
  const [posLocationId, setPosLocationId] = useState(initialData?.posLocationId ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleProperty = (id: string) => {
    setPropertyIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (mode === 'create') {
      if (!username.trim()) { setError('Username is required.'); return; }
      if (!password.trim()) { setError('Password is required.'); return; }
    }
    setSaving(true);
    setError(null);
    try {
      if (mode === 'create') {
        await onSubmit({
          username: username.trim(),
          password: password,
          email: email.trim() || undefined,
          role,
          propertyIds: propertyIds.length > 0 ? propertyIds : undefined,
          posLocationId: posLocationId || undefined,
        } satisfies CreateUserRequest);
      } else {
        await onSubmit({
          email: email.trim() || undefined,
          password: password.trim() || undefined,
          role,
          propertyIds,
          posLocationId: posLocationId || null,
        } satisfies UpdateUserRequest);
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const roleOptions = mode === 'create' ? ROLES : ROLES_NO_ADMIN;

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      )}

      {/* Username */}
      {mode === 'create' ? (
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Username <span className="text-rose-500">*</span>
          </label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)}
            placeholder="e.g. john_doe" className={inputCls_} />
        </div>
      ) : (
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Username</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{initialData?.username}</p>
        </div>
      )}

      {/* Password */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
          Password {mode === 'create' && <span className="text-rose-500">*</span>}
        </label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder={mode === 'edit' ? 'Leave blank to keep current' : ''}
          className={inputCls_} />
      </div>

      {/* Email */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="Optional" className={inputCls_} />
      </div>

      {/* Role */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
          Role <span className="text-rose-500">*</span>
        </label>
        <select value={role} onChange={e => setRole(e.target.value)} className={inputCls_}>
          {roleOptions.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Properties */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Properties</label>
        {allProperties.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-100 py-4 text-center">
            <p className="text-xs font-medium text-slate-400">No properties available.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-40 overflow-y-auto">
            {allProperties.map(p => (
              <label key={p.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors">
                <input type="checkbox" checked={propertyIds.includes(p.id)} onChange={() => toggleProperty(p.id)}
                  className="accent-emerald-600 h-3.5 w-3.5" />
                <span className="text-sm text-slate-700">{p.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* POS Location */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">POS Location</label>
        <select value={posLocationId} onChange={e => setPosLocationId(e.target.value)} className={inputCls_}>
          <option value="">None</option>
          {allPosLocations.map(loc => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <button type="button" className={btnSecondary} onClick={onCancel}>Cancel</button>
        <button type="button" className={btnPrimary} onClick={handleSubmit} disabled={saving}>
          {saving ? (mode === 'create' ? 'Creating…' : 'Saving…') : (mode === 'create' ? 'Create User' : 'Save Changes')}
        </button>
      </div>
    </div>
  );
}
