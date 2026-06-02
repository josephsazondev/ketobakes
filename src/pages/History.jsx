// src/pages/History.jsx
import { useState, useEffect } from 'react';
import { fetchHistory, formatPeso, getCurrentMonth, formatMonth } from '../hooks/useApi';

export default function History() {
  const [filter, setFilter]   = useState('all');   // all | income | expense
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const { rows: data } = await fetchHistory();
        if (!cancelled) setRows(data || []);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = rows.filter(r => {
    if (filter === 'income'  && r._type !== 'income')  return false;
    if (filter === 'expense' && r._type !== 'expense') return false;
    if (search) {
      const q = search.toLowerCase();
      const name = (r['Name'] || r['Particulars'] || '').toLowerCase();
      return name.includes(q);
    }
    return true;
  });

  // Group by month
  const grouped = {};
  filtered.forEach(r => {
    const d = parseDate(r['Date']);
    if (!d) return;
    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (!grouped[ym]) grouped[ym] = [];
    grouped[ym].push(r);
  });

  const months = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  function getMonthNet(rows) {
    return rows.reduce((sum, r) => {
      const amt = Number(r['Amount']) || 0;
      return r._type === 'income' ? sum + amt : sum - amt;
    }, 0);
  }

  return (
    <>
      <div className="app-header">
        <div className="app-logo">Keto<span>Bakes</span></div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="var(--brown-light)" strokeWidth="2" style={{ cursor: 'pointer' }}
          onClick={() => {}}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>

      <div className="screen-content">
        {/* Search */}
        <div style={{ padding: '12px 16px 0' }}>
          <input className="form-input" type="text" placeholder="Search products…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ fontSize: 14 }} />
        </div>

        {/* Filter chips */}
        <div className="chips-row">
          {['all','income','expense'].map(f => (
            <button key={f} className={`chip${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {error && <div className="error-state">{error}</div>}

        {loading ? (
          <div className="loading-state"><div className="spinner" /><span>Loading history…</span></div>
        ) : months.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-light)', fontSize: 14 }}>
            No entries found.
          </div>
        ) : (
          months.map(ym => {
            const monthRows = grouped[ym];
            const net = getMonthNet(monthRows);
            return (
              <div key={ym} style={{ padding: '0 16px' }}>
                <div className="month-header-row">
                  <span className="month-name font-serif">{formatMonth(ym)}</span>
                  <span className="month-net" style={{ color: net >= 0 ? 'var(--sage)' : '#C0392B' }}>
                    {net >= 0 ? '+' : ''}{formatPeso(net)}
                  </span>
                </div>

                {monthRows.map((r, i) => {
                  const isIncome = r._type === 'income';
                  const name = r['Name'] || r['Particulars'] || 'Unknown';
                  const amt  = Number(r['Amount']) || 0;
                  const qty  = r['Quantity'];
                  const payer = r['Payer'] || r['Payee'] || '';
                  const d = parseDate(r['Date']);
                  const dateStr = d ? `${d.getDate()} ${d.toLocaleString('default',{month:'short'})}` : r['Date'];

                  return (
                    <div key={i} className={`txn-item${isIncome ? '' : ' expense'}`}>
                      <div className="txn-date-col">
                        <div className="txn-day">{d ? d.getDate() : '—'}</div>
                        <div className="txn-mon">{d ? d.toLocaleString('default',{month:'short'}) : ''}</div>
                      </div>
                      <div className="txn-info">
                        <div className="txn-name">{name}</div>
                        <div className="txn-sub">
                          {qty ? `${qty} pcs` : ''}{qty && payer ? ' · ' : ''}{payer}
                        </div>
                      </div>
                      <div className={`txn-amount font-serif${isIncome ? ' income' : ' expense'}`}>
                        {isIncome ? '' : '−'}{formatPeso(amt)}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}

        <div style={{ height: 80 }} />
      </div>
    </>
  );
}

function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d) ? null : d;
}
