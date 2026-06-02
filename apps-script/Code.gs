// ============================================================
// KETO BAKES — Google Apps Script Backend
// Deploy as: Web App > Execute as Me > Anyone can access
// ============================================================

const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE'; // Replace with your Sheet ID
const INCOME_SHEET   = 'Income';
const EXPENSE_SHEET  = 'Expense';

// ── Column layouts ──────────────────────────────────────────
// Income:  Date | Type | Particulars | Name | Qty | Price | Amount | Payer | Description
// Expense: Date | Type | Particulars | Name | Qty | Price | Amount | Payee | Description

function doGet(e) {
  try {
    const action = e.parameter.action || 'summary';
    const month  = e.parameter.month;   // "2026-05"
    const year   = e.parameter.year;    // "2026"

    let result;
    switch (action) {
      case 'income':  result = getRows(INCOME_SHEET,  month); break;
      case 'expense': result = getRows(EXPENSE_SHEET, month); break;
      case 'history': result = getHistory(month);             break;
      case 'summary': result = getSummary(month, year);       break;
      default:        result = { error: 'Unknown action' };
    }

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const { type, ...data } = body; // type: 'income' | 'expense'

    if (!type || !data) return jsonResponse({ error: 'Missing type or data' });

    const sheet     = type === 'income' ? INCOME_SHEET : EXPENSE_SHEET;
    const timestamp = new Date();
    const row       = buildRow(type, data, timestamp);
    const ss        = SpreadsheetApp.openById(SPREADSHEET_ID);
    const ws        = ss.getSheetByName(sheet);

    if (!ws) return jsonResponse({ error: `Sheet "${sheet}" not found` });

    ws.appendRow(row);
    return jsonResponse({ success: true, timestamp: timestamp.toISOString() });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// ── Helpers ─────────────────────────────────────────────────

function buildRow(type, data, timestamp) {
  const date   = data.date   || Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'MM/dd/yyyy');
  const qty    = Number(data.quantity || 1);
  const price  = Number(data.price    || 0);
  const amount = qty * price;

  if (type === 'income') {
    return [
      date,
      data.type        || 'Sales',
      data.particulars || data.name,
      data.name        || '',
      qty,
      price,
      amount,
      data.payer       || 'Ketolab',
      data.description || ''
    ];
  } else {
    return [
      date,
      data.type        || 'Expense',
      data.particulars || 'Ingredients',
      data.name        || '',
      qty,
      price,
      amount,
      data.payee       || '',
      data.description || ''
    ];
  }
}

function getRows(sheetName, month) {
  const ws   = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  if (!ws) return { rows: [] };

  const data = ws.getDataRange().getValues();
  if (data.length <= 1) return { rows: [] };

  const headers = data[0];
  let rows = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });

  if (month) {
    rows = rows.filter(row => {
      const d = parseDate(row['Date']);
      if (!d) return false;
      const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      return ym === month;
    });
  }

  return { rows: rows.map(r => ({ ...r, Date: formatDate(r['Date']) })) };
}

function getHistory(month) {
  const income  = getRows(INCOME_SHEET,  month).rows.map(r => ({ ...r, _type: 'income'  }));
  const expense = getRows(EXPENSE_SHEET, month).rows.map(r => ({ ...r, _type: 'expense' }));
  const all     = [...income, ...expense].sort((a, b) => {
    return new Date(b.Date) - new Date(a.Date);
  });
  return { rows: all };
}

function getSummary(month, year) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const iWs = ss.getSheetByName(INCOME_SHEET);
  const eWs = ss.getSheetByName(EXPENSE_SHEET);

  const iData = iWs ? iWs.getDataRange().getValues().slice(1) : [];
  const eData = eWs ? eWs.getDataRange().getValues().slice(1) : [];

  function filterAndSum(rows, amtCol) {
    return rows.filter(r => {
      const d = parseDate(r[0]);
      if (!d) return false;
      if (month) {
        const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        return ym === month;
      }
      if (year) return String(d.getFullYear()) === String(year);
      return true;
    }).reduce((sum, r) => sum + (Number(r[amtCol]) || 0), 0);
  }

  // Income sheet: Date=0, Name=3, Qty=4, Price=5, Amount=6
  const totalIncome  = filterAndSum(iData, 6);
  const totalExpense = filterAndSum(eData, 6);

  // Product breakdown (income only)
  const productMap = {};
  iData.forEach(r => {
    const d = parseDate(r[0]);
    if (!d) return;
    if (month) {
      const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (ym !== month) return;
    }
    const name = r[3] || r[2] || 'Unknown';
    const amt  = Number(r[6]) || 0;
    const qty  = Number(r[4]) || 0;
    if (!productMap[name]) productMap[name] = { amount: 0, quantity: 0 };
    productMap[name].amount   += amt;
    productMap[name].quantity += qty;
  });

  const products = Object.entries(productMap)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.amount - a.amount);

  // Monthly trend (last 6 months)
  const trend = getMonthlyTrend(iData, eData, 6);

  return {
    month,
    totalIncome,
    totalExpense,
    netProfit: totalIncome - totalExpense,
    products,
    trend
  };
}

function getMonthlyTrend(iData, eData, count) {
  const now     = new Date();
  const months  = [];
  for (let i = count - 1; i >= 0; i--) {
    const d  = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = d.toLocaleString('default', { month: 'short' });
    months.push({ ym, label, income: 0, expense: 0 });
  }

  iData.forEach(r => {
    const d = parseDate(r[0]);
    if (!d) return;
    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const m  = months.find(x => x.ym === ym);
    if (m) m.income += Number(r[6]) || 0;
  });

  eData.forEach(r => {
    const d = parseDate(r[0]);
    if (!d) return;
    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const m  = months.find(x => x.ym === ym);
    if (m) m.expense += Number(r[6]) || 0;
  });

  return months.map(m => ({ ...m, net: m.income - m.expense }));
}

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  const d = new Date(val);
  return isNaN(d) ? null : d;
}

function formatDate(val) {
  const d = parseDate(val);
  if (!d) return String(val);
  return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Sheet Setup Utility (run once manually) ─────────────────
function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  function ensureSheet(name, headers) {
    let ws = ss.getSheetByName(name);
    if (!ws) {
      ws = ss.insertSheet(name);
      ws.appendRow(headers);
      ws.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      ws.setFrozenRows(1);
    }
    return ws;
  }

  ensureSheet(INCOME_SHEET,  ['Date','Type','Particulars','Name','Quantity','Price','Amount','Payer','Description']);
  ensureSheet(EXPENSE_SHEET, ['Date','Type','Particulars','Name','Quantity','Price','Amount','Payee','Description']);

  SpreadsheetApp.flush();
  Logger.log('Sheets ready ✓');
}
