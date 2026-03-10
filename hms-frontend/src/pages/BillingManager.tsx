import { useState, useEffect } from 'react';
import propertyApi from '../api/propertyApi';
import folioApi, { type Folio } from '../api/folioApi';
import type { Property } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

export default function BillingManager() {
    // const { user } = useAuth();
    const [properties, setProperties] = useState<Property[]>([]);
    const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
    const [folios, setFolios] = useState<Folio[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('ALL');

    useEffect(() => {
        loadProperties();
    }, []);

    useEffect(() => {
        if (selectedPropertyId) {
            loadFolios(selectedPropertyId);
        }
    }, [selectedPropertyId]);

    const loadProperties = async () => {
        try {
            const data = await propertyApi.getAll();
            setProperties(data || []);
            if (data && data.length > 0) {
                setSelectedPropertyId(data[0].id);
            }
        } catch (err) {
            setError('Failed to load properties');
        }
    };

    const loadFolios = async (propertyId: string) => {
        setLoading(true);
        try {
            const data = await folioApi.getAll(propertyId);
            setFolios(data || []);
        } catch (err) {
            setError('Failed to load folios');
            setFolios([]);
        } finally {
            setLoading(false);
        }
    };

    const filteredFolios = folios.filter(f => {
        if (filterStatus === 'ALL') return true;
        return f.status === filterStatus;
    });

    return (
        <div className="page">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800 m-0">Billing Manager</h1>

                <div className="flex gap-4">
                    <select
                        className="form-select rounded-md border-gray-300 shadow-sm"
                        value={selectedPropertyId}
                        onChange={(e) => setSelectedPropertyId(e.target.value)}
                    >
                        {properties.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md border border-red-200">
                    {error}
                </div>
            )}

            <div className="card p-0 overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex gap-4 bg-gray-50">
                    <button
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${filterStatus === 'ALL' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-200'}`}
                        onClick={() => setFilterStatus('ALL')}
                    >
                        All
                    </button>
                    <button
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${filterStatus === 'OPEN' ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-200'}`}
                        onClick={() => setFilterStatus('OPEN')}
                    >
                        Open
                    </button>
                    <button
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${filterStatus === 'CLOSED' ? 'bg-yellow-100 text-yellow-700' : 'text-gray-600 hover:bg-gray-200'}`}
                        onClick={() => setFilterStatus('CLOSED')}
                    >
                        Closed
                    </button>
                    <button
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${filterStatus === 'POSTED' ? 'bg-gray-100 text-gray-700' : 'text-gray-600 hover:bg-gray-200'}`}
                        onClick={() => setFilterStatus('POSTED')}
                    >
                        Posted
                    </button>
                </div>

                {loading ? (
                    <div className="p-8 flex justify-center">
                        <LoadingSpinner />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Folio #</th>
                                    <th>Guest</th>
                                    <th>Room</th>
                                    <th>Status</th>
                                    <th className="text-right">Total</th>
                                    <th className="text-right">Balance</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredFolios.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                            No folios found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredFolios.map(folio => (
                                        <tr key={folio.id}>
                                            <td className="font-medium text-blue-600">
                                                {folio.folioNumber}
                                            </td>
                                            <td>
                                                {folio.guestName}
                                            </td>
                                            <td className="text-gray-500">
                                                {folio.roomNumber || '-'}
                                            </td>
                                            <td>
                                                <span className={`badge 
                          ${folio.status === 'OPEN' ? 'badge-success' :
                                                        folio.status === 'CLOSED' ? 'badge-warning' :
                                                            'badge-gray'}`}>
                                                    {folio.status}
                                                </span>
                                            </td>
                                            <td className="text-right font-medium">
                                                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(folio.totalAmount)}
                                            </td>
                                            <td className="text-right font-medium">
                                                <span className={folio.balanceDue > 0 ? 'text-red-600' : 'text-green-600'}>
                                                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(folio.balanceDue)}
                                                </span>
                                            </td>
                                            <td className="text-right">
                                                <button className="text-blue-600 hover:text-blue-900 mr-3 text-sm font-medium">View</button>
                                                <button className="text-gray-600 hover:text-gray-900 text-sm font-medium">Invoice</button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
