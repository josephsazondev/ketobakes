# Keto Bakes — Setup & Deployment Guide

## What You're Building
- **Backend**: Google Apps Script (reads/writes your existing Google Sheet)
- **Frontend**: React PWA hosted on GitHub Pages
- **Cost**: Free forever

---

## Step 1 — Prepare Your Google Sheet

1. Open your Keto Bakes spreadsheet
2. Copy the Sheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/**THIS_PART**/edit`
3. Rename (or confirm) your sheets are called **Income** and **Expense**
   - If different names, update `INCOME_SHEET` / `EXPENSE_SHEET` in `Code.gs`

---

## Step 2 — Deploy the Apps Script Backend

1. Open your Google Sheet → **Extensions → Apps Script**
2. Delete any existing code in `Code.gs`
3. Paste the contents of `apps-script/Code.gs`
4. Replace `YOUR_SPREADSHEET_ID_HERE` with your actual Sheet ID (line 7)
5. **Run `setupSheets` once** to ensure headers are correct:
   - Click the function dropdown → select `setupSheets` → click ▶ Run
   - Authorize when prompted
6. **Deploy as Web App**:
   - Click **Deploy → New Deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy** → Copy the Web App URL
7. Save that URL — you'll need it in Step 4

---

## Step 3 — Set Up the React App

```bash
# Clone or download this project, then:
cd ketobakes

# Install dependencies
npm install

# Copy the env template
cp .env.example .env.local
```

Edit `.env.local` and paste your Apps Script Web App URL:
```
REACT_APP_API_URL=https://script.google.com/macros/s/YOUR_ID/exec
```

Test locally:
```bash
npm start
# Opens at http://localhost:3000
```

---

## Step 4 — Deploy to GitHub Pages

1. Create a GitHub repo (e.g. `ketobakes`)
2. Add your GitHub username to `package.json`:
   ```json
   "homepage": "https://YOUR_USERNAME.github.io/ketobakes"
   ```
3. Push your code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/ketobakes.git
   git push -u origin main
   ```
4. Deploy:
   ```bash
   npm run deploy
   ```
5. In GitHub → Settings → Pages → set source to `gh-pages` branch

Your app will be live at: `https://YOUR_USERNAME.github.io/ketobakes`

---

## Step 5 — Install as PWA on Your Phone

**Android (Chrome)**:
1. Open the GitHub Pages URL in Chrome
2. Tap the **⋮ menu → Add to Home screen**
3. Done — it now opens like a native app

**iPhone (Safari)**:
1. Open the URL in Safari
2. Tap **Share → Add to Home Screen**
3. Done

---

## Data Flow

```
Phone App  →  POST /exec  →  Apps Script  →  Google Sheet (Income/Expense tabs)
Phone App  ←  GET  /exec  ←  Apps Script  ←  Google Sheet (aggregated summary)
```

---

## Updating Products / Stores

The app auto-fetches product names from your Income sheet history.
To add new stores for expenses, edit `STORES` in `src/pages/LogEntry.jsx`.

---

## Troubleshooting

| Issue | Fix |
|---|---|
| "Error fetching data" | Check your `REACT_APP_API_URL` is correct in `.env.local` |
| CORS errors | Re-deploy Apps Script (any code change needs a new deployment) |
| Blank data | Run `setupSheets` in Apps Script to fix column headers |
| PWA not installing | Must be served over HTTPS (GitHub Pages handles this) |

---

## File Structure

```
ketobakes/
├── apps-script/
│   └── Code.gs              ← Paste into Google Apps Script
├── public/
│   ├── index.html
│   └── manifest.json        ← PWA config
├── src/
│   ├── hooks/
│   │   └── useApi.js        ← All API calls
│   ├── pages/
│   │   ├── Dashboard.jsx    ← Home screen
│   │   ├── LogEntry.jsx     ← Add income/expense
│   │   └── History.jsx      ← Transaction list
│   ├── App.jsx              ← Navigation shell
│   ├── App.css              ← Component styles
│   ├── index.js             ← Entry point
│   └── index.css            ← Global styles + theme tokens
├── .env.example             ← Copy to .env.local
└── package.json
```
