import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const C = {
  cream: '#F5EFE0', warmWhite: '#FBF7F0', brownDeep: '#3D2314', brownMid: '#7B4A2D',
  brownLight: '#C4956A', caramel: '#D4874E', sage: '#8A9E7A', sageLight: '#C8D8BF',
  textDark: '#2C1A0E', textMid: '#6B4226', textLight: '#9E7A5E', shadow: 'rgba(61,35,20,0.12)',
  danger: '#C0392B',
};
// Soft modern display serif (Fraunces). SOFT axis applied globally in index.html.
const SERIF = "'Fraunces', Georgia, serif";

// ─── PERSISTENCE ─────────────────────────────────────────────────────────────
const DEFAULTS = {
  products: ['Almond Pandesal', 'Almond Loaf', 'Burnt Cheesecake', 'Chocolate Chip Cake', 'Cookies', 'Cream Cheese Muffins', 'Lemon Blueberry Cake', 'Sausage Cheese Scones', 'Tiramisu', 'Brazo de Mercedes'],
  expenseTypes: ['Ingredients', 'Packaging', 'Utilities', 'Transport'],
  stores: ['SM', 'S&R', 'Gmg', 'Shopee'],
  payers: ['Ketolab', 'Cash', 'GCash'],
};
const readLS = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const getSettings = () => readLS('kb_settings', {});
const getDropdowns = () => {
  const saved = readLS('kb_dropdowns', {});
  return Object.fromEntries(Object.entries(DEFAULTS).map(([k, def]) => [k, saved[k]?.length ? saved[k] : def]));
};

// ─── API ─────────────────────────────────────────────────────────────────────
const api = {
  async get(type) {
    const { apiUrl, apiKey } = getSettings();
    if (!apiUrl) throw new Error('No API URL — open Settings ⚙');
    const url = new URL(apiUrl);
    url.searchParams.set('type', type);
    url.searchParams.set('_t', Date.now());
    if (apiKey) url.searchParams.set('key', apiKey);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Network error (${res.status})`);
    const json = await res.json();
    if (json?.error) throw new Error(json.error);
    return json;
  },
  async post(payload) {
    const { apiUrl, apiKey } = getSettings();
    if (!apiUrl) throw new Error('No API URL — open Settings ⚙');
    await fetch(apiKey ? `${apiUrl}?key=${encodeURIComponent(apiKey)}` : apiUrl, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { ok: true };
  },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const z = (n) => ('0' + n).slice(-2);
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const parseDate = (s) => {
  s = String(s);
  const [a, b, c] = s.includes('-') ? s.split('-') : s.split('/').reverse(); // ISO or M/D/Y→Y,D,M
  return s.includes('-') ? new Date(+a, +b - 1, +c) : new Date(+a, +c - 1, +b);
};
const monthKey = (d) => `${d.getFullYear()}-${z(d.getMonth() + 1)}`;
const thisMonth = () => monthKey(new Date());
const labelOf = (key) => { const [y, m] = key.split('-'); return `${MONTHS[+m - 1]} ${y}`; };
const DOTS = [C.caramel, C.sage, C.brownLight, C.brownMid, '#B5856A', '#A8C4A0'];

// Compute everything the dashboard needs from the flat transaction list.
function computeStats(txns, mKey) {
  const inMonth = (t, key) => { try { return monthKey(parseDate(t.date)) === key; } catch { return false; } };
  const [y, m] = mKey.split('-').map(Number);
  const prevKey = m === 1 ? `${y - 1}-12` : `${y}-${z(m - 1)}`;
  const sum = (arr, type) => arr.filter(t => t.type === type).reduce((s, t) => s + Number(t.amount || 0), 0);

  const cur = txns.filter(t => inMonth(t, mKey));
  const prev = txns.filter(t => inMonth(t, prevKey));

  const products = {};
  cur.filter(t => t.type === 'income').forEach(t => {
    const k = t.name || 'Unknown';
    (products[k] ||= { name: k, qty: 0, amount: 0 });
    products[k].qty += Number(t.qty || 0);
    products[k].amount += Number(t.amount || 0);
  });

  return {
    income: sum(cur, 'income'), expenses: sum(cur, 'expense'),
    prevIncome: sum(prev, 'income'), prevExpenses: sum(prev, 'expense'),
    topProducts: Object.values(products).sort((a, b) => b.amount - a.amount).slice(0, 6),
    unpaid: txns.filter(t => t.type === 'income' && t.paid === false),
  };
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const S = {
  app: { display: 'flex', flexDirection: 'column', height: '100%', background: C.warmWhite, overflow: 'hidden' },
  header: { background: C.brownDeep, padding: '16px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  logo: { fontFamily: SERIF, color: C.cream, fontSize: 21, fontWeight: 700, letterSpacing: '-0.01em' },
  screen: { flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' },
  nav: { background: C.warmWhite, borderTop: `1px solid rgba(196,149,106,0.2)`, padding: '8px 0 12px', display: 'flex', justifyContent: 'space-around', flexShrink: 0 },
  navItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer', flex: 1 },
  navLabel: (a) => ({ fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase', color: a ? C.caramel : C.textLight, fontWeight: a ? 700 : 400, marginTop: 2 }),
  subHeader: { background: C.brownDeep, padding: '12px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  subTitle: { fontFamily: SERIF, color: C.cream, fontSize: 16, fontWeight: 600 },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' },
  hero: { background: `linear-gradient(160deg, ${C.brownDeep}, ${C.brownMid})`, padding: '22px 20px 38px' },
  heroLabel: { color: C.brownLight, fontSize: 10.5, fontWeight: 400, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 },
  heroValue: { fontFamily: SERIF, color: C.cream, fontSize: 42, fontWeight: 700, lineHeight: 1, marginBottom: 7, letterSpacing: '-0.01em' },
  heroDelta: (up) => ({ fontSize: 12, color: up ? C.sageLight : '#E8A87C', fontWeight: 400, letterSpacing: '0.01em' }),
  statsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 16px', marginTop: -20, position: 'relative', zIndex: 2 },
  card: { background: C.warmWhite, borderRadius: 16, padding: '14px 16px', boxShadow: `0 6px 18px ${C.shadow}`, border: `1px solid rgba(196,149,106,0.15)` },
  cardLabel: { fontSize: 10, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5, fontWeight: 700 },
  cardValue: (income) => ({ fontFamily: SERIF, fontSize: 21, fontWeight: 600, color: income ? C.sage : C.caramel }),
  section: { fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: C.brownDeep, padding: '18px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  sectionTag: { fontFamily: "'Nunito Sans', sans-serif", fontSize: 10.5, color: C.caramel, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' },
  row: { display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid rgba(196,149,106,0.15)` },
  dot: (c) => ({ width: 8, height: 8, borderRadius: '50%', background: c, marginRight: 10, flexShrink: 0 }),
  fab: { position: 'absolute', bottom: 20, right: 18, width: 50, height: 50, borderRadius: '50%', background: C.caramel, boxShadow: `0 4px 16px rgba(212,135,78,0.4)`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, cursor: 'pointer', border: 'none', fontSize: 26, color: '#fff' },
  toggleWrap: { display: 'flex', background: `rgba(196,149,106,0.15)`, borderRadius: 12, padding: 4, gap: 4 },
  toggle: (a, col) => ({ flex: 1, textAlign: 'center', padding: 9, borderRadius: 9, fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', cursor: 'pointer', border: 'none', background: a ? (col || C.caramel) : 'transparent', color: a ? '#fff' : C.textLight, transition: 'all .2s' }),
  group: { marginBottom: 14 },
  label: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.textLight, fontWeight: 700, marginBottom: 6, display: 'block' },
  input: { width: '100%', padding: '12px 14px', border: `1.5px solid rgba(196,149,106,0.3)`, borderRadius: 12, background: C.warmWhite, fontSize: 14, color: C.textDark, outline: 'none', appearance: 'none', WebkitAppearance: 'none', fontFamily: 'inherit' },
  computed: { width: '100%', padding: '12px 14px', border: `1.5px solid rgba(138,158,122,0.4)`, borderRadius: 12, background: `rgba(138,158,122,0.08)`, fontSize: 18, fontFamily: SERIF, color: C.sage, fontWeight: 600 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  primaryBtn: { width: '100%', padding: 14, background: C.brownDeep, color: C.cream, border: 'none', borderRadius: 14, fontFamily: SERIF, fontSize: 16, fontWeight: 600, cursor: 'pointer', marginTop: 8 },
  chip: (a) => ({ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap', cursor: 'pointer', background: a ? C.warmWhite : `rgba(196,149,106,0.15)`, color: a ? C.caramel : C.textLight, border: `1.5px solid ${a ? C.caramel : 'transparent'}`, flexShrink: 0 }),
  txn: (exp) => ({ display: 'flex', alignItems: 'center', padding: '11px 14px', background: C.warmWhite, borderRadius: 12, boxShadow: `0 2px 8px ${C.shadow}`, borderLeft: `3px solid ${exp ? C.caramel : C.sage}` }),
  txnDate: { fontSize: 11, color: C.textLight, width: 42, flexShrink: 0, textAlign: 'center', lineHeight: 1.3 },
  txnInfo: { flex: 1, padding: '0 10px' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: 10 },
  muted: { fontSize: 14, color: C.textLight, textAlign: 'center' },
  error: { fontSize: 13, color: C.caramel, textAlign: 'center' },
  spinner: { width: 32, height: 32, border: `3px solid rgba(196,149,106,0.2)`, borderTop: `3px solid ${C.caramel}`, borderRadius: '50%', animation: 'spin .8s linear infinite' },
  formArea: { padding: '16px 16px 0' },
};

// ─── ICONS ───────────────────────────────────────────────────────────────────
const svg = (paths) => ({ color }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths}</svg>
);
const IconDash = svg(<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>);
const IconPlus = svg(<><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></>);
const IconList = svg(<><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>);
const IconCog = svg(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>);
const IconSearch = ({ color }) => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>);
const IconDownload = ({ color }) => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>);
const IconEye = ({ off }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {off
      ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>
      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>}
  </svg>
);
const Logo = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" style={{ flexShrink: 0 }}>
    <rect width="64" height="64" rx="14" fill="rgba(255,255,255,0.12)" />
    <path d="M11 46 Q10 28 32 24 Q54 28 53 46 Z" fill={C.caramel} />
    <rect x="10" y="44" width="44" height="10" rx="5" fill={C.brownLight} />
    <path d="M20 38 Q32 31 44 38" stroke="rgba(61,35,20,0.45)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    {[25, 32, 39].map((x, i) => <path key={i} d={`M${x} 22 C${x - 2} 17 ${x + 2} 12 ${x} 7`} stroke={C.cream} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.55" />)}
  </svg>
);

// ─── SHARED UI ───────────────────────────────────────────────────────────────
const Spinner = () => (
  <div style={S.center}>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    <div style={S.spinner} /><div style={S.muted}>Loading…</div>
  </div>
);

function MonthPicker({ value, onChange, dark = true }) {
  const [y, m] = value.split('-').map(Number);
  const atLatest = value >= thisMonth();
  const shift = (delta) => {
    const d = new Date(y, m - 1 + delta, 1);
    onChange(monthKey(d));
  };
  const col = dark ? C.brownLight : C.brownMid;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button onClick={() => shift(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: col, fontSize: 18, padding: '2px 6px' }}>‹</button>
      <span className="num" style={{ color: col, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', minWidth: 74, textAlign: 'center' }}>{MONTHS[m - 1]} {y}</span>
      <button onClick={() => shift(1)} disabled={atLatest} style={{ background: 'none', border: 'none', cursor: atLatest ? 'default' : 'pointer', color: atLatest ? 'rgba(196,149,106,0.3)' : col, fontSize: 18, padding: '2px 6px' }}>›</button>
    </div>
  );
}

function SmartSelect({ value, onChange, options, listKey }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const commit = () => {
    const v = text.trim();
    if (!v) return;
    const dd = getDropdowns();
    localStorage.setItem('kb_dropdowns', JSON.stringify({ ...dd, [listKey]: [...dd[listKey], v] }));
    onChange(v); setAdding(false); setText('');
  };
  if (adding) return (
    <div style={{ display: 'flex', gap: 6 }}>
      <input style={{ ...S.input, flex: 1 }} autoFocus value={text} placeholder="New option…"
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setAdding(false); }} />
      <button style={{ padding: '0 14px', background: C.sage, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }} onClick={commit}>Add</button>
      <button style={{ padding: '0 10px', background: 'none', color: C.textLight, border: `1.5px solid rgba(196,149,106,0.3)`, borderRadius: 12, cursor: 'pointer' }} onClick={() => setAdding(false)}>✕</button>
    </div>
  );
  return (
    <select style={S.input} value={value} onChange={e => e.target.value === '__add' ? setAdding(true) : onChange(e.target.value)}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
      <option value="__add">+ Add new…</option>
    </select>
  );
}

function MonthlyChart({ txns }) {
  if (!txns.length) return null;
  const now = new Date();
  const cells = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return { key: monthKey(d), label: MONTHS[d.getMonth()], income: 0, expense: 0 };
  });
  const byKey = Object.fromEntries(cells.map(c => [c.key, c]));
  txns.forEach(t => { try { const c = byKey[monthKey(parseDate(t.date))]; if (c) c[t.type] += Number(t.amount || 0); } catch {} });
  const max = Math.max(...cells.flatMap(c => [c.income, c.expense]), 1);
  const H = 72, bw = 16, gap = 5, gGap = 10, gW = bw * 2 + gap + gGap, PAD = 16;
  return (
    <div style={{ padding: '4px 16px 16px' }}>
      <div style={{ ...S.section, padding: '12px 0 10px' }}>
        <span>6-Month Overview</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <span style={{ fontSize: 10, color: C.sage, fontWeight: 700 }}>▮ Income</span>
          <span style={{ fontSize: 10, color: C.caramel, fontWeight: 700 }}>▮ Expense</span>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${gW * 6 - gGap + PAD * 2} ${H + 22}`} preserveAspectRatio="xMidYMid meet">
        {cells.map((c, i) => {
          const x = PAD + i * gW;
          const ih = Math.max(3, c.income / max * H), eh = Math.max(3, c.expense / max * H);
          return (
            <g key={c.key}>
              <rect x={x} y={H - ih} width={bw} height={ih} rx="3" fill={C.sage} opacity="0.85" />
              <rect x={x + bw + gap} y={H - eh} width={bw} height={eh} rx="3" fill={C.caramel} opacity="0.85" />
              <text x={x + bw + gap / 2} y={H + 15} textAnchor="middle" fontSize="9" fill={C.textLight}>{c.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function UnpaidPanel({ unpaid }) {
  if (!unpaid.length) return null;
  const total = unpaid.reduce((s, t) => s + Number(t.amount || 0), 0);
  return (
    <div style={{ margin: '12px 16px 4px', background: 'rgba(212,135,78,0.08)', borderRadius: 14, padding: '12px 14px', border: '1px solid rgba(212,135,78,0.3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.caramel, fontWeight: 700 }}>Outstanding ({unpaid.length})</span>
        <span style={{ fontFamily: SERIF, fontSize: 14, color: C.caramel, fontWeight: 600 }} className="num">{peso(total)}</span>
      </div>
      {unpaid.slice(0, 3).map((t, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: '1px solid rgba(212,135,78,0.15)' }}>
          <span style={{ fontSize: 12, color: C.textMid }}>{t.name}{t.payer ? ` · ${t.payer}` : ''}</span>
          <span style={{ fontSize: 12, color: C.caramel, fontFamily: SERIF, fontWeight: 600 }} className="num">{peso(t.amount)}</span>
        </div>
      ))}
      {unpaid.length > 3 && <div style={{ fontSize: 11, color: C.textLight, paddingTop: 5 }}>+{unpaid.length - 3} more unpaid</div>}
    </div>
  );
}

function SwipeRow({ children, onDelete }) {
  const [open, setOpen] = useState(false);
  const x0 = useRef(null);
  return (
    <div style={{ position: 'relative', borderRadius: 12, marginBottom: 7, overflow: 'hidden' }}>
      {/* Delete sits behind, revealed on swipe */}
      <button style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 76, background: C.danger, border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', borderRadius: '0 12px 12px 0' }}
        onClick={() => { onDelete(); setOpen(false); }}>Delete</button>
      {/* Sliding panel on top */}
      <div style={{ position: 'relative', zIndex: 1, background: C.warmWhite, transform: `translateX(${open ? -76 : 0}px)`, transition: 'transform .22s ease' }}
        onClick={() => open && setOpen(false)}
        onTouchStart={e => x0.current = e.touches[0].clientX}
        onTouchEnd={e => { const dx = e.changedTouches[0].clientX - x0.current; if (dx < -52) setOpen(true); else if (dx > 20) setOpen(false); }}>
        {children}
      </div>
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function Dashboard({ txns, loading, error, month, onAdd }) {
  const st = useMemo(() => computeStats(txns, month), [txns, month]);
  if (loading) return <Spinner />;
  if (error) return <div style={S.center}><div style={S.error}>{error}</div><div style={{ ...S.muted, fontSize: 12 }}>Configure the API in Settings ⚙</div></div>;

  const profit = st.income - st.expenses;
  const delta = profit - (st.prevIncome - st.prevExpenses);
  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <div style={S.screen}>
        <div style={S.hero}>
          <div style={S.heroLabel}>Net Profit · {labelOf(month)}</div>
          <div style={S.heroValue} className="num">{peso(profit)}</div>
          <div style={S.heroDelta(delta >= 0)}>{delta >= 0 ? '▲' : '▼'} <span className="num">{peso(Math.abs(delta))}</span> vs prev month</div>
        </div>
        <div style={S.statsRow}>
          <div style={S.card}><div style={S.cardLabel}>Income</div><div style={S.cardValue(true)} className="num">{peso(st.income)}</div></div>
          <div style={S.card}><div style={S.cardLabel}>Expenses</div><div style={S.cardValue(false)} className="num">{peso(st.expenses)}</div></div>
        </div>
        <UnpaidPanel unpaid={st.unpaid} />
        <MonthlyChart txns={txns} />
        <div style={S.section}>Top Products<span style={S.sectionTag}>{labelOf(month)}</span></div>
        <div style={{ padding: '0 16px 16px' }}>
          {st.topProducts.length === 0
            ? <div style={{ ...S.muted, padding: '12px 0 20px' }}>🧁 No sales logged this month yet</div>
            : st.topProducts.map((p, i) => (
              <div key={p.name} style={{ ...S.row, borderBottom: i < st.topProducts.length - 1 ? S.row.borderBottom : 'none' }}>
                <div style={S.dot(DOTS[i % DOTS.length])} />
                <div style={{ fontSize: 13.5, color: C.textDark, flex: 1 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: C.textLight, marginRight: 12 }} className="num">{p.qty} pcs</div>
                <div style={{ fontFamily: SERIF, fontSize: 14, color: C.brownMid, fontWeight: 600 }} className="num">{peso(p.amount)}</div>
              </div>
            ))}
        </div>
      </div>
      <button style={S.fab} onClick={onAdd} aria-label="Add entry">+</button>
    </div>
  );
}

// ─── LOG ENTRY ───────────────────────────────────────────────────────────────
const LOG_CONFIG = {
  income: { catLabel: 'Product', catList: 'products', subLabel: 'Payer / Payee', subList: 'payers' },
  expense: { catLabel: 'Particulars', catList: 'expenseTypes', subLabel: 'Store / Supplier', subList: 'stores' },
};

function LogEntry({ onBack, onSaved }) {
  const dd = getDropdowns();
  const [type, setType] = useState('income');
  const [form, setForm] = useState({ date: todayISO(), cat: dd.products[0], sub: dd.payers[0], qty: '1', price: '', paid: true, description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const cfg = LOG_CONFIG[type];
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const amount = (parseFloat(form.qty) || 0) * (parseFloat(form.price) || 0);

  const switchType = (t) => {
    const d = getDropdowns(), c = LOG_CONFIG[t];
    setType(t);
    setForm(f => ({ ...f, cat: d[c.catList][0], sub: d[c.subList][0] }));
  };

  const save = async () => {
    if (!form.price || isNaN(parseFloat(form.price))) return setError('Enter a valid price.');
    setSaving(true); setError('');
    const base = { type, date: form.date, qty: parseFloat(form.qty) || 1, price: parseFloat(form.price) || 0, amount, paid: form.paid, description: form.description };
    const payload = type === 'income'
      ? { ...base, name: form.cat, payer: form.sub }
      : { ...base, particulars: form.cat, name: form.sub };
    try {
      await api.post(payload);
      setDone(true);
      setTimeout(onSaved, 1100);
    } catch (e) { setError(e.message || 'Failed to save.'); setSaving(false); }
  };

  if (done) return (
    <div style={{ ...S.center, height: '100%' }}><div style={{ fontSize: 48 }}>✓</div><div style={{ fontFamily: SERIF, fontSize: 20, color: C.sage }}>Saved!</div></div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ ...S.subHeader, gap: 14, justifyContent: 'flex-start' }}>
        <button style={{ background: 'none', border: 'none', color: C.brownLight, fontSize: 20, cursor: 'pointer' }} onClick={onBack}>←</button>
        <div style={{ fontFamily: SERIF, color: C.cream, fontSize: 18, fontWeight: 600 }}>New Entry</div>
      </div>
      <div style={S.screen}>
        <div style={{ ...S.toggleWrap, margin: '16px 16px 0' }}>
          <button style={S.toggle(type === 'income')} onClick={() => switchType('income')}>Income</button>
          <button style={S.toggle(type === 'expense')} onClick={() => switchType('expense')}>Expense</button>
        </div>
        <div style={S.formArea}>
          <div style={S.group}>
            <label style={S.label}>Date</label>
            <input style={{ ...S.input, colorScheme: 'light' }} type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
          <div style={S.group}>
            <label style={S.label}>{cfg.catLabel}</label>
            <SmartSelect value={form.cat} options={dd[cfg.catList]} listKey={cfg.catList} onChange={v => set('cat', v)} />
          </div>
          <div style={S.twoCol}>
            <div style={S.group}><label style={S.label}>Quantity</label><input style={S.input} type="number" min="1" value={form.qty} onChange={e => set('qty', e.target.value)} /></div>
            <div style={S.group}><label style={S.label}>Price (₱)</label><input style={S.input} type="number" min="0" step="0.01" value={form.price} placeholder="0.00" onChange={e => set('price', e.target.value)} /></div>
          </div>
          <div style={S.group}><label style={S.label}>Amount</label><input style={S.computed} className="num" readOnly value={amount > 0 ? peso(amount) : '—'} /></div>
          <div style={S.group}>
            <label style={S.label}>{cfg.subLabel}</label>
            <SmartSelect value={form.sub} options={dd[cfg.subList]} listKey={cfg.subList} onChange={v => set('sub', v)} />
          </div>
          <div style={S.group}>
            <label style={S.label}>Payment Status</label>
            <div style={S.toggleWrap}>
              <button style={S.toggle(form.paid, C.sage)} onClick={() => set('paid', true)}>Paid</button>
              <button style={S.toggle(!form.paid, C.caramel)} onClick={() => set('paid', false)}>Unpaid</button>
            </div>
          </div>
          <div style={S.group}><label style={S.label}>Notes (optional)</label><input style={S.input} value={form.description} placeholder="Add a note…" onChange={e => set('description', e.target.value)} /></div>
          {error && <div style={{ ...S.error, marginBottom: 10 }}>{error}</div>}
          <button style={{ ...S.primaryBtn, opacity: saving ? 0.6 : 1 }} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Entry'}</button>
          <div style={{ height: 32 }} />
        </div>
      </div>
    </div>
  );
}

// ─── HISTORY ─────────────────────────────────────────────────────────────────
function History({ txns, loading, error, month, onMonth, onDelete }) {
  const [typeF, setTypeF] = useState('all');
  const [paidF, setPaidF] = useState('all');
  const [q, setQ] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  if (loading) return <Spinner />;
  if (error) return <div style={S.center}><div style={S.error}>{error}</div></div>;

  const filtered = txns.filter(t => {
    if (typeF !== 'all' && t.type !== typeF) return false;
    if (paidF === 'paid' && !t.paid) return false;
    if (paidF === 'unpaid' && t.paid) return false;
    if (month !== 'all') { try { if (monthKey(parseDate(t.date)) !== month) return false; } catch {} }
    if (q) { const s = q.toLowerCase(); return (t.name || '').toLowerCase().includes(s) || (t.particulars || '').toLowerCase().includes(s); }
    return true;
  });

  const groups = {};
  filtered.forEach(t => {
    try {
      const k = monthKey(parseDate(t.date));
      (groups[k] ||= { items: [], net: 0 });
      groups[k].items.push(t);
      groups[k].net += (t.type === 'income' ? 1 : -1) * Number(t.amount || 0);
    } catch {}
  });
  const sorted = Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));

  const exportCSV = () => {
    const head = ['Date', 'Type', 'Name/Particulars', 'Qty', 'Price', 'Amount', 'Payer', 'Paid', 'Notes'];
    const rows = filtered.map(t => [t.date, t.type, t.type === 'income' ? t.name : t.particulars, t.qty, t.price, t.amount, t.payer || t.name || '', t.paid ? 'Yes' : 'No', t.description || '']);
    const csv = [head, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `ketobakes_${todayISO()}.csv` });
    a.click();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={S.subHeader}>
        <div style={S.subTitle}>History</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button style={S.iconBtn} onClick={exportCSV} title="Export CSV"><IconDownload color={C.brownLight} /></button>
          <button style={S.iconBtn} onClick={() => setShowSearch(s => !s)}><IconSearch color={showSearch ? C.caramel : C.brownLight} /></button>
        </div>
      </div>
      {showSearch && (
        <div style={{ padding: '10px 16px', background: C.brownDeep }}>
          <input style={{ ...S.input, background: 'rgba(255,255,255,0.1)', color: C.cream, border: '1px solid rgba(196,149,106,0.3)' }} autoFocus placeholder="Search transactions…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      )}
      <div style={{ background: C.warmWhite, padding: '10px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(196,149,106,0.15)' }}>
        <button style={S.chip(month === 'all')} onClick={() => onMonth('all')}>All Months</button>
        {month === 'all'
          ? <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.caramel, fontWeight: 700 }} onClick={() => onMonth(thisMonth())}>Pick month ›</button>
          : <MonthPicker value={month} onChange={onMonth} dark={false} />}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px', overflowX: 'auto', background: C.warmWhite }}>
        {['all', 'income', 'expense'].map(f => <button key={f} style={S.chip(typeF === f)} onClick={() => setTypeF(f)}>{f === 'all' ? 'All' : f}</button>)}
        <div style={{ width: 1, background: 'rgba(196,149,106,0.3)', margin: '2px 4px', flexShrink: 0 }} />
        {['all', 'paid', 'unpaid'].map(f => <button key={f} style={S.chip(paidF === f)} onClick={() => setPaidF(f)}>{f === 'all' ? 'Any status' : f}</button>)}
      </div>
      <div style={S.screen}>
        {sorted.length === 0 && <div style={S.center}><div style={{ fontSize: 30, opacity: 0.5 }}>🔍</div><div style={S.muted}>No transactions match these filters</div></div>}
        {sorted.map(([key, g]) => (
          <div key={key} style={{ padding: '0 16px 8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 8px' }}>
              <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: C.brownDeep }}>{labelOf(key)}</div>
              <div style={{ fontFamily: SERIF, fontSize: 14, fontWeight: 600, color: g.net >= 0 ? C.sage : C.caramel }} className="num">{g.net >= 0 ? '+' : ''}{peso(g.net)}</div>
            </div>
            {g.items.map((t) => {
              const exp = t.type === 'expense';
              const d = parseDate(t.date);
              const card = (
                <div style={S.txn(exp)}>
                  <div style={S.txnDate} className="num"><span style={{ fontWeight: 700, fontSize: 15, color: C.textDark, display: 'block' }}>{d.getDate()}</span>{MONTHS[d.getMonth()]}</div>
                  <div style={S.txnInfo}>
                    <div style={{ fontSize: 13.5, color: C.textDark, fontWeight: 700, marginBottom: 2 }}>{exp ? t.particulars : t.name}</div>
                    <div style={{ fontSize: 11, color: C.textLight }}>{exp ? t.name : `${t.qty} pcs · ${t.payer || ''}`}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                    <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: exp ? C.caramel : C.sage }} className="num">{exp ? '−' : ''}{peso(t.amount)}</div>
                    {!t.paid && <span style={{ fontSize: 9, background: 'rgba(212,135,78,0.2)', color: C.caramel, borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>UNPAID</span>}
                  </div>
                </div>
              );
              return onDelete ? <SwipeRow key={t.rowId} onDelete={() => onDelete(t)}>{card}</SwipeRow> : <div key={t.rowId} style={{ marginBottom: 7 }}>{card}</div>;
            })}
          </div>
        ))}
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────
function Settings({ onClearCache }) {
  const [form, setForm] = useState(getSettings);
  const [status, setStatus] = useState('');
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = () => { localStorage.setItem('kb_settings', JSON.stringify(form)); setSaved(true); setTimeout(() => setSaved(false), 1500); };
  const test = async () => {
    if (!form.apiUrl) return setStatus('Enter an API URL first.');
    setTesting(true); setStatus('');
    try {
      const url = new URL(form.apiUrl);
      url.searchParams.set('type', 'ping'); url.searchParams.set('_t', Date.now());
      if (form.apiKey) url.searchParams.set('key', form.apiKey);
      const j = await (await fetch(url)).json();
      setStatus(j.ok ? '✓ Connection successful!' : `⚠ ${JSON.stringify(j)}`);
    } catch (e) { setStatus(`✗ ${e.message}`); } finally { setTesting(false); }
  };
  const divider = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.textLight, fontWeight: 700, paddingBottom: 8, borderBottom: '1px solid rgba(196,149,106,0.2)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={S.subHeader}><div style={S.subTitle}>Settings</div></div>
      <div style={S.screen}>
        <div style={{ padding: '16px 16px 40px' }}>
          <div style={divider}>API Configuration</div>
          <div style={{ ...S.group, marginTop: 14 }}><label style={S.label}>Apps Script Web App URL</label><input style={S.input} type="url" value={form.apiUrl || ''} placeholder="https://script.google.com/macros/s/…/exec" onChange={e => set('apiUrl', e.target.value)} /></div>
          <div style={S.group}>
            <label style={S.label}>API Key (optional — must match Config sheet)</label>
            <div style={{ position: 'relative' }}>
              <input
                style={{ ...S.input, paddingRight: 52, letterSpacing: showKey ? 'normal' : '0.15em' }}
                type={showKey ? 'text' : 'password'}
                value={form.apiKey || ''}
                placeholder="Leave blank if not set"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                onChange={e => set('apiKey', e.target.value)}
              />
              {(form.apiKey || '') !== '' && (
                <button
                  type="button"
                  onClick={() => setShowKey(s => !s)}
                  aria-label={showKey ? 'Hide API key' : 'Show API key'}
                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', color: C.textLight }}
                >
                  <IconEye off={showKey} />
                </button>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button style={{ ...S.primaryBtn, flex: 1, marginTop: 0, background: saved ? C.sage : C.brownDeep }} onClick={save}>{saved ? '✓ Saved' : 'Save'}</button>
            <button style={{ ...S.primaryBtn, flex: 1, marginTop: 0, background: 'none', color: C.brownMid, border: '1.5px solid rgba(196,149,106,0.4)' }} onClick={test} disabled={testing}>{testing ? 'Testing…' : 'Test Connection'}</button>
          </div>
          {status && <div style={{ fontSize: 13, color: status[0] === '✓' ? C.sage : C.caramel, marginBottom: 14, padding: '10px 12px', background: status[0] === '✓' ? 'rgba(138,158,122,0.1)' : 'rgba(212,135,78,0.1)', borderRadius: 10 }}>{status}</div>}

          <div style={{ ...divider, marginTop: 8 }}>Setup Guide</div>
          <ol style={{ fontSize: 13, color: C.textMid, lineHeight: 1.8, margin: '14px 0', paddingLeft: 18 }}>
            <li>Create a Google Sheet, open Extensions → Apps Script.</li>
            <li>Paste Code.gs (it auto-uses this sheet — no ID needed).</li>
            <li>Deploy as Web App (Execute as Me, Anyone can access).</li>
            <li>Paste the URL above → Save → Test Connection.</li>
            <li>Optional: set api_key in the Config sheet tab, then enter it above.</li>
          </ol>

          <div style={{ ...divider, marginTop: 8 }}>Data</div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button style={{ ...S.primaryBtn, marginTop: 0, background: 'none', color: C.textMid, border: '1.5px solid rgba(196,149,106,0.3)' }} onClick={() => { if (confirm('Reset dropdown lists to defaults?')) { localStorage.removeItem('kb_dropdowns'); alert('Done.'); } }}>Reset Dropdown Lists</button>
            <button style={{ ...S.primaryBtn, marginTop: 0, background: 'none', color: C.caramel, border: '1.5px solid rgba(192,57,43,0.3)' }} onClick={onClearCache}>Clear Cache &amp; Reload</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ────────────────────────────────────────────────────────────────────
const NAV = [
  ['dashboard', IconDash, 'Dashboard'],
  ['log', IconPlus, 'Log'],
  ['history', IconList, 'History'],
  ['settings', IconCog, 'Settings'],
];

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [showLog, setShowLog] = useState(false);
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(thisMonth());

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setTxns((await api.get('history')).transactions || []); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const del = async (t) => {
    if (!confirm(`Delete this ${t.type} entry (${peso(t.amount)})?`)) return;
    try { await api.post({ type: 'delete', rowId: t.rowId }); load(); }
    catch (e) { alert('Delete failed: ' + e.message); }
  };
  const clearCache = () => { if (confirm('Clear all settings and reload?')) { localStorage.clear(); location.reload(); } };

  if (showLog) return <div style={S.app}><LogEntry onBack={() => setShowLog(false)} onSaved={() => { setShowLog(false); load(); }} /></div>;

  const dashMonth = month === 'all' ? thisMonth() : month;
  return (
    <div style={S.app}>
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Logo /><div style={S.logo}>Keto<span style={{ color: C.caramel }}>Bakes</span></div>
        </div>
        <MonthPicker value={dashMonth} onChange={setMonth} />
      </div>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {tab === 'dashboard' && <Dashboard txns={txns} loading={loading} error={error} month={dashMonth} onAdd={() => setShowLog(true)} />}
        {tab === 'history' && <History txns={txns} loading={loading} error={error} month={month} onMonth={setMonth} onDelete={del} />}
        {tab === 'settings' && <Settings onClearCache={clearCache} />}
      </div>
      <div style={S.nav}>
        {NAV.map(([id, Icon, label]) => {
          const active = tab === id && id !== 'log';
          return (
            <div key={id} style={S.navItem} onClick={() => id === 'log' ? setShowLog(true) : setTab(id)}>
              <Icon color={active ? C.caramel : C.textLight} />
              <span style={S.navLabel(active)}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
