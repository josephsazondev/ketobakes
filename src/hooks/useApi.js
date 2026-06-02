// src/hooks/useApi.js
// All communication with the Apps Script Web App backend

const API_URL = process.env.REACT_APP_API_URL || '';

async function request(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function fetchSummary(month) {
  // month format: "2026-05"
  const url = `${API_URL}?action=summary&month=${month}`;
  return request(url);
}

export async function fetchHistory(month) {
  const url = `${API_URL}?action=history${month ? `&month=${month}` : ''}`;
  return request(url);
}

export async function saveEntry(type, data) {
  return request(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, ...data }),
  });
}

// Product list derived from income history (unique names)
export async function fetchProducts() {
  const { rows } = await fetchHistory();
  const income = rows.filter(r => r._type === 'income');
  const names = [...new Set(income.map(r => r['Name'] || r['Particulars']).filter(Boolean))];
  return names.sort();
}

export function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonth(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString('default', { month: 'long', year: 'numeric' });
}

export function formatPeso(num) {
  if (num == null || isNaN(num)) return '₱0';
  return '₱' + Number(num).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

export function getPrevMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
