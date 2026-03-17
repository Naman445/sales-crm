import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Package, X, AlertCircle, Info } from 'lucide-react';
import { Product } from '../types';
import { getProducts, saveProduct, updateProduct, deleteProduct } from '../utils/supabaseDb';
import { generateId } from '../utils/storage';
import toast from 'react-hot-toast';

const CATEGORIES = [
  'Digital Marketing',
  'Web',
  'Software',
  'Support',
  'Consulting',
  'Hardware',
  'SaaS',
  'Training',
  'Other',
];

type FormState = { name: string; price: string; category: string };
const emptyForm: FormState = { name: '', price: '', category: '' };

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const refresh = async () => { const data = await getProducts(); setProducts(data); };
  useEffect(() => { refresh(); }, []);

  const openAdd = () => {
    setEditProduct(null);
    setForm({ ...emptyForm });
    setErrors({});
    setShowForm(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setForm({ name: p.name, price: String(p.price), category: p.category });
    setErrors({});
    setShowForm(true);
  };

  const validate = () => {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) errs.name = 'Product name is required';
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) < 0)
      errs.price = 'Enter a valid price (0 or more)';
    if (!form.category) errs.category = 'Category is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const product: Product = {
      id: editProduct ? editProduct.id : generateId(),
      name: form.name.trim(),
      price: Number(form.price),
      category: form.category,
    };
    if (editProduct) {
      const { error } = await updateProduct(product);
      if (error) { toast.error(`Update failed: ${error}`); return; }
      toast.success('Product updated!');
    } else {
      const { error } = await saveProduct(product);
      if (error) { toast.error(`Save failed: ${error}`); return; }
      toast.success('Product added to inventory!');
    }
    setShowForm(false);
    refresh();
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteProduct(id);
    if (error) { toast.error(`Delete failed: ${error}`); return; }
    toast.success('Product removed.');
    setDeleteConfirm(null);
    refresh();
  };

  const inputCls = (field: keyof FormState) =>
    `w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition ${
      errors[field] ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white hover:border-indigo-300'
    }`;

  // Group products by category
  const byCategory: Record<string, Product[]> = {};
  products.forEach((p) => {
    if (!byCategory[p.category]) byCategory[p.category] = [];
    byCategory[p.category].push(p);
  });

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Package size={24} className="text-indigo-600" /> Product Inventory
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {products.length} product{products.length !== 1 ? 's' : ''} &nbsp;·&nbsp; Catalogue value:{' '}
            <span className="font-semibold text-indigo-700">
              ₹{products.reduce((s, p) => s + p.price, 0).toLocaleString('en-IN')}
            </span>
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow transition"
        >
          <Plus size={16} /> Add Product
        </button>
      </div>

      {/* ── Info Banner ── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3 text-sm text-blue-800">
        <Info size={18} className="mt-0.5 flex-shrink-0 text-blue-500" />
        <div>
          <p className="font-semibold">How quantity works in this CRM</p>
          <p className="text-blue-700 mt-0.5">
            Inventory stores only <strong>product name</strong> and <strong>unit price</strong>.
            When you mark a meeting as <strong>Deal Closed</strong>, you enter the quantity
            purchased there — e.g. 2 units of a ₹50,000 product = <strong>₹1,00,000 deal amount</strong> auto-calculated.
          </p>
        </div>
      </div>

      {/* ── Add / Edit Form ── */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-xl border border-indigo-100 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
            <h3 className="text-white font-bold text-base">
              {editProduct ? '✏️ Edit Product' : '➕ Add New Product'}
            </h3>
            <button onClick={() => setShowForm(false)} className="text-white/70 hover:text-white transition">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Product Name */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Product / Service Name <span className="text-red-500">*</span>
              </label>
              <input
                value={form.name}
                onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); setErrors((p) => ({ ...p, name: '' })); }}
                placeholder="e.g. Annual Maintenance Contract"
                className={inputCls('name')}
              />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.name}
                </p>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={form.category}
                onChange={(e) => { setForm((p) => ({ ...p, category: e.target.value })); setErrors((p) => ({ ...p, category: '' })); }}
                className={inputCls('category')}
              >
                <option value="">— Select Category —</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {errors.category && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.category}
                </p>
              )}
            </div>

            {/* Unit Price */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Unit Price (₹) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold">₹</span>
                <input
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={(e) => { setForm((p) => ({ ...p, price: e.target.value })); setErrors((p) => ({ ...p, price: '' })); }}
                  placeholder="e.g. 50000"
                  className={`${inputCls('price')} pl-7`}
                />
              </div>
              {form.price && Number(form.price) > 0 && (
                <p className="text-indigo-600 text-xs mt-1 font-medium">
                  = ₹{Number(form.price).toLocaleString('en-IN')} per unit
                  &nbsp;·&nbsp; 2 units = ₹{(Number(form.price) * 2).toLocaleString('en-IN')}
                </p>
              )}
              {errors.price && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.price}
                </p>
              )}
            </div>

            {/* Buttons */}
            <div className="md:col-span-2 flex gap-3 pt-2 border-t border-gray-100">
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-semibold text-sm transition"
              >
                {editProduct ? 'Update Product' : 'Save Product'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Empty State ── */}
      {products.length === 0 && !showForm && (
        <div className="bg-white rounded-2xl shadow-md border border-dashed border-indigo-200 py-16 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center">
            <Package size={32} className="text-indigo-400" />
          </div>
          <div>
            <p className="text-gray-700 font-semibold text-lg">Your inventory is empty</p>
            <p className="text-gray-400 text-sm mt-1">Add your products or services to use them in Deal Closed entries</p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow transition"
          >
            <Plus size={16} /> Add Your First Product
          </button>
        </div>
      )}

      {/* ── Product List by Category ── */}
      {Object.entries(byCategory).map(([category, catProducts]) => (
        <div key={category} className="bg-white rounded-2xl shadow-md overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-100 px-5 py-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{category}</h3>
            <span className="text-xs text-gray-400">{catProducts.length} item{catProducts.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {catProducts.map((p) => (
              <div key={p.id} className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50 transition">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{p.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{p.category}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-base font-bold text-indigo-700">₹{p.price.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-gray-400">per unit</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => openEdit(p)}
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                    title="Edit"
                  >
                    <Pencil size={15} />
                  </button>
                  {deleteConfirm === p.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-xs bg-red-500 text-white px-2 py-1 rounded-lg hover:bg-red-600 transition"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-200 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(p.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
