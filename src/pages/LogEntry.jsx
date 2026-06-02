// src/pages/LogEntry.jsx
import { useState, useEffect } from 'react';
import { saveEntry, fetchProducts, formatPeso } from '../hooks/useApi';

const PRODUCT_DEFAULTS = [
  'Almond Pandesal',
  'Almond Loaf',
  'Burnt Cheesecake',
  'Chocolate Chip Cake',
  'Cookies',
  'Cream Cheese Muffins',
  'Lemon Blueberry Cake',
  'Tiramisu',
];

const EXPENSE_TYPES = ['Ingredients', 'Packaging', 'Utilities', 'Transport', 'Other'];
const STORES        = ['SM', 'S&R', 'Gmg', 'Puregold', 'Other'];
const PAYERS        = ['Ketolab'];

function today() {
  const d = new Date();
  return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
}

export default function LogEntry({ onBack, onSaved }) {
  const [type, setType]         = useState('income');
  const [products, setProducts] = useState(PRODUCT_DEFAULTS);
  const [saving, setSaving]     = useState(false);
  const [errors, setErrors]     = useState({});

  // Income fields
  const [date, setDate]           = useState(today);
  const [product, setProduct]     = useState('');
  const [quantity, setQuantity]   = useState('1');
  const [price, setPrice]         = useState('');
  const [payer, setPayer]         = useState('Ketolab');
  const [notes, setNotes]         = useState('');

  // Expense fields
  const [expType, setExpType]     = useState('Ingredients');
  const [store, setStore]         = useState('');
  const [expPrice, setExpPrice]   = useState('');
  const [expNotes, setExpNotes]   = useState('');

  const amount = type === 'income'
    ? (parseFloat(quantity) || 0) * (parseFloat(price) || 0)
    : parseFloat(expPrice) || 0;

  useEffect(() => {
    fetchProducts()
      .then(p => { if (p.length) setProducts(p); })
      .catch(() => {}); // silently fall back to defaults
  }, []);

  function validate() {
    const e = {};
    if (type === 'income') {
      if (!product)  e.product  = 'Required';
      if (!price || isNaN(parseFloat(price))) e.price = 'Enter a valid price';
      if (!quantity || isNaN(parseFloat(quantity))) e.quantity = 'Enter quantity';
    } else {
      if (!expPrice || isNaN(parseFloat(expPrice))) e.expPrice = 'Enter amount';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = type === 'income'
        ? { date, name: product, particulars: product, quantity: parseFloat(quantity), price: parseFloat(price), payer, description: notes }
        : { date, particulars: expType, name: store, quantity: 1, price: parseFloat(expPrice), payee: store, description: expNotes };

      await saveEntry(type, payload);
      onSaved(`${type === 'income' ? 'Sale' : 'Expense'} saved ✓`);
      onBack();
    } catch (e) {
      onSaved(`Error: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="back-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <span className="back-title">New Entry</span>
      </div>

      <div className="screen-content slide-up">
        <div style={{ padding: '16px 16px 0' }}>
          <div className="type-toggle">
            <button className={`toggle-btn${type === 'income' ? ' active' : ''}`}
              onClick={() => setType('income')}>Income</button>
            <button className={`toggle-btn${type === 'expense' ? ' active' : ''}`}
              onClick={() => setType('expense')}>Expense</button>
          </div>
        </div>

        <div style={{ padding: '14px 16px' }}>

          {/* Date — shared */}
          <div className="form-group">
            <label className="form-label">Date</label>
            <input className="form-input" type="text" value={date}
              onChange={e => setDate(e.target.value)} placeholder="MM/DD/YYYY" />
          </div>

          {type === 'income' ? (
            <>
              <div className="form-group">
                <label className="form-label">Product {errors.product && <span style={{color:'var(--caramel)'}}>*</span>}</label>
                <select className="form-input" value={product} onChange={e => setProduct(e.target.value)}>
                  <option value="">Select product…</option>
                  {products.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Quantity {errors.quantity && <span style={{color:'var(--caramel)'}}>*</span>}</label>
                  <input className="form-input" type="number" min="1" value={quantity}
                    onChange={e => setQuantity(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Price ₱ {errors.price && <span style={{color:'var(--caramel)'}}>*</span>}</label>
                  <input className="form-input" type="number" min="0" value={price}
                    onChange={e => setPrice(e.target.value)} placeholder="0.00" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Total Amount</label>
                <input className="form-input computed" type="text"
                  value={amount > 0 ? formatPeso(amount) : '₱0'} readOnly />
              </div>

              <div className="form-group">
                <label className="form-label">Payer</label>
                <select className="form-input" value={payer} onChange={e => setPayer(e.target.value)}>
                  {PAYERS.map(p => <option key={p} value={p}>{p}</option>)}
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Notes (optional)</label>
                <input className="form-input" type="text" value={notes}
                  onChange={e => setNotes(e.target.value)} placeholder="Add a note…" />
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-input" value={expType} onChange={e => setExpType(e.target.value)}>
                  {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Store / Supplier</label>
                <select className="form-input" value={store} onChange={e => setStore(e.target.value)}>
                  <option value="">Select store…</option>
                  {STORES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Amount ₱ {errors.expPrice && <span style={{color:'var(--caramel)'}}>*</span>}</label>
                <input className="form-input" type="number" min="0" value={expPrice}
                  onChange={e => setExpPrice(e.target.value)} placeholder="0.00" />
              </div>

              <div className="form-group">
                <label className="form-label">Notes (optional)</label>
                <input className="form-input" type="text" value={expNotes}
                  onChange={e => setExpNotes(e.target.value)} placeholder="What did you buy?" />
              </div>
            </>
          )}

          <button className="btn-primary" onClick={handleSave} disabled={saving}
            style={{ opacity: saving ? 0.7 : 1, marginTop: 8 }}>
            {saving ? 'Saving…' : 'Save Entry'}
          </button>

          <button className="btn-secondary" onClick={onBack}
            style={{ marginTop: 10 }}>Cancel</button>
        </div>

        <div style={{ height: 40 }} />
      </div>
    </>
  );
}
