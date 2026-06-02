// src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import { fetchSummary, fetchSummary as fetchPrev, formatPeso, getCurrentMonth, getPrevMonth, formatMonth } from '../hooks/useApi';

export default function Dashboard({ onNavigate }) {
  const [month]       = useState(getCurrentMonth);
  const [summary, setSummary]   = useState(null);
  const [prevNet, setPrevNet]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [cur, prev] = await Promise.all([
          fetchSummary(month),
          fetchSummary(getPrevMonth(month))
        ]);
        if (!cancelled) {
          setSummary(cur);
          setPrevNet(prev.netProfit || 0);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [month]);

  const diff    = summary ? summary.netProfit - prevNet : 0;
  const diffStr = diff >= 0 ? `↑ ${formatPeso(diff)} from last month` : `↓ ${formatPeso(Math.abs(diff))} from last month`;

  return (
    <>
      {/* Hero band */}
      <div className="hero-band">
        <div className="hero-greeting">Net Profit</div>
        {loading ? (
          <div style={{ height: 46, display: 'flex', alignItems: 'center' }}>
            <div className="spinner" style={{ borderTopColor: 'var(--caramel)' }} />
          </div>
        ) : (
          <>
            <div className="hero-profit font-serif">
              {summary ? formatPeso(summary.netProfit) : '₱0'}
            </div>
            {prevNet !== null && (
              <div className="hero-change" style={{ color: diff >= 0 ? 'var(--sage-light)' : '#E07070' }}>
                {diffStr}
              </div>
            )}
          </>
        )}
      </div>

      {/* KPI cards */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-type">Income</div>
          <div className="stat-value income font-serif">
            {loading ? '—' : formatPeso(summary?.totalIncome ?? 0)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-type">Expenses</div>
          <div className="stat-value expense font-serif">
            {loading ? '—' : formatPeso(summary?.totalExpense ?? 0)}
          </div>
        </div>
      </div>

      {error && <div className="error-state">{error}</div>}

      {/* Top products */}
      <div className="section-header">
        <span className="section-title">Top Products</span>
        <button className="section-link" onClick={() => onNavigate('history')}>See All →</button>
      </div>

      <div className="product-list">
        {loading ? (
          <div className="loading-state" style={{ padding: '20px' }}>
            <div className="spinner" />
          </div>
        ) : summary?.products?.length ? (
          summary.products.slice(0, 6).map((p, i) => (
            <div className="product-row" key={p.name}>
              <div className="product-dot" style={{
                background: DOT_COLORS[i % DOT_COLORS.length]
              }} />
              <div className="product-name">{p.name}</div>
              <div className="product-qty">{p.quantity} pcs</div>
              <div className="product-amount font-serif">{formatPeso(p.amount)}</div>
            </div>
          ))
        ) : (
          <div style={{ padding: '20px 16px', color: 'var(--text-light)', fontSize: 13 }}>
            No sales recorded for {formatMonth(month)} yet.
          </div>
        )}
      </div>

      {/* Trend bars */}
      {summary?.trend?.length > 0 && (
        <>
          <div className="section-header" style={{ paddingTop: 12 }}>
            <span className="section-title">Monthly Trend</span>
          </div>
          <div className="trend-bars">
            {summary.trend.map(m => {
              const max = Math.max(...summary.trend.map(x => x.income), 1);
              return (
                <div className="trend-col" key={m.ym}>
                  <div className="trend-bar-wrap">
                    <div className="trend-bar income-bar"
                      style={{ height: `${Math.round((m.income / max) * 52)}px` }} />
                    <div className="trend-bar expense-bar"
                      style={{ height: `${Math.round((m.expense / max) * 52)}px` }} />
                  </div>
                  <div className="trend-label">{m.label}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Spacer for FAB */}
      <div style={{ height: 80 }} />
    </>
  );
}

const DOT_COLORS = [
  'var(--caramel)',
  'var(--sage)',
  'var(--brown-light)',
  'var(--brown-mid)',
  '#B5856A',
  '#7A8E6A',
];
