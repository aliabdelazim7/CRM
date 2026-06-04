# El-Baz Enterprise ERP | Sales, CRM, Inventory & Business Analytics

A production-ready Enterprise Resource Planning (ERP) and Point of Sale (POS) system designed for small and medium businesses. Built to run serverless, using a static HTML5/Tailwind/Vanilla JS client and a Google Sheets spreadsheet acting as the primary database.

---

## Features
- **Modern Dashboard & Analytics**: Track today's sales, monthly volume, net profit margins, outstanding debts, and inspect active Chart.js sales curves.
- **Smart Point of Sale (POS)**: Build carts, search items, scan barcodes with auto-add matching, allocate payments, calculate change, and print beautiful invoices.
- **Real-Time Inventory Tracker**: Deducts stock levels at checkout and triggers low/out-of-stock notification badges.
- **CRM Ledger**: Register client profiles, view detailed customer statement drawers, list purchase history, and record FIFO debt payment distributions.
- **Operating Expenses Tracker**: Ledger to log rent, salaries, utilities, and logistics to compute accurate Net profit statistics.
- **Multi-Report Center**: Print-ready P&L statements (Revenue vs. COGS vs. Expenses), stock valuation, debtors accounts, and operational expense logs. Includes Excel-compatible CSV exports.

---

## Codebase Architecture
```
/
├── index.html                   # Core HTML single page layout and modals
├── README.md                    # Setup and deployment documentation
├── google-apps-script/
│   └── code.js                  # Apps Script database logic (to paste in Google Sheets)
└── src/
    ├── css/
    │   └── styles.css           # Custom scrollbars, glass effects, animations
    └── js/
        ├── api.js               # Database API requester (featuring full offline Mock mode)
        ├── app.js               # Router, notifications, loading states, and event broker
        ├── dashboard.js         # KPI card aggregations and Chart.js graphics
        ├── products.js          # Catalog products table, forms, pagination, CSV exports
        ├── customers.js         # CRM database grids, profile drawer statement, payment receipts
        ├── invoices.js          # Interactive cart POS, scanner hooks, printable invoice layouts
        ├── expenses.js          # Expense records table and category progress summaries
        └── reports.js           # Multi-report selector (P&L, Stock Value) and export engines
```

---

## Database Setup (Google Sheets Integration)

Follow these steps to connect your system to a live Google Sheet:

### 1. Create your Google Sheet
1. Open Google Drive and click **New > Google Sheets** to create a blank spreadsheet.
2. Title it something like `El-Baz ERP Database`.

### 2. Add Google Apps Script
1. In the top menu of your Google Sheet, select **Extensions > Apps Script**.
2. Erase any code inside the script editor.
3. Open [google-apps-script/code.js](file:///c:/Users/Administrator/Desktop/الباز%20للادوات%20الكهربيه%202/google-apps-script/code.js) from the project directory, copy all its content, and paste it into the editor.
4. Click the **Save** icon (floppy disk) on the toolbar.

### 3. Deploy as a Web App (Critical Steps)
1. Click the blue **Deploy** button on the top-right and choose **New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Fill in the fields:
   - **Description**: `El-Baz ERP Database API`
   - **Execute as**: `Me (your-email@gmail.com)`
   - **Who has access**: **`Anyone`** *(This is important. It permits your client-side dashboard to fetch/post data securely to the script).*
4. Click **Deploy**.
5. Google will prompt you to **Authorize Access**. Click it, choose your account, click *Advanced* (bottom link), and click *Go to Untitled Project (unsafe)* to authorize.
6. Once deployed, copy the **Web App URL** from the screen (it ends in `/exec`).

### 4. Connect to Web Application Settings
1. Open `index.html` in your browser.
2. In the sidebar, navigate to the **System Settings** tab.
3. Under the **Google Sheets Integration** section, paste your copied Web App URL into the **Apps Script Web App API URL** input field.
4. Fill out your Business Details (Business Name, Address, Phone, and Currency Code: e.g. `EGP`).
5. Click **Save Config & Connect**.
6. The app will immediately trigger a database sync, automatically create the necessary sheets (`Products`, `Customers`, `Invoices`, `InvoiceItems`, `Expenses`, `Settings`) in your Google Sheet, and begin saving data to it!

---

## Local Execution and Hosting

### Run Locally (Offline Mock Mode out-of-the-box)
By default, if the API URL is left blank in Settings, the app operates in **Mock Mode** using browser `localStorage` as the database. It is preloaded with realistic electrical items (LED bulbs, copper cables, circuit breakers, dummy contractors, expense records) so you can explore the dashboard and POS features immediately!

Simply double-click the `index.html` file in your file explorer, and it will run instantly inside any modern web browser.

### Hosting in Production
Since this is a static client application containing only HTML, CSS, and Javascript, you can host it for free on any static host:
- **GitHub Pages**: Upload the folder, go to Repository Settings -> Pages, and enable it.
- **Vercel / Netlify**: Drop the folder in their dashboard to deploy.
- **Local Network**: Keep the files on a shared directory or run a local lightweight server like:
  ```powershell
  npx http-server ./
  ```
  This allows anyone connected to the local office Wi-Fi to access the POS terminal simultaneously!
