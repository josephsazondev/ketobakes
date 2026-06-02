// ============================================================
// Keto Bakes — Google Apps Script Backend
// Deploy: Web App > Execute as Me > Anyone can access
// After editing: Deploy > Manage deployments > edit > New version
// ============================================================

// This script is container-bound (created via Extensions → Apps Script inside
// the spreadsheet), so it operates on its own parent sheet — no ID needed.
// If you ever run it standalone, set a 'SHEET_ID' Script Property instead.
function getSpreadsheet() {
  var bound = SpreadsheetApp.getActiveSpreadsheet();
  if (bound) return bound;
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('No bound spreadsheet and no SHEET_ID Script Property set');
  return SpreadsheetApp.openById(id);
}

// Sheet names
var SHEETS = { income: 'Income', expense: 'Expense', config: 'Config' };

// Column layout (order = sheet column order). Keep these in sync with the sheet.
var HEADERS = {
  income:  ['Date','Type','Particulars','Name','Qty','Price','Amount','Payer/Payee','Paid','Description'],
  expense: ['Date','Type','Particulars','Name','Qty','Price','Amount','Paid','Description'],
  config:  ['Key','Value','Description'],
};

// Maps a frontend field → column index, per sheet.
var FIELDS = {
  income:  { date:0, particulars:2, name:3, qty:4, price:5, amount:6, payer:7, paid:8, description:9 },
  expense: { date:0, particulars:2, name:3, qty:4, price:5, amount:6, paid:7, description:8 },
};

// ── Response helper ───────────────────────────────────────────
// NOTE: Apps Script ContentService cannot set CORS headers — there is no
// working setHeader on TextOutput. Cross-origin GET works only because Google
// automatically adds 'Access-Control-Allow-Origin: *' when the web app is
// deployed with "Who has access: Anyone". POST stays mode:'no-cors' on the
// client, so it never needs to read the response.
function out(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Entry points ──────────────────────────────────────────────
function doGet(e) {
  try {
    if (!authorized(e.parameter)) return out({ error: 'Unauthorized' });
    var type = e.parameter.type || 'history';
    if (type === 'ping')    return out({ ok: true, ts: Date.now() });
    if (type === 'history') return out({ transactions: getTransactions() });
    return out({ error: 'Unknown type: ' + type });
  } catch (err) {
    return out({ error: String(err && err.message || err) });
  }
}

function doPost(e) {
  try {
    if (!authorized(e.parameter || {})) return out({ error: 'Unauthorized' });
    var d = JSON.parse(e.postData.contents);
    if (d.type === 'income' || d.type === 'expense') appendEntry(d.type, d);
    else if (d.type === 'delete') deleteEntry(d.rowId);
    else return out({ error: 'Unknown type: ' + d.type });
    return out({ ok: true });
  } catch (err) {
    return out({ error: String(err && err.message || err) });
  }
}

// ── Sheet access ──────────────────────────────────────────────
function getSheet(key) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS[key]);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS[key]);
    sheet.appendRow(HEADERS[key]);
    sheet.getRange(1, 1, 1, HEADERS[key].length)
      .setBackground('#3D2314').setFontColor('#F5EFE0').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Returns [{ row: [...], rowNum }] for all non-empty data rows.
function getRows(key) {
  var sheet = getSheet(key);
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn())
    .getValues()
    .map(function (row, i) { return { row: row, rowNum: i + 2 }; })
    .filter(function (e) { return e.row[0] !== '' && e.row[0] != null; });
}

// ── Read ──────────────────────────────────────────────────────
function getTransactions() {
  var all = readEntries('income', 'I').concat(readEntries('expense', 'E'));
  all.sort(function (a, b) { return parseDate(b.date) - parseDate(a.date); });
  return all;
}

function readEntries(key, prefix) {
  var map = FIELDS[key];
  return getRows(key).map(function (e) {
    var o = { type: key, rowId: prefix + '_' + e.rowNum };
    Object.keys(map).forEach(function (f) { o[f] = e.row[map[f]]; });
    o.date = fmtDate(o.date);
    o.paid = !(o.paid === false || o.paid === 'FALSE' || String(o.paid).trim() === '');
    return o;
  });
}

// ── Write ─────────────────────────────────────────────────────
function appendEntry(key, d) {
  var map = FIELDS[key];
  var headers = HEADERS[key];
  var row = [];
  for (var i = 0; i < headers.length; i++) row.push('');

  row[1] = key === 'income' ? 'Income' : 'Expense'; // Type column

  var values = {
    date: d.date,
    particulars: d.particulars || '',
    name: d.name || '',
    qty: Number(d.qty) || 0,
    price: Number(d.price) || 0,
    amount: Number(d.amount) || 0,
    payer: d.payer || '',
    paid: d.paid !== false,
    description: d.description || '',
  };
  Object.keys(map).forEach(function (f) { row[map[f]] = values[f]; });

  getSheet(key).appendRow(row);
}

function deleteEntry(rowId) {
  if (!rowId) return;
  var parts = String(rowId).split('_');
  var key = parts[0] === 'I' ? 'income' : 'expense';
  var rowNum = parseInt(parts[1], 10);
  var sheet = getSheet(key);
  if (rowNum >= 2 && rowNum <= sheet.getLastRow()) sheet.deleteRow(rowNum);
}

// ── Config / auth ─────────────────────────────────────────────
function getConfig() {
  try {
    var cache = CacheService.getScriptCache();
    var hit = cache.get('kb_config');
    if (hit) return JSON.parse(hit);

    var sheet = getSheet('config');
    var config = {};
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues().forEach(function (r) {
        if (r[0]) config[String(r[0]).trim()] = String(r[1]).trim();
      });
    }
    cache.put('kb_config', JSON.stringify(config), 300);
    return config;
  } catch (e) {
    return {};
  }
}

function authorized(params) {
  var key = (getConfig().api_key || '').trim();
  return !key || (params.key || '') === key;
}

// Run manually after editing the Config sheet to apply changes immediately.
function clearConfigCache() {
  CacheService.getScriptCache().remove('kb_config');
}

// ── Date helpers ──────────────────────────────────────────────
function parseDate(val) {
  if (val instanceof Date) return val;
  var s = String(val), p;
  if (s.indexOf('-') !== -1) { p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  p = s.split('/'); return new Date(+p[2], +p[0] - 1, +p[1]);
}

function fmtDate(val) {
  var d = (val instanceof Date) ? val : null;
  if (!d) {
    var s = String(val);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;          // already ISO
    var p = s.split('/');
    if (p.length === 3) return p[2] + '-' + z(p[0]) + '-' + z(p[1]);
    return s;
  }
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
}

function z(n) { return ('0' + n).slice(-2); }
