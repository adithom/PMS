import { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import posApi from '../api/posApi';
import ConfirmModal from '../components/ConfirmModal';
import type {
  PosLocation, PosItemCategory, PosProduct, PosOrder, OrderSummary,
  PosLocationCreationDto, PosItemCategoryCreationDto, PosProductCreationDto,
} from '../types/pos';

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
const tabs = ['Outlets', 'Categories & Items', 'Walk-in Folios', 'Order History'] as const;
type Tab = typeof tabs[number];

const inputCls = 'border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow w-full';
const selectCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow';

// ─── DateInput — dd/mm/yyyy display, native calendar picker ──────────────────

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const display = value ? value.split('-').reverse().join('/') : '';
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => ref.current?.showPicker()}
        className={`${selectCls} flex items-center gap-2`}
      >
        <span className="tabular-nums">{display}</span>
        <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
      </button>
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 pointer-events-none"
      />
    </div>
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
        checked ? 'bg-emerald-500' : 'bg-gray-200'
      }`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0.5'
      }`} />
    </button>
  );
}

// ─── OutletsTab ──────────────────────────────────────────────────────────────

function OutletsTab({ propertyId, locations, onRefresh }: { propertyId: string; locations: PosLocation[]; onRefresh: () => void }) {
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<PosLocationCreationDto>>({ propertyId, defaultTaxRate: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const LOCATION_TYPES = ['RESTAURANT', 'BAR', 'SPA', 'BAKERY', 'LAUNDRY', 'SHOP'] as const;

  const handleCreate = async () => {
    if (!form.name || !form.locationType) { setError('Name and type are required'); return; }
    setSubmitting(true); setError(null);
    try {
      await posApi.createLocation({ ...form, propertyId, name: form.name!, locationType: form.locationType!, defaultTaxRate: form.defaultTaxRate ?? 0 });
      setCreating(false); setForm({ propertyId, defaultTaxRate: 0 }); onRefresh();
    } catch { setError('Failed to create outlet'); } finally { setSubmitting(false); }
  };

  const handleUpdate = async (id: string, updates: Record<string, unknown>) => {
    setError(null);
    try { await posApi.updateLocation(id, updates); setEditId(null); onRefresh(); }
    catch { setError('Failed to update outlet'); }
  };

  return (
    <div className="space-y-5">
      {error && <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-700">Outlets <span className="text-gray-400 font-normal">({locations.length})</span></h3>
        <button onClick={() => setCreating(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
          + New Outlet
        </button>
      </div>

      {creating && (
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 space-y-4">
          <h4 className="text-sm font-semibold text-gray-800">New Outlet</h4>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Name *" className={inputCls} value={form.name || ''}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <select className={inputCls} value={form.locationType || ''}
              onChange={e => setForm(f => ({ ...f, locationType: e.target.value }))}>
              <option value="">Type *</option>
              {LOCATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input placeholder="Tax Rate %" type="number" className={inputCls} value={form.defaultTaxRate || ''}
              onChange={e => setForm(f => ({ ...f, defaultTaxRate: parseFloat(e.target.value) || 0 }))} />
            <input placeholder="Service Charge %" type="number" className={inputCls} value={form.serviceChargeRate || ''}
              onChange={e => setForm(f => ({ ...f, serviceChargeRate: parseFloat(e.target.value) || 0 }))} />
            <input placeholder="Opening Time (HH:mm)" className={inputCls} value={form.openingTime || ''}
              onChange={e => setForm(f => ({ ...f, openingTime: e.target.value }))} />
            <input placeholder="Closing Time (HH:mm)" className={inputCls} value={form.closingTime || ''}
              onChange={e => setForm(f => ({ ...f, closingTime: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => { setCreating(false); setError(null); }} className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
            <button onClick={handleCreate} disabled={submitting} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
              {submitting ? 'Creating...' : 'Create Outlet'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tax %</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Service %</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Hours</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Active</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {locations.map(loc => (
              <tr key={loc.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-3.5 font-medium text-gray-900">{loc.name}</td>
                <td className="px-5 py-3.5">
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{loc.locationType}</span>
                </td>
                <td className="px-5 py-3.5 text-gray-600">{loc.defaultTaxRate}%</td>
                <td className="px-5 py-3.5 text-gray-600">{loc.serviceChargeRate ?? 0}%</td>
                <td className="px-5 py-3.5 text-gray-500 text-xs">
                  {loc.openingTime && loc.closingTime ? `${loc.openingTime} – ${loc.closingTime}` : '—'}
                </td>
                <td className="px-5 py-3.5 text-center">
                  <Toggle checked={loc.isActive} onChange={() => handleUpdate(loc.id, { isActive: !loc.isActive })} />
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button onClick={() => setEditId(editId === loc.id ? null : loc.id)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors">Edit</button>
                </td>
              </tr>
            ))}
            {locations.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400 text-sm">No outlets yet. Create your first one.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editId && (() => {
        const loc = locations.find(l => l.id === editId);
        if (!loc) return null;
        return (
          <EditOutletInline key={editId} location={loc}
            onSave={(updates) => handleUpdate(editId, updates)}
            onCancel={() => setEditId(null)} />
        );
      })()}
    </div>
  );
}

function EditOutletInline({ location, onSave, onCancel }: { location: PosLocation; onSave: (u: Record<string, unknown>) => void; onCancel: () => void }) {
  const [name, setName] = useState(location.name);
  const [taxRate, setTaxRate] = useState<string>(String(location.defaultTaxRate));
  const [serviceCharge, setServiceCharge] = useState<string>(String(location.serviceChargeRate ?? 0));
  const [opening, setOpening] = useState(location.openingTime || '');
  const [closing, setClosing] = useState(location.closingTime || '');

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 space-y-4">
      <h4 className="text-sm font-semibold text-gray-800">Editing: <span className="text-blue-600">{location.name}</span></h4>
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="Name" className={inputCls} value={name} onChange={e => setName(e.target.value)} />
        <input placeholder="Tax Rate %" type="number" className={inputCls} value={taxRate} onChange={e => setTaxRate(e.target.value)} />
        <input placeholder="Service Charge %" type="number" className={inputCls} value={serviceCharge} onChange={e => setServiceCharge(e.target.value)} />
        <input placeholder="Opening Time" className={inputCls} value={opening} onChange={e => setOpening(e.target.value)} />
        <input placeholder="Closing Time" className={inputCls} value={closing} onChange={e => setClosing(e.target.value)} />
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onCancel} className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
        <button onClick={() => onSave({ name, defaultTaxRate: parseFloat(taxRate) || 0, serviceChargeRate: parseFloat(serviceCharge) || 0, openingTime: opening || null, closingTime: closing || null })}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm">Save Changes</button>
      </div>
    </div>
  );
}

// ─── CategoriesItemsTab ──────────────────────────────────────────────────────

function CategoriesItemsTab({ locations }: { locations: PosLocation[] }) {
  const [selectedLocationId, setSelectedLocationId] = useState<string>(locations[0]?.id ?? '');
  const [categories, setCategories] = useState<PosItemCategory[]>([]);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addingCategory, setAddingCategory] = useState(false);
  const [catForm, setCatForm] = useState<Partial<PosItemCategoryCreationDto>>({});

  const [addingProduct, setAddingProduct] = useState(false);
  const [prodForm, setProdForm] = useState<Partial<PosProductCreationDto>>({ isAvailable: true });

  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<{
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!selectedLocationId) return;
    setLoading(true); setError(null);
    try {
      const [cats, prods] = await Promise.all([
        posApi.getCategories(selectedLocationId),
        posApi.getProducts(selectedLocationId),
      ]);
      setCategories(cats);
      setProducts(prods);
      if (cats.length > 0 && !selectedCategoryId) setSelectedCategoryId(cats[0].id);
    } catch { setError('Failed to load data'); } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocationId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); setSelectedCategoryId(null); }, [selectedLocationId]);

  const filteredProducts = selectedCategoryId ? products.filter(p => p.categoryId === selectedCategoryId) : products;

  const handleAddCategory = async () => {
    if (!catForm.name) { setError('Name required'); return; }
    setError(null);
    try {
      await posApi.createCategory({ locationId: selectedLocationId, name: catForm.name!, displayOrder: catForm.displayOrder });
      setAddingCategory(false); setCatForm({}); loadData();
    } catch { setError('Failed to create category'); }
  };

  const handleToggleCategoryActive = async (cat: PosItemCategory) => {
    try { await posApi.updateCategory(cat.id, { isActive: !cat.isActive }); loadData(); }
    catch { setError('Failed to update category'); }
  };

  const handleReorderCategory = async (cat: PosItemCategory, direction: 'up' | 'down') => {
    const newOrder = cat.displayOrder + (direction === 'up' ? -1 : 1);
    try { await posApi.updateCategory(cat.id, { displayOrder: newOrder }); loadData(); }
    catch { setError('Failed to reorder'); }
  };

  const handleDeleteCategory = (cat: PosItemCategory) => {
    setPendingDelete({
      title: 'Delete Category',
      message: `Delete category "${cat.name}"? This cannot be undone.`,
      onConfirm: async () => {
        await posApi.deleteCategory(cat.id);
        loadData();
        setSelectedCategoryId(null);
      },
    });
  };

  const handleAddProduct = async () => {
    if (!prodForm.name || prodForm.price == null || !selectedCategoryId) {
      setError('Name and price are required'); return;
    }
    setError(null);
    try {
      await posApi.createProduct({
        locationId: selectedLocationId,
        name: prodForm.name!,
        description: prodForm.description,
        categoryId: selectedCategoryId,
        price: prodForm.price!,
        cost: prodForm.cost,
        taxRate: prodForm.taxRate,
        discountRate: prodForm.discountRate,
        isAvailable: prodForm.isAvailable ?? true,
        preparationTime: prodForm.preparationTime,
        imageUrl: prodForm.imageUrl,
      });
      setAddingProduct(false); setProdForm({ isAvailable: true }); loadData();
    } catch { setError('Failed to add product'); }
  };

  const handleUpdateProduct = async (id: string, updates: Record<string, unknown>) => {
    try { await posApi.updateProduct(id, updates); setEditingProductId(null); loadData(); }
    catch { setError('Failed to update product'); }
  };

  const handleDeleteProduct = (product: PosProduct) => {
    setPendingDelete({
      title: 'Delete Item',
      message: `Delete "${product.name}"? This cannot be undone.`,
      onConfirm: async () => {
        await posApi.deleteProduct(product.id);
        loadData();
      },
    });
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;
    setDeleteLoading(true);
    try {
      await pendingDelete.onConfirm();
      setPendingDelete(null);
    } catch {
      setError('Failed to delete item');
      setPendingDelete(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
    <div className="space-y-5">
      {error && <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Outlet</label>
        <select value={selectedLocationId} onChange={e => setSelectedLocationId(e.target.value)} className={selectCls}>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {loading ? <div className="text-center py-12 text-gray-400 text-sm">Loading...</div> : (
        <div className="flex gap-5">
          {/* Left: Categories sidebar */}
          <div className="w-64 flex-shrink-0 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-700">Categories</span>
              <button onClick={() => setAddingCategory(true)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm">+ Add</button>
            </div>

            {addingCategory && (
              <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-3 space-y-2.5">
                <input placeholder="Category name *" className={inputCls} value={catForm.name || ''}
                  onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} />
                <div className="flex gap-1.5 justify-end">
                  <button onClick={() => { setAddingCategory(false); setError(null); }} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg font-medium hover:bg-gray-50 transition-colors">Cancel</button>
                  <button onClick={handleAddCategory} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">Add</button>
                </div>
              </div>
            )}

            <div className="space-y-1">
              {categories.map(cat => (
                <div
                  key={cat.id}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-all ${
                    selectedCategoryId === cat.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-100'
                  } ${!cat.isActive ? 'opacity-40' : ''}`}
                  onClick={() => setSelectedCategoryId(cat.id)}>
                  <span className="truncate flex-1 font-medium">{cat.name}</span>
                  <div className="flex items-center gap-0.5 ml-2">
                    <button onClick={e => { e.stopPropagation(); handleReorderCategory(cat, 'up'); }}
                      className={`text-xs px-0.5 transition-colors ${selectedCategoryId === cat.id ? 'text-blue-200 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`} title="Move up">▲</button>
                    <button onClick={e => { e.stopPropagation(); handleReorderCategory(cat, 'down'); }}
                      className={`text-xs px-0.5 transition-colors ${selectedCategoryId === cat.id ? 'text-blue-200 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`} title="Move down">▼</button>
                    <button onClick={e => { e.stopPropagation(); handleToggleCategoryActive(cat); }}
                      className={`text-xs px-1 font-medium transition-colors ${selectedCategoryId === cat.id ? 'text-blue-200 hover:text-white' : cat.isActive ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {cat.isActive ? 'on' : 'off'}
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDeleteCategory(cat); }}
                      className={`text-xs px-0.5 transition-colors ${selectedCategoryId === cat.id ? 'text-blue-200 hover:text-white' : 'text-red-400 hover:text-red-600'}`}>&times;</button>
                  </div>
                </div>
              ))}
              {categories.length === 0 && <div className="text-xs text-gray-400 text-center py-6">No categories yet</div>}
            </div>
          </div>

          {/* Right: Products in selected category */}
          <div className="flex-1 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-700">
                Items {selectedCategoryId ? <span className="text-gray-500 font-normal">in "{categories.find(c => c.id === selectedCategoryId)?.name || ''}"</span> : <span className="text-gray-500 font-normal">(all)</span>}
              </span>
              {selectedCategoryId && (
                <button onClick={() => setAddingProduct(true)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm">+ Add Item</button>
              )}
            </div>

            {addingProduct && selectedCategoryId && (
              <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-semibold text-gray-800">New Item</h4>
                <div className="grid grid-cols-3 gap-3">
                  <input placeholder="Name *" className={inputCls} value={prodForm.name || ''}
                    onChange={e => setProdForm(f => ({ ...f, name: e.target.value }))} />
                  <input placeholder="Price *" type="number" className={inputCls} value={prodForm.price || ''}
                    onChange={e => setProdForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
                  <input placeholder="Tax %" type="number" className={inputCls} value={prodForm.taxRate || ''}
                    onChange={e => setProdForm(f => ({ ...f, taxRate: parseFloat(e.target.value) || 0 }))} />
                  <input placeholder="Discount %" type="number" className={inputCls} value={prodForm.discountRate || ''}
                    onChange={e => setProdForm(f => ({ ...f, discountRate: parseFloat(e.target.value) || 0 }))} />
                  <input placeholder="Description" className={inputCls} value={prodForm.description || ''}
                    onChange={e => setProdForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button onClick={() => { setAddingProduct(false); setError(null); }} className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                  <button onClick={handleAddProduct} className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm">Add Item</button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Price</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Disc %</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tax %</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Avail</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredProducts.map(prod => (
                    editingProductId === prod.id ? (
                      <EditProductRow key={prod.id} product={prod} onSave={u => handleUpdateProduct(prod.id, u)} onCancel={() => setEditingProductId(null)} />
                    ) : (
                      <tr key={prod.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3.5 font-medium text-gray-900">{prod.name}</td>
                        <td className="px-4 py-3.5 text-right font-medium text-gray-800">{fmt(prod.price)}</td>
                        <td className="px-4 py-3.5 text-right text-gray-500">{prod.discountRate ?? 0}%</td>
                        <td className="px-4 py-3.5 text-right text-gray-500">{prod.taxRate}%</td>
                        <td className="px-4 py-3.5 text-center">
                          <Toggle checked={prod.isAvailable} onChange={() => handleUpdateProduct(prod.id, { isAvailable: !prod.isAvailable })} />
                        </td>
                        <td className="px-4 py-3.5 text-right space-x-3">
                          <button onClick={() => setEditingProductId(prod.id)} className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors">Edit</button>
                          <button onClick={() => handleDeleteProduct(prod)} className="text-red-400 hover:text-red-600 text-sm font-medium transition-colors">Del</button>
                        </td>
                      </tr>
                    )
                  ))}
                  {filteredProducts.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">
                      {selectedCategoryId ? 'No items in this category yet.' : 'Select a category to view items.'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>

    {pendingDelete && (
      <ConfirmModal
        title={pendingDelete.title}
        message={pendingDelete.message}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDelete(null)}
      />
    )}
    </>
  );
}

function EditProductRow({ product, onSave, onCancel }: { product: PosProduct; onSave: (u: Record<string, unknown>) => void; onCancel: () => void }) {
  const [price, setPrice] = useState<string>(String(product.price));
  const [discount, setDiscount] = useState<string>(String(product.discountRate ?? 0));
  const [tax, setTax] = useState<string>(String(product.taxRate));
  const [name, setName] = useState(product.name);
  const rowInput = 'border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full';

  return (
    <tr className="bg-blue-50/50">
      <td className="px-4 py-2.5"><input className={rowInput} value={name} onChange={e => setName(e.target.value)} /></td>
      <td className="px-4 py-2.5"><input type="number" className={`${rowInput} w-24 text-right`} value={price} onChange={e => setPrice(e.target.value)} /></td>
      <td className="px-4 py-2.5"><input type="number" className={`${rowInput} w-20 text-right`} value={discount} onChange={e => setDiscount(e.target.value)} /></td>
      <td className="px-4 py-2.5"><input type="number" className={`${rowInput} w-20 text-right`} value={tax} onChange={e => setTax(e.target.value)} /></td>
      <td className="px-4 py-2.5 text-center text-gray-400">—</td>
      <td className="px-4 py-2.5 text-right space-x-2">
        <button onClick={() => onSave({ name, price: parseFloat(price) || 0, discountRate: parseFloat(discount) || 0, taxRate: parseFloat(tax) || 0 })} className="text-emerald-600 hover:text-emerald-800 text-sm font-medium transition-colors">Save</button>
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors">Cancel</button>
      </td>
    </tr>
  );
}

// ─── WalkInFoliosTab ─────────────────────────────────────────────────────────

function WalkInFoliosTab({ locations, onRefresh }: { locations: PosLocation[]; onRefresh: () => void }) {
  const [posting, setPosting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePost = async (locId: string) => {
    setPosting(locId); setError(null);
    try {
      await posApi.postWalkInFolio(locId);
      setConfirmId(null); onRefresh();
    } catch { setError('Failed to post walk-in folio'); } finally { setPosting(null); }
  };

  return (
    <div className="space-y-5">
      {error && <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Outlet</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Walk-in Folio</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {locations.map(loc => (
              <tr key={loc.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-3.5 font-medium text-gray-900">{loc.name}</td>
                <td className="px-5 py-3.5">
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{loc.locationType}</span>
                </td>
                <td className="px-5 py-3.5">
                  {loc.currentWalkInFolioId ? (
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                      <span className="text-emerald-700 font-medium">Active</span>
                      <span className="text-gray-400 text-xs">({loc.currentWalkInFolioId.slice(0, 8)})</span>
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm">No active folio</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right">
                  {confirmId === loc.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-amber-700 font-medium">Confirm?</span>
                      <button onClick={() => handlePost(loc.id)} disabled={posting === loc.id}
                        className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors font-medium shadow-sm">
                        {posting === loc.id ? 'Posting...' : 'Yes, Post'}
                      </button>
                      <button onClick={() => setConfirmId(null)} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmId(loc.id)} disabled={!loc.currentWalkInFolioId}
                      className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-sm">
                      Post & Archive
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── OrderHistoryTab ─────────────────────────────────────────────────────────

function OrderHistoryTab({ locations }: { locations: PosLocation[] }) {
  const [selectedLocationId, setSelectedLocationId] = useState<string>(locations[0]?.id ?? '');
  const toISTDate = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const today = toISTDate(new Date());
  const thirtyDaysAgo = toISTDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [fromDate, setFromDate] = useState(thirtyDaysAgo);
  const [toDate, setToDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!selectedLocationId) return;
    setLoading(true);
    setOrderError(null);
    try {
      const [orderResult, summaryResult] = await Promise.allSettled([
        posApi.getOrders(selectedLocationId, fromDate, toDate, statusFilter || undefined),
        posApi.getOrderSummary(selectedLocationId, fromDate, toDate),
      ]);
      if (orderResult.status === 'fulfilled') {
        setOrders(orderResult.value);
      } else {
        setOrders([]);
        setOrderError('Failed to load orders. Please try again.');
      }
      setSummary(summaryResult.status === 'fulfilled' ? summaryResult.value : null);
    } finally { setLoading(false); }
  }, [selectedLocationId, fromDate, toDate, statusFilter]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex flex-wrap items-center gap-4">
        <select value={selectedLocationId} onChange={e => setSelectedLocationId(e.target.value)} className={selectCls}>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 whitespace-nowrap">From</label>
          <DateInput value={fromDate} onChange={setFromDate} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 whitespace-nowrap">To</label>
          <DateInput value={toDate} onChange={setToDate} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectCls}>
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="CLOSED">Closed</option>
          <option value="CHARGED">Charged</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 border-t-2 border-t-emerald-500">
            <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">Total Revenue</div>
            <div className="text-2xl font-bold text-gray-900">{fmt(summary.totalRevenue)}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 border-t-2 border-t-blue-500">
            <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">Orders</div>
            <div className="text-2xl font-bold text-gray-900">{summary.orderCount}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 border-t-2 border-t-purple-500">
            <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">Avg Order Value</div>
            <div className="text-2xl font-bold text-gray-900">{fmt(summary.avgOrderValue)}</div>
          </div>
        </div>
      )}

      {orderError && (
        <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {orderError}
        </div>
      )}

      {/* Orders table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Loading orders...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Order #</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Items</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Subtotal</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Discount</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.map(order => (
                <>
                  <tr key={order.id} className="hover:bg-gray-50/50 cursor-pointer transition-colors" onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}>
                    <td className="px-5 py-3.5 font-medium text-gray-900">{order.orderNumber}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">
                      {new Date(order.orderDate).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' })}
                      {' '}
                      {new Date(order.orderDate).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3.5 text-right text-gray-600">{order.items?.length ?? 0}</td>
                    <td className="px-5 py-3.5 text-right text-gray-600">{fmt(order.subtotal)}</td>
                    <td className="px-5 py-3.5 text-right">
                      {order.discountAmount > 0 ? <span className="text-emerald-600 font-medium">−{fmt(order.discountAmount)}</span> : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-gray-900">{fmt(order.totalAmount)}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                        order.status === 'CLOSED' ? 'bg-emerald-100 text-emerald-700' :
                        order.status === 'CHARGED' ? 'bg-blue-100 text-blue-700' :
                        order.status === 'CANCELLED' ? 'bg-red-100 text-red-600' :
                        'bg-amber-100 text-amber-700'
                      }`}>{order.status}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center text-xs text-gray-500">{order.paymentStatus}</td>
                  </tr>
                  {expandedId === order.id && order.items && (
                    <tr key={`${order.id}-detail`}>
                      <td colSpan={8} className="bg-gray-50 px-8 py-4">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500 border-b border-gray-200">
                              <th className="text-left pb-2 font-medium">Item</th>
                              <th className="text-right pb-2 font-medium">Qty</th>
                              <th className="text-right pb-2 font-medium">Unit Price</th>
                              <th className="text-right pb-2 font-medium">Tax</th>
                              <th className="text-right pb-2 font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map((item, idx) => (
                              <tr key={idx} className="border-t border-gray-100">
                                <td className="py-1.5 text-gray-800">{item.itemName}</td>
                                <td className="py-1.5 text-right text-gray-600">{item.quantity}</td>
                                <td className="py-1.5 text-right text-gray-600">{fmt(item.unitPrice)}</td>
                                <td className="py-1.5 text-right text-gray-600">{fmt(item.taxAmount)}</td>
                                <td className="py-1.5 text-right font-semibold text-gray-800">{fmt(item.totalAmount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {order.createdBy && <div className="mt-3 text-xs text-gray-400">Created by: {order.createdBy}</div>}
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400 text-sm">No orders found for this period.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Main PosManagement ──────────────────────────────────────────────────────

export default function PosManagement() {
  const { user } = useAuth();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(user?.properties?.[0]?.id ?? '');
  const [locations, setLocations] = useState<PosLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('Outlets');

  const loadLocations = useCallback(async () => {
    if (!selectedPropertyId) return;
    setLoading(true);
    try {
      const locs = await posApi.getLocations(selectedPropertyId);
      setLocations(locs);
    } catch { /* handled by child */ } finally { setLoading(false); }
  }, [selectedPropertyId]);

  useEffect(() => { loadLocations(); }, [loadLocations]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">POS Management</h1>
            {(user.properties?.length ?? 0) > 1 && (
              <select
                value={selectedPropertyId}
                onChange={e => { setSelectedPropertyId(e.target.value); setLocations([]); }}
                className={selectCls}
              >
                {user.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}>{tab}</button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading...</div>
        ) : (
          <>
            {activeTab === 'Outlets' && (
              <OutletsTab propertyId={selectedPropertyId} locations={locations} onRefresh={loadLocations} />
            )}
            {activeTab === 'Categories & Items' && (
              locations.length > 0
                ? <CategoriesItemsTab locations={locations} />
                : <div className="text-center py-16 text-gray-400 text-sm">Create an outlet first.</div>
            )}
            {activeTab === 'Walk-in Folios' && (
              <WalkInFoliosTab locations={locations} onRefresh={loadLocations} />
            )}
            {activeTab === 'Order History' && (
              locations.length > 0
                ? <OrderHistoryTab locations={locations} />
                : <div className="text-center py-16 text-gray-400 text-sm">No outlets available.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
