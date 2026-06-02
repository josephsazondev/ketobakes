# Keto Bakes PWA

Income & expense tracker for your weekend baking side hustle.
**Stack:** React + Vite (GitHub Pages) · Google Sheets + Apps Script (backend)

---


## Project Structure

```
ketobakes/
├── index.html          # PWA shell
├── manifest.json       # PWA manifest
├── sw.js               # Service worker (offline support)
├── vite.config.js
├── package.json
├── src/
│   ├── main.jsx        # React entry point
│   └── App.jsx         # Full app (Dashboard, Log, History)
└── Code.gs             # Google Apps Script backend
```

---

## Part 1 — Set Up Google Sheets Backend

### Step 1: Prepare your Google Sheet

1. Open your existing **Keto Bakes** spreadsheet (or create a new one)
2. Copy the Sheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/**THIS_PART**/edit`
3. Make sure you have two sheets named exactly:
   - `Income`
   - `Expense`

   The script will auto-create them with headers if they don't exist.

### Step 2: Create the Apps Script

1. In your Google Sheet, go to **Extensions → Apps Script**
2. Delete the default `myFunction()` code
3. Paste the entire contents of `Code.gs`
4. Replace `YOUR_GOOGLE_SHEET_ID` with your actual Sheet ID (step 1)
5. Save (Ctrl+S)

### Step 3: Deploy as Web App

1. Click **Deploy → New deployment**
2. Click the gear icon ⚙ next to "Type" → select **Web app**
3. Set:
   - **Description:** Keto Bakes API
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy**
5. **Copy the Web App URL** — looks like:
   `https://script.google.com/macros/s/AKfycb.../exec`

> ⚠️ Every time you edit Code.gs, you must click **Deploy → Manage deployments → Edit → New version** to apply changes.

---

## Part 2 — Set Up the React App

### Step 1: Install dependencies

```bash
npm install
```

### Step 2: Connect to your backend

Open `src/App.jsx` and replace line 6:
```js
const API_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
```
With your actual Web App URL from Part 1 Step 3.

### Step 3: Run locally

```bash
npm run dev
```

Open `http://localhost:5173` — it works like the final app.

---

## Part 3 — Deploy to GitHub Pages

### Step 1: Create GitHub repository

1. Go to [github.com](https://github.com) → **New repository**
2. Name it `ketobakes` (or anything you like)
3. Keep it **Public** (required for free GitHub Pages)

### Step 2: Push your code

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ketobakes.git
git push -u origin main
```

### Step 3: Enable GitHub Pages

1. In your repo, go to **Settings → Pages**
2. Under **Build and deployment**, select **GitHub Actions**
3. Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

4. Push and wait ~2 minutes
5. Your app is live at: `https://YOUR_USERNAME.github.io/ketobakes`

### Step 4: Add to your phone home screen

**Android (Chrome):**
1. Open the URL in Chrome
2. Tap the 3-dot menu → **Add to Home screen**

**iPhone (Safari):**
1. Open the URL in Safari
2. Tap Share → **Add to Home Screen**

The app will work offline for browsing history and will sync when connected.

---

## Usage

| Screen | What it does |
|--------|-------------|
| **Dashboard** | Net profit, income, expenses, top products for current month |
| **Log (+ button)** | Record a sale or ingredient purchase in <15 seconds |
| **History** | Scrollable ledger with month grouping, filter by Income/Expense, search |

---

## Customizing Products & Stores

Edit the arrays at the top of `src/App.jsx`:

```js
const PRODUCTS = ['Almond Pandesal', 'Tiramisu', ...];  // your baked goods
const STORES   = ['SM', 'S&R', 'Gmg', ...];             // your suppliers
const PAYERS   = ['Ketolab', 'Cash', 'GCash', ...];     // your customers
```

Save, commit, push — auto-deploys in ~2 minutes.

---

## Sheet Column Reference

**Income sheet columns:**
`Date | Type | Particulars | Name | Qty | Price | Amount | Payer/Payee | Description`

**Expense sheet columns:**
`Date | Type | Particulars | Name | Qty | Price | Amount | Description`

These match your existing AppSheet data structure, so you can copy-paste old data in directly.
