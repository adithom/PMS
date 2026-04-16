import { useEffect, useState } from 'react';
import BillLedgerTab from '../components/Billing/BillLedgerTab';
import authApi, { type UserInfo, type UpdateUserRequest, type CreateUserRequest } from '../api/authApi';
import propertyApi from '../api/propertyApi';
import posApi from '../api/posApi';
import travelAgentApi from '../api/travelAgentApi';
import adminApi from '../api/adminApi';
import type { Property, TravelAgent } from '../types';
import type { PosLocation } from '../types/pos';
import ModalShell from '../components/ModalShell';
import ConfirmModal from '../components/ConfirmModal';

/* ────────────────────────────────────────────────────────────── */
/* Tokens                                                        */
/* ────────────────────────────────────────────────────────────── */

const ROLES = ['ADMIN', 'MANAGER', 'FRONTDESK', 'HOUSEKEEPING', 'AGENCY', 'POS'] as const;
const ROLES_NO_ADMIN = ROLES.filter(r => r !== 'ADMIN');

const roleLabel: Record<string, string> = {
  ADMIN: 'Admin', MANAGER: 'Manager', FRONTDESK: 'Front Desk',
  HOUSEKEEPING: 'Housekeeping', AGENCY: 'Agency', POS: 'POS',
};

const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const btnSecondary =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const btnDanger =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

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
  | { type: 'edit_agent'; agent: TravelAgent }
  | { type: 'create_agent' }
  | { type: 'delete_agent'; agent: TravelAgent }
  | null;

/* ────────────────────────────────────────────────────────────── */
/* Page Component                                                */
/* ────────────────────────────────────────────────────────────── */

export default function AdminConsole() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [agents, setAgents] = useState<TravelAgent[]>([]);
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [allPosLocations, setAllPosLocations] = useState<PosLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [restarting, setRestarting] = useState(false);
  const [restartStatus, setRestartStatus] = useState<string | null>(null);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  /* ═══════════════════════════════════════════════════════════ */
  /* Data Loading                                                */
  /* ═══════════════════════════════════════════════════════════ */

  const loadData = async () => {
    setLoading(true); setError(null);
    try {
      const [userList, properties, agentList] = await Promise.all([
        authApi.listUsers(),
        propertyApi.getAll(),
        travelAgentApi.getAll(),
      ]);
      const locationArrays = await Promise.all(
        properties.map(p => posApi.getLocations(p.id).catch(() => [] as PosLocation[]))
      );
      setUsers(userList);
      setAllProperties(properties);
      setAllPosLocations(locationArrays.flat());
      setAgents(agentList);
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  /* ═══════════════════════════════════════════════════════════ */
  /* User Actions                                               */
  /* ═══════════════════════════════════════════════════════════ */

  const handleDeleteUser = async () => {
    if (dialog?.type !== 'delete_user') return;
    try {
      await authApi.deleteUser(dialog.user.id);
      setDialog(null); await loadData();
    } catch (e: any) { alert(`Failed to delete: ${e.message}`); }
  };

  const handleSaveUser = async (data: UpdateUserRequest) => {
    if (dialog?.type !== 'edit_user') return;
    await authApi.updateUser(dialog.user.id, data);
    setDialog(null); await loadData();
  };

  const handleCreateUser = async (data: CreateUserRequest) => {
    await authApi.register(data);
    setDialog(null); await loadData();
  };

  /* ═══════════════════════════════════════════════════════════ */
  /* Travel Agent Actions                                       */
  /* ═══════════════════════════════════════════════════════════ */

  const handleRestart = async () => {
    setRestarting(true);
    setRestartStatus('Restarting server...');
    try {
      await adminApi.restartServer();
    } catch {
      // expected — server drops the connection as it shuts down
    }
    // poll until the server responds again (up to 60s)
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api'}/auth/me`);
        if (res.status > 0) break;
      } catch {
        // still down, keep polling
      }
    }
    const timedOut = Date.now() >= deadline;
    setRestarting(false);
    setRestartStatus(timedOut ? 'Restart timed out' : 'Server back online');
    setTimeout(() => setRestartStatus(null), 4000);
  };

  const handleCreateAgent = async (data: Parameters<typeof travelAgentApi.create>[0]) => {
    await travelAgentApi.create(data);
    setDialog(null); await loadData();
  };

  const handleSaveAgent = async (data: Parameters<typeof travelAgentApi.partialUpdate>[1]) => {
    if (dialog?.type !== 'edit_agent') return;
    await travelAgentApi.partialUpdate(dialog.agent.id, data);
    setDialog(null); await loadData();
  };

  const handleToggleAgent = async (agent: TravelAgent) => {
    await travelAgentApi.partialUpdate(agent.id, { active: !agent.active });
    await loadData();
  };

  const handleDeleteAgent = async () => {
    if (dialog?.type !== 'delete_agent') return;
    try {
      await travelAgentApi.delete(dialog.agent.id);
      setDialog(null); await loadData();
    } catch (e: any) { alert(`Failed to delete: ${e.message}`); }
  };

  /* ═══════════════════════════════════════════════════════════ */
  /* Rendering                                                   */
  /* ═══════════════════════════════════════════════════════════ */

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col bg-slate-50 overflow-hidden">
      <div className="flex flex-col flex-1 min-h-0 mx-auto w-full max-w-[1800px] px-8 sm:px-12 lg:px-16">

        {/* ─── Page Header ─── */}
        <div className="flex items-center justify-between flex-shrink-0 pt-4 pb-3">
          <div>
            <p className="text-[10px] font-semibold text-emerald-600 tracking-wide">System</p>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 leading-tight">Admin Console</h1>
          </div>
          <div className="flex items-center gap-2">
            {restartStatus && (
              <span className="text-xs text-slate-500">{restartStatus}</span>
            )}
            <button
              type="button"
              onClick={() => setShowRestartConfirm(true)}
              disabled={restarting}
              className={btnSecondary}
            >
              {restarting ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {restarting ? 'Restarting...' : 'Restart Server'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex-shrink-0">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* ─── Three-column layout: [left col: users + agents] [right col: bill ledger] ─── */}
        <div className="flex flex-1 gap-4 min-h-0 pb-4">

          {/* ── Left column: User Management stacked over Travel Agents ── */}
          <div className="flex flex-col w-1/2 gap-4 min-h-0">

            {/* User Management */}
            <div className="flex flex-col flex-1 min-h-0 rounded-2xl border-2 border-slate-200 bg-white">
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100 flex-shrink-0">
                <h2 className="text-sm font-semibold text-slate-600">
                  User Management
                  <span className="ml-1.5 text-xs font-normal text-slate-400">({users.length})</span>
                </h2>
                <button type="button" className={btnPrimary} onClick={() => setDialog({ type: 'create_user' })}>
                  + Create User
                </button>
              </div>
              <div className="overflow-y-auto flex-1">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-xs text-slate-400 animate-pulse">Loading…</p>
                  </div>
                ) : users.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-xs font-medium text-slate-400">No users found.</p>
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-sm">
                      <tr className="text-xs font-medium text-slate-400 border-b border-slate-100">
                        <th className="px-5 py-2 font-medium">Username</th>
                        <th className="px-3 py-2 font-medium">Role</th>
                        <th className="px-3 py-2 font-medium">Properties</th>
                        <th className="px-5 py-2 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.map(u => (
                        <tr key={u.id} className="transition-colors hover:bg-slate-50/60">
                          <td className="px-5 py-2">
                            <p className="text-xs font-semibold text-slate-900">{u.username}</p>
                            {u.email && <p className="text-[10px] text-slate-400">{u.email}</p>}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${roleBadgeClass[u.role] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                              {roleLabel[u.role] ?? u.role}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {u.properties.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {u.properties.map(p => (
                                  <span key={p.id} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{p.name}</span>
                                ))}
                              </div>
                            ) : <span className="text-[10px] text-slate-300">—</span>}
                          </td>
                          <td className="px-5 py-2 text-right">
                            {u.role !== 'ADMIN' ? (
                              <div className="inline-flex items-center gap-1">
                                <button type="button" onClick={() => setDialog({ type: 'edit_user', user: u })}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" title="Edit">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                  </svg>
                                </button>
                                <button type="button" onClick={() => setDialog({ type: 'delete_user', user: u })}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600" title="Delete">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] font-medium text-slate-300">Protected</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Travel Agents */}
            <div className="flex flex-col flex-1 min-h-0 rounded-2xl border-2 border-slate-200 bg-white">
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100 flex-shrink-0">
                <h2 className="text-sm font-semibold text-slate-600">
                  Travel Agents
                  <span className="ml-1.5 text-xs font-normal text-slate-400">({agents.length})</span>
                </h2>
                <button type="button" className={btnPrimary} onClick={() => setDialog({ type: 'create_agent' })}>
                  + Add Agent
                </button>
              </div>
              <div className="overflow-y-auto flex-1">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-xs text-slate-400 animate-pulse">Loading…</p>
                  </div>
                ) : agents.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-xs font-medium text-slate-400">No travel agents yet.</p>
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-sm">
                      <tr className="text-xs font-medium text-slate-400 border-b border-slate-100">
                        <th className="px-5 py-2 font-medium">Agency</th>
                        <th className="px-3 py-2 font-medium">IATA</th>
                        <th className="px-3 py-2 font-medium">Commission</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-5 py-2 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {agents.map(a => (
                        <tr key={a.id} className="transition-colors hover:bg-slate-50/60">
                          <td className="px-5 py-2">
                            <p className="text-xs font-semibold text-slate-900">{a.name}</p>
                            {(a.contactPerson || a.email) && (
                              <p className="text-[10px] text-slate-400">{a.contactPerson ?? a.email}</p>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {a.iataCode
                              ? <span className="font-mono text-[10px] font-semibold text-slate-600">{a.iataCode}</span>
                              : <span className="text-[10px] text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2">
                            {a.commissionRate != null
                              ? <span className="text-xs font-semibold text-slate-700">{a.commissionRate}%</span>
                              : <span className="text-[10px] text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${a.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                              {a.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-5 py-2 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button type="button" onClick={() => setDialog({ type: 'edit_agent', agent: a })}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" title="Edit">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                              </button>
                              <button type="button" onClick={() => handleToggleAgent(a)}
                                className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${a.active ? 'text-slate-400 hover:bg-amber-50 hover:text-amber-600' : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'}`}
                                title={a.active ? 'Deactivate' : 'Activate'}>
                                {a.active ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </button>
                              <button type="button" onClick={() => setDialog({ type: 'delete_agent', agent: a })}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600" title="Delete">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

          </div>{/* end left column */}

          {/* ── Right column: Bill Ledger ── */}
          <div className="flex flex-col w-1/2 min-h-0 rounded-2xl border-2 border-slate-200 bg-white">
            <BillLedgerTab />
          </div>

        </div>{/* end panel row */}
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* MODALS                                                */}
      {/* ═══════════════════════════════════════════════════════ */}

      {dialog?.type === 'edit_user' && (
        <ModalShell title={`Edit ${dialog.user.username}`} subtitle="Update user details" onClose={() => setDialog(null)}>
          <UserForm mode="edit" initialData={dialog.user} allProperties={allProperties} allPosLocations={allPosLocations}
            onSubmit={async (data) => handleSaveUser(data as UpdateUserRequest)} onCancel={() => setDialog(null)} />
        </ModalShell>
      )}

      {dialog?.type === 'create_user' && (
        <ModalShell title="Create User" subtitle="Add a new system user" onClose={() => setDialog(null)}>
          <UserForm mode="create" allProperties={allProperties} allPosLocations={allPosLocations}
            onSubmit={async (data) => handleCreateUser(data as CreateUserRequest)} onCancel={() => setDialog(null)} />
        </ModalShell>
      )}

      {dialog?.type === 'delete_user' && (
        <ModalShell title={`Delete ${dialog.user.username}?`} onClose={() => setDialog(null)}>
          <div className="space-y-4">
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
              <strong>Warning:</strong> This action cannot be undone. The user <strong>{dialog.user.username}</strong> ({roleLabel[dialog.user.role] ?? dialog.user.role}) will be permanently removed.
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className={btnSecondary} onClick={() => setDialog(null)}>Cancel</button>
              <button type="button" className={btnDanger} onClick={handleDeleteUser}>Confirm Deletion</button>
            </div>
          </div>
        </ModalShell>
      )}

      {dialog?.type === 'create_agent' && (
        <ModalShell title="Add Travel Agent" subtitle="Register a new travel agency" onClose={() => setDialog(null)}>
          <AgentForm mode="create" onSubmit={async (data) => handleCreateAgent(data)} onCancel={() => setDialog(null)} />
        </ModalShell>
      )}

      {dialog?.type === 'edit_agent' && (
        <ModalShell title={`Edit ${dialog.agent.name}`} subtitle="Update travel agent details" onClose={() => setDialog(null)}>
          <AgentForm mode="edit" initialData={dialog.agent} onSubmit={async (data) => handleSaveAgent(data)} onCancel={() => setDialog(null)} />
        </ModalShell>
      )}

      {dialog?.type === 'delete_agent' && (
        <ModalShell title={`Delete ${dialog.agent.name}?`} onClose={() => setDialog(null)}>
          <div className="space-y-4">
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
              <strong>Warning:</strong> This cannot be undone.
              {dialog.agent.active
                ? ' Consider deactivating instead — deactivated agents are hidden from booking forms but preserve history.'
                : ' Deletion will fail if this agent has associated bookings.'}
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className={btnSecondary} onClick={() => setDialog(null)}>Cancel</button>
              <button type="button" className={btnDanger} onClick={handleDeleteAgent}>Delete Agent</button>
            </div>
          </div>
        </ModalShell>
      )}

      {showRestartConfirm && (
        <ConfirmModal
          title="Restart Server"
          message="The server will shutdown and come back online shortly. It will be inaccessible for upto 5 minutes. Are you sure you want to restart?"
          confirmLabel="Restart"
          variant="danger"
          loading={restarting}
          onConfirm={() => { setShowRestartConfirm(false); void handleRestart(); }}
          onCancel={() => setShowRestartConfirm(false)}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* User Form                                                     */
/* ────────────────────────────────────────────────────────────── */

const inputCls_ = inputCls;

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

  const toggleProperty = (id: string) =>
    setPropertyIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  const handleSubmit = async () => {
    if (mode === 'create') {
      if (!username.trim()) { setError('Username is required.'); return; }
      if (!password.trim()) { setError('Password is required.'); return; }
    }
    setSaving(true); setError(null);
    try {
      if (mode === 'create') {
        await onSubmit({ username: username.trim(), password, email: email.trim() || undefined, role, propertyIds: propertyIds.length > 0 ? propertyIds : undefined, posLocationId: posLocationId || undefined } satisfies CreateUserRequest);
      } else {
        await onSubmit({ email: email.trim() || undefined, password: password.trim() || undefined, role, propertyIds, posLocationId: posLocationId || null } satisfies UpdateUserRequest);
      }
    } catch (e: any) { setError(e.message || 'Something went wrong'); }
    finally { setSaving(false); }
  };

  const roleOptions = mode === 'create' ? ROLES : ROLES_NO_ADMIN;

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</div>}

      {mode === 'create' ? (
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Username <span className="text-rose-500">*</span></label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. john_doe" className={inputCls_} />
        </div>
      ) : (
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
          <p className="text-xs font-semibold text-slate-400">Username</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900">{initialData?.username}</p>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Password {mode === 'create' && <span className="text-rose-500">*</span>}</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'edit' ? 'Leave blank to keep current' : ''} className={inputCls_} />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Optional" className={inputCls_} />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Role <span className="text-rose-500">*</span></label>
        <select value={role} onChange={e => setRole(e.target.value)} className={inputCls_}>
          {roleOptions.map(r => <option key={r} value={r}>{roleLabel[r] ?? r}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Properties</label>
        {allProperties.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-100 py-3 text-center">
            <p className="text-xs font-medium text-slate-400">No properties available.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-36 overflow-y-auto">
            {allProperties.map(p => (
              <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer transition-colors">
                <input type="checkbox" checked={propertyIds.includes(p.id)} onChange={() => toggleProperty(p.id)} className="accent-emerald-600 h-3.5 w-3.5" />
                <span className="text-sm text-slate-700">{p.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5">POS Location</label>
        <select value={posLocationId} onChange={e => setPosLocationId(e.target.value)} className={inputCls_}>
          <option value="">None</option>
          {allPosLocations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
        </select>
      </div>

      <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
        <button type="button" className={btnSecondary} onClick={onCancel}>Cancel</button>
        <button type="button" className={btnPrimary} onClick={handleSubmit} disabled={saving}>
          {saving ? (mode === 'create' ? 'Creating…' : 'Saving…') : (mode === 'create' ? 'Create User' : 'Save Changes')}
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Agent Form                                                    */
/* ────────────────────────────────────────────────────────────── */

interface AgentFormProps {
  mode: 'create' | 'edit';
  initialData?: TravelAgent;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}

function AgentForm({ mode, initialData, onSubmit, onCancel }: AgentFormProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [contactPerson, setContactPerson] = useState(initialData?.contactPerson ?? '');
  const [email, setEmail] = useState(initialData?.email ?? '');
  const [phone, setPhone] = useState(initialData?.phone ?? '');
  const [iataCode, setIataCode] = useState(initialData?.iataCode ?? '');
  const [commissionRate, setCommissionRate] = useState(initialData?.commissionRate?.toString() ?? '');
  const [address, setAddress] = useState(initialData?.address ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Agency name is required.'); return; }
    setSaving(true); setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        contactPerson: contactPerson.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        iataCode: iataCode.trim() || undefined,
        commissionRate: commissionRate ? Number(commissionRate) : undefined,
        address: address.trim() || undefined,
      });
    } catch (e: any) { setError(e.message || 'Something went wrong'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</div>}

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Agency Name <span className="text-rose-500">*</span></label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cox & Kings" className={inputCls_} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Contact Person</label>
          <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} className={inputCls_} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls_} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Phone</label>
          <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className={inputCls_} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">IATA Code</label>
          <input type="text" value={iataCode} onChange={e => setIataCode(e.target.value)} placeholder="e.g. 12345678" className={inputCls_} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Commission Rate (%)</label>
          <input type="number" min={0} max={100} step={0.01} value={commissionRate} onChange={e => setCommissionRate(e.target.value)} placeholder="e.g. 10" className={inputCls_} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Address</label>
          <input type="text" value={address} onChange={e => setAddress(e.target.value)} className={inputCls_} />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
        <button type="button" className={btnSecondary} onClick={onCancel}>Cancel</button>
        <button type="button" className={btnPrimary} onClick={handleSubmit} disabled={saving}>
          {saving ? (mode === 'create' ? 'Adding…' : 'Saving…') : (mode === 'create' ? 'Add Agent' : 'Save Changes')}
        </button>
      </div>
    </div>
  );
}
