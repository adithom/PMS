import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import posApi from '../api/posApi';
import type {
  PosLocation, PosItemCategory, PosProduct, PosOrder, OrderSummary,
  PosLocationCreationDto, PosItemCategoryCreationDto, PosProductCreationDto,
} from '../types/pos';

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
const tabs = ['Outlets', 'Categories & Items', 'Walk-in Folios', 'Order History'] as const;
type Tab = typeof tabs[number];

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
    <div className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}

      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-gray-700">Outlets ({locations.length})</h3>
        <button onClick={() => setCreating(true)} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">+ New Outlet</button>
      </div>

      {creating && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Name *" className="border border-gray-300 rounded px-3 py-2 text-sm" value={form.name || ''}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <select className="border border-gray-300 rounded px-3 py-2 text-sm" value={form.locationType || ''}
              onChange={e => setForm(f => ({ ...f, locationType: e.target.value }))}>
              <option value="">Type *</option>
              {LOCATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input placeholder="Tax Rate %" type="number" className="border border-gray-300 rounded px-3 py-2 text-sm" value={form.defaultTaxRate ?? ''}
              onChange={e => setForm(f => ({ ...f, defaultTaxRate: parseFloat(e.target.value) || 0 }))} />
            <input placeholder="Service Charge %" type="number" className="border border-gray-300 rounded px-3 py-2 text-sm" value={form.serviceChargeRate ?? ''}
              onChange={e => setForm(f => ({ ...f, serviceChargeRate: parseFloat(e.target.value) || 0 }))} />
            <input placeholder="Opening Time (HH:mm)" className="border border-gray-300 rounded px-3 py-2 text-sm" value={form.openingTime || ''}
              onChange={e => setForm(f => ({ ...f, openingTime: e.target.value }))} />
            <input placeholder="Closing Time (HH:mm)" className="border border-gray-300 rounded px-3 py-2 text-sm" value={form.closingTime || ''}
              onChange={e => setForm(f => ({ ...f, closingTime: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setCreating(false); setError(null); }} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
            <button onClick={handleCreate} disabled={submitting} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Creating...' : 'Create Outlet'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Type</th>
              <th className="text-left px-4 py-2 font-medium">Tax %</th>
              <th className="text-left px-4 py-2 font-medium">Service %</th>
              <th className="text-left px-4 py-2 font-medium">Hours</th>
              <th className="text-center px-4 py-2 font-medium">Active</th>
              <th className="text-right px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {locations.map(loc => (
              <tr key={loc.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-gray-800">{loc.name}</td>
                <td className="px-4 py-2 text-gray-500">{loc.locationType}</td>
                <td className="px-4 py-2 text-gray-500">{loc.defaultTaxRate}%</td>
                <td className="px-4 py-2 text-gray-500">{loc.serviceChargeRate ?? 0}%</td>
                <td className="px-4 py-2 text-gray-500 text-xs">
                  {loc.openingTime && loc.closingTime ? `${loc.openingTime} - ${loc.closingTime}` : '—'}
                </td>
                <td className="px-4 py-2 text-center">
                  <button onClick={() => handleUpdate(loc.id, { isActive: !loc.isActive })}
                    className={`w-4 h-4 rounded border cursor-pointer ${loc.isActive ? 'bg-green-500 border-green-600' : 'bg-gray-200 border-gray-300'}`} />
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => setEditId(editId === loc.id ? null : loc.id)}
                    className="text-blue-600 hover:text-blue-800 text-xs">Edit</button>
                </td>
              </tr>
            ))}
            {locations.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No outlets yet. Create your first one.</td></tr>
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
  const [taxRate, setTaxRate] = useState(location.defaultTaxRate);
  const [serviceCharge, setServiceCharge] = useState(location.serviceChargeRate ?? 0);
  const [opening, setOpening] = useState(location.openingTime || '');
  const [closing, setClosing] = useState(location.closingTime || '');

  return (
    <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-medium text-blue-800">Editing: {location.name}</h4>
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="Name" className="border border-gray-300 rounded px-3 py-2 text-sm" value={name} onChange={e => setName(e.target.value)} />
        <input placeholder="Tax Rate %" type="number" className="border border-gray-300 rounded px-3 py-2 text-sm" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} />
        <input placeholder="Service Charge %" type="number" className="border border-gray-300 rounded px-3 py-2 text-sm" value={serviceCharge} onChange={e => setServiceCharge(parseFloat(e.target.value) || 0)} />
        <input placeholder="Opening Time" className="border border-gray-300 rounded px-3 py-2 text-sm" value={opening} onChange={e => setOpening(e.target.value)} />
        <input placeholder="Closing Time" className="border border-gray-300 rounded px-3 py-2 text-sm" value={closing} onChange={e => setClosing(e.target.value)} />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
        <button onClick={() => onSave({ name, defaultTaxRate: taxRate, serviceChargeRate: serviceCharge, openingTime: opening || null, closingTime: closing || null })}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
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

  // Category form
  const [addingCategory, setAddingCategory] = useState(false);
  const [catForm, setCatForm] = useState<Partial<PosItemCategoryCreationDto>>({});

  // Product form
  const [addingProduct, setAddingProduct] = useState(false);
  const [prodForm, setProdForm] = useState<Partial<PosProductCreationDto>>({ isAvailable: true });

  // Inline editing
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

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

  const handleDeleteCategory = async (cat: PosItemCategory) => {
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    try { await posApi.deleteCategory(cat.id); loadData(); setSelectedCategoryId(null); }
    catch { setError('Failed to delete category'); }
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

  const handleDeleteProduct = async (product: PosProduct) => {
    if (!confirm(`Delete "${product.name}"?`)) return;
    try { await posApi.deleteProduct(product.id); loadData(); }
    catch { setError('Failed to delete product'); }
  };

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}

      {/* Location selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-600">Outlet:</label>
        <select value={selectedLocationId} onChange={e => setSelectedLocationId(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {loading ? <div className="text-center py-8 text-gray-500">Loading...</div> : (
        <div className="flex gap-4">
          {/* Left: Categories sidebar */}
          <div className="w-64 flex-shrink-0 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Categories</span>
              <button onClick={() => setAddingCategory(true)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">+ Add</button>
            </div>

            {addingCategory && (
              <div className="border border-blue-200 bg-blue-50 rounded p-2 space-y-2">
                <input placeholder="Name *" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" value={catForm.name || ''}
                  onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} />
                <div className="flex gap-1 justify-end">
                  <button onClick={() => { setAddingCategory(false); setError(null); }} className="text-xs px-2 py-1 border border-gray-300 rounded">Cancel</button>
                  <button onClick={handleAddCategory} className="text-xs px-2 py-1 bg-blue-600 text-white rounded">Add</button>
                </div>
              </div>
            )}

            <div className="space-y-1">
              {categories.map(cat => (
                <div key={cat.id}
                  className={`flex items-center justify-between px-3 py-2 rounded cursor-pointer text-sm transition-colors ${
                    selectedCategoryId === cat.id ? 'bg-blue-100 text-blue-800 font-medium' : 'bg-white text-gray-700 hover:bg-gray-50'
                  } ${!cat.isActive ? 'opacity-50' : ''}`}
                  onClick={() => setSelectedCategoryId(cat.id)}>
                  <span className="truncate flex-1">{cat.name}</span>
                  <div className="flex items-center gap-0.5 ml-2">
                    <button onClick={e => { e.stopPropagation(); handleReorderCategory(cat, 'up'); }}
                      className="text-gray-400 hover:text-gray-600 text-xs px-0.5" title="Move up">&#9650;</button>
                    <button onClick={e => { e.stopPropagation(); handleReorderCategory(cat, 'down'); }}
                      className="text-gray-400 hover:text-gray-600 text-xs px-0.5" title="Move down">&#9660;</button>
                    <button onClick={e => { e.stopPropagation(); handleToggleCategoryActive(cat); }}
                      className={`text-xs px-1 ${cat.isActive ? 'text-green-600' : 'text-gray-400'}`} title="Toggle active">
                      {cat.isActive ? 'on' : 'off'}
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDeleteCategory(cat); }}
                      className="text-red-400 hover:text-red-600 text-xs px-0.5" title="Delete">&times;</button>
                  </div>
                </div>
              ))}
              {categories.length === 0 && <div className="text-xs text-gray-400 text-center py-4">No categories yet</div>}
            </div>
          </div>

          {/* Right: Products in selected category */}
          <div className="flex-1 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                Items {selectedCategoryId ? `in "${categories.find(c => c.id === selectedCategoryId)?.name || ''}"` : '(all)'}
              </span>
              {selectedCategoryId && (
                <button onClick={() => setAddingProduct(true)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">+ Add Item</button>
              )}
            </div>

            {addingProduct && selectedCategoryId && (
              <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <input placeholder="Name *" className="border border-gray-300 rounded px-2 py-1.5 text-sm" value={prodForm.name || ''}
                    onChange={e => setProdForm(f => ({ ...f, name: e.target.value }))} />
                  <input placeholder="Price *" type="number" className="border border-gray-300 rounded px-2 py-1.5 text-sm" value={prodForm.price ?? ''}
                    onChange={e => setProdForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
                  <input placeholder="Tax %" type="number" className="border border-gray-300 rounded px-2 py-1.5 text-sm" value={prodForm.taxRate ?? ''}
                    onChange={e => setProdForm(f => ({ ...f, taxRate: parseFloat(e.target.value) || 0 }))} />
                  <input placeholder="Discount %" type="number" className="border border-gray-300 rounded px-2 py-1.5 text-sm" value={prodForm.discountRate ?? ''}
                    onChange={e => setProdForm(f => ({ ...f, discountRate: parseFloat(e.target.value) || 0 }))} />
                  <input placeholder="Description" className="border border-gray-300 rounded px-2 py-1.5 text-sm" value={prodForm.description || ''}
                    onChange={e => setProdForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setAddingProduct(false); setError(null); }} className="px-2 py-1 text-xs border border-gray-300 rounded">Cancel</button>
                  <button onClick={handleAddProduct} className="px-2 py-1 text-xs bg-blue-600 text-white rounded">Add Item</button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Name</th>
                    <th className="text-right px-3 py-2 font-medium">Price</th>
                    <th className="text-right px-3 py-2 font-medium">Disc %</th>
                    <th className="text-right px-3 py-2 font-medium">Tax %</th>
                    <th className="text-center px-3 py-2 font-medium">Avail</th>
                    <th className="text-right px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProducts.map(prod => (
                    editingProductId === prod.id ? (
                      <EditProductRow key={prod.id} product={prod} onSave={u => handleUpdateProduct(prod.id, u)} onCancel={() => setEditingProductId(null)} />
                    ) : (
                      <tr key={prod.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-800">{prod.name}</td>
                        <td className="px-3 py-2 text-right text-gray-800">{fmt(prod.price)}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{prod.discountRate ?? 0}%</td>
                        <td className="px-3 py-2 text-right text-gray-500">{prod.taxRate}%</td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => handleUpdateProduct(prod.id, { isAvailable: !prod.isAvailable })}
                            className={`w-4 h-4 rounded border cursor-pointer ${prod.isAvailable ? 'bg-green-500 border-green-600' : 'bg-gray-200 border-gray-300'}`} />
                        </td>
                        <td className="px-3 py-2 text-right space-x-2">
                          <button onClick={() => setEditingProductId(prod.id)} className="text-blue-600 hover:text-blue-800 text-xs">Edit</button>
                          <button onClick={() => handleDeleteProduct(prod)} className="text-red-500 hover:text-red-700 text-xs">Del</button>
                        </td>
                      </tr>
                    )
                  ))}
                  {filteredProducts.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">
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
  );
}

function EditProductRow({ product, onSave, onCancel }: { product: PosProduct; onSave: (u: Record<string, unknown>) => void; onCancel: () => void }) {
  const [price, setPrice] = useState(product.price);
  const [discount, setDiscount] = useState(product.discountRate ?? 0);
  const [tax, setTax] = useState(product.taxRate);
  const [name, setName] = useState(product.name);

  return (
    <tr className="bg-blue-50">
      <td className="px-3 py-2"><input className="border border-gray-300 rounded px-2 py-1 text-sm w-full" value={name} onChange={e => setName(e.target.value)} /></td>
      <td className="px-3 py-2"><input type="number" className="border border-gray-300 rounded px-2 py-1 text-sm w-20 text-right" value={price} onChange={e => setPrice(parseFloat(e.target.value) || 0)} /></td>
      <td className="px-3 py-2"><input type="number" className="border border-gray-300 rounded px-2 py-1 text-sm w-16 text-right" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} /></td>
      <td className="px-3 py-2"><input type="number" className="border border-gray-300 rounded px-2 py-1 text-sm w-16 text-right" value={tax} onChange={e => setTax(parseFloat(e.target.value) || 0)} /></td>
      <td className="px-3 py-2 text-center">—</td>
      <td className="px-3 py-2 text-right space-x-1">
        <button onClick={() => onSave({ name, price, discountRate: discount, taxRate: tax })} className="text-green-600 hover:text-green-800 text-xs">Save</button>
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 text-xs">Cancel</button>
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
    <div className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Outlet</th>
              <th className="text-left px-4 py-2 font-medium">Type</th>
              <th className="text-left px-4 py-2 font-medium">Walk-in Folio Status</th>
              <th className="text-right px-4 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {locations.map(loc => (
              <tr key={loc.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{loc.name}</td>
                <td className="px-4 py-3 text-gray-500">{loc.locationType}</td>
                <td className="px-4 py-3">
                  {loc.currentWalkInFolioId ? (
                    <span className="inline-flex items-center gap-1 text-sm">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span className="text-green-700">Active</span>
                      <span className="text-gray-400 text-xs ml-1">({loc.currentWalkInFolioId.slice(0, 8)})</span>
                    </span>
                  ) : (
                    <span className="text-gray-400">No active folio</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {confirmId === loc.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-amber-700">Confirm?</span>
                      <button onClick={() => handlePost(loc.id)} disabled={posting === loc.id}
                        className="text-xs px-2 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50">
                        {posting === loc.id ? 'Posting...' : 'Yes'}
                      </button>
                      <button onClick={() => setConfirmId(null)} className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50">No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmId(loc.id)} disabled={!loc.currentWalkInFolioId}
                      className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed">
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
  const today = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!selectedLocationId) return;
    setLoading(true);
    try {
      const [orderList, summaryData] = await Promise.all([
        posApi.getOrders(selectedLocationId, fromDate, toDate, statusFilter || undefined),
        posApi.getOrderSummary(selectedLocationId, fromDate, toDate),
      ]);
      setOrders(orderList);
      setSummary(summaryData);
    } catch {
      setOrders([]); setSummary(null);
    } finally { setLoading(false); }
  }, [selectedLocationId, fromDate, toDate, statusFilter]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={selectedLocationId} onChange={e => setSelectedLocationId(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm">
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-600">From:</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-600">To:</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-gray-300 rounded px-3 py-1.5 text-sm">
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
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Total Revenue</div>
            <div className="text-2xl font-bold text-gray-800 mt-1">{fmt(summary.totalRevenue)}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Orders</div>
            <div className="text-2xl font-bold text-gray-800 mt-1">{summary.orderCount}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Avg Order Value</div>
            <div className="text-2xl font-bold text-gray-800 mt-1">{fmt(summary.avgOrderValue)}</div>
          </div>
        </div>
      )}

      {/* Orders table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? <div className="text-center py-8 text-gray-500">Loading orders...</div> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Order #</th>
                <th className="text-left px-4 py-2 font-medium">Date</th>
                <th className="text-right px-4 py-2 font-medium">Items</th>
                <th className="text-right px-4 py-2 font-medium">Subtotal</th>
                <th className="text-right px-4 py-2 font-medium">Discount</th>
                <th className="text-right px-4 py-2 font-medium">Total</th>
                <th className="text-center px-4 py-2 font-medium">Status</th>
                <th className="text-center px-4 py-2 font-medium">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map(order => (
                <>
                  <tr key={order.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}>
                    <td className="px-4 py-2 font-medium text-gray-800">{order.orderNumber}</td>
                    <td className="px-4 py-2 text-gray-500">{new Date(order.orderDate).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{order.items?.length ?? 0}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{fmt(order.subtotal)}</td>
                    <td className="px-4 py-2 text-right text-gray-500">
                      {order.discountAmount > 0 ? <span className="text-green-600">-{fmt(order.discountAmount)}</span> : '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-gray-800">{fmt(order.totalAmount)}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        order.status === 'CLOSED' ? 'bg-green-100 text-green-800' :
                        order.status === 'CHARGED' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>{order.status}</span>
                    </td>
                    <td className="px-4 py-2 text-center text-xs text-gray-500">{order.paymentStatus}</td>
                  </tr>
                  {expandedId === order.id && order.items && (
                    <tr key={`${order.id}-detail`}>
                      <td colSpan={8} className="bg-gray-50 px-8 py-3">
                        <table className="w-full text-xs">
                          <thead><tr className="text-gray-500">
                            <th className="text-left py-1">Item</th>
                            <th className="text-right py-1">Qty</th>
                            <th className="text-right py-1">Unit Price</th>
                            <th className="text-right py-1">Tax</th>
                            <th className="text-right py-1">Total</th>
                          </tr></thead>
                          <tbody>
                            {order.items.map((item, idx) => (
                              <tr key={idx} className="border-t border-gray-200">
                                <td className="py-1 text-gray-800">{item.itemName}</td>
                                <td className="py-1 text-right text-gray-600">{item.quantity}</td>
                                <td className="py-1 text-right text-gray-600">{fmt(item.unitPrice)}</td>
                                <td className="py-1 text-right text-gray-600">{fmt(item.taxAmount)}</td>
                                <td className="py-1 text-right font-medium text-gray-800">{fmt(item.totalAmount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {order.createdBy && <div className="mt-2 text-xs text-gray-400">Created by: {order.createdBy}</div>}
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No orders found for this period.</td></tr>
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
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800">POS Management</h1>
            {(user.properties?.length ?? 0) > 1 && (
              <select value={selectedPropertyId}
                onChange={e => { setSelectedPropertyId(e.target.value); setLocations([]); }}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {user.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex gap-0">
            {tabs.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>{tab}</button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {loading ? <div className="text-center py-12 text-gray-500">Loading...</div> : (
          <>
            {activeTab === 'Outlets' && (
              <OutletsTab propertyId={selectedPropertyId} locations={locations} onRefresh={loadLocations} />
            )}
            {activeTab === 'Categories & Items' && (
              locations.length > 0 ? <CategoriesItemsTab locations={locations} />
                : <div className="text-center py-12 text-gray-400">Create an outlet first.</div>
            )}
            {activeTab === 'Walk-in Folios' && (
              <WalkInFoliosTab locations={locations} onRefresh={loadLocations} />
            )}
            {activeTab === 'Order History' && (
              locations.length > 0 ? <OrderHistoryTab locations={locations} />
                : <div className="text-center py-12 text-gray-400">No outlets available.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
