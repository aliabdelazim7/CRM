/**
 * API Client Layer - Localized to Arabic
 * Handles communication with Google Apps Script Web App or falls back to Mock Mode in localStorage
 */

const API_CONFIG_KEY = "elbaz_system_settings";
const LOCAL_DB_KEY = "elbaz_local_database";

// Default settings object - Localized to user's Google Sheets URL
const defaultSettings = {
  webAppUrl: "https://script.google.com/macros/s/AKfycbydgHWkKR5fp5_mZCe7hGymmHhjP85-PUF1FDVtLPmFa4BJYtekRkwZlBQ0hjjRF2lC_Q/exec",
  businessName: "الباز للادوات الكهربيه",
  address: "",
  phone: "+201018907086",
  currency: "EGP",
  adminEmail: "admin@elbaz.com",
  adminPassword: "admin",
  settingsPassword: "admin_settings"
};

// Initial Arabic electrical store mockup data
const demoDatabase = {
  Products: [
    { "Product ID": "PROD-1001", "Product Name": "لمبة ليد فيليبس 12 وات إضاءة بيضاء E27", "Category": "إنارة وإضاءة", "Supplier": "فيليبس مصر", "Purchase Price": 45, "Selling Price": 65, "Profit Per Unit": 20, "Current Quantity": 120, "Minimum Quantity Alert": 20, "Barcode": "8718696576816", "Description": "لمبة ليد موفرة للطاقة كفاءة عالية سن قلاووظ E27 عمر طويل.", "Creation Date": "2026-05-01T10:00:00.000Z", "Status": "Active" },
    { "Product ID": "PROD-1002", "Product Name": "لفة سلك نحاس السويدي 2 مم (100 متر)", "Category": "أسلاك وكابلات", "Supplier": "السويدي للكابلات", "Purchase Price": 1200, "Selling Price": 1450, "Profit Per Unit": 250, "Current Quantity": 18, "Minimum Quantity Alert": 5, "Barcode": "6221045230912", "Description": "لفة 100 متر سلك نحاس معزول 2 مم معتمد، أخضر/أصفر تأريض.", "Creation Date": "2026-05-02T11:30:00.000Z", "Status": "Active" },
    { "Product ID": "PROD-1003", "Product Name": "مفتاح حائط مفرد أبيض", "Category": "مفاتيح وبرايز", "Supplier": "شنايدر إلكتريك", "Purchase Price": 22, "Selling Price": 35, "Profit Per Unit": 13, "Current Quantity": 250, "Minimum Quantity Alert": 30, "Barcode": "3606480512390", "Description": "لقمة مفتاح شنايدر إلكتريك مفرد أبيض عالي التحمل.", "Creation Date": "2026-05-03T09:15:00.000Z", "Status": "Active" },
    { "Product ID": "PROD-1004", "Product Name": "قاطع أوتوماتيك أحادي القطب 16 أمبير", "Category": "لوحات وقواطع", "Supplier": "ABB مصر", "Purchase Price": 95, "Selling Price": 130, "Profit Per Unit": 35, "Current Quantity": 8, "Minimum Quantity Alert": 10, "Barcode": "7612271207890", "Description": "مفتاح قاطع أوتوماتيكي ABB أحادي القطب لوحات التوزيع MCB.", "Creation Date": "2026-05-04T14:00:00.000Z", "Status": "Active" },
    { "Product ID": "PROD-1005", "Product Name": "شريط لحام عازل كهرباء أسود", "Category": "أدوات ومستلزمات", "Supplier": "3M مصر", "Purchase Price": 8, "Selling Price": 15, "Profit Per Unit": 7, "Current Quantity": 0, "Minimum Quantity Alert": 15, "Barcode": "054007061328", "Description": "شريط لحام بلاستيك عازل للجهد الكهربائي سوبر 33+ أسود.", "Creation Date": "2026-05-05T08:45:00.000Z", "Status": "Active" }
  ],
  Customers: [
    { "Customer ID": "CUST-101", "Name": "المهندس أحمد حسن (مقاولات)", "Phone Number": "01001234567", "Address": "مصر الجديدة، القاهرة", "Total Purchases": 16400, "Outstanding Balance": 3200, "Status": "Active" },
    { "Customer ID": "CUST-102", "Name": "أ. محمد إبراهيم", "Phone Number": "01123456789", "Address": "مدينة نصر، القاهرة", "Total Purchases": 850, "Outstanding Balance": 0, "Status": "Active" },
    { "Customer ID": "CUST-103", "Name": "الحاج شريف محمود", "Phone Number": "01234567890", "Address": "المعادي، القاهرة", "Total Purchases": 4500, "Outstanding Balance": 1500, "Status": "Active" }
  ],
  Invoices: [
    { "Invoice Number": "INV-10001", "Customer ID": "CUST-101", "Customer Name": "المهندس أحمد حسن (مقاولات)", "Invoice Date": "2026-05-20", "Total Amount": 14500, "Paid Amount": 11300, "Remaining Amount": 3200, "Payment Method": "InstaPay", "Status": "Partially Paid", "Notes": "دفعة تمديدات شقة التجمع" },
    { "Invoice Number": "INV-10002", "Customer ID": "CUST-102", "Customer Name": "أ. محمد إبراهيم", "Invoice Date": "2026-05-25", "Total Amount": 850, "Paid Amount": 850, "Remaining Amount": 0, "Payment Method": "Cash", "Status": "Paid", "Notes": "شراء لمبات ومفاتيح تشطيب" },
    { "Invoice Number": "INV-10003", "Customer ID": "CUST-103", "Customer Name": "الحاج شريف محمود", "Invoice Date": "2026-06-01", "Total Amount": 1500, "Paid Amount": 0, "Remaining Amount": 1500, "Payment Method": "Bank Transfer", "Status": "Unpaid", "Notes": "باقي حساب بضاعة معلقة" }
  ],
  InvoiceItems: [
    { "Item ID": "ITEM-1", "Invoice Number": "INV-10001", "Product ID": "PROD-1002", "Product Name": "لفة سلك نحاس السويدي 2 مم (100 متر)", "Quantity": 10, "Purchase Price": 1200, "Selling Price": 1450, "Total Price": 14500 },
    { "Item ID": "ITEM-2", "Invoice Number": "INV-10002", "Product ID": "PROD-1001", "Product Name": "لمبة ليد فيليبس 12 وات إضاءة بيضاء E27", "Quantity": 10, "Purchase Price": 45, "Selling Price": 65, "Total Price": 650 },
    { "Item ID": "ITEM-3", "Invoice Number": "INV-10002", "Product ID": "PROD-1003", "Product Name": "مفتاح حائط مفرد أبيض", "Quantity": 5, "Purchase Price": 22, "Selling Price": 35, "Total Price": 175 },
    { "Item ID": "ITEM-4", "Invoice Number": "INV-10003", "Product ID": "PROD-1002", "Product Name": "لفة سلك نحاس السويدي 2 مم (100 متر)", "Quantity": 1, "Purchase Price": 1200, "Selling Price": 1450, "Total Price": 1450 },
    { "Item ID": "ITEM-5", "Invoice Number": "INV-10003", "Product ID": "PROD-1003", "Product Name": "مفتاح حائط مفرد أبيض", "Quantity": 1, "Purchase Price": 22, "Selling Price": 35, "Total Price": 35 }
  ],
  Expenses: [
    { "Expense ID": "EXP-1", "Date": "2026-05-01", "Category": "Rent", "Amount": 8000, "Notes": "إيجار المحل لشهر مايو 2026" },
    { "Expense ID": "EXP-2", "Date": "2026-05-15", "Category": "Electricity", "Amount": 1200, "Notes": "فاتورة الكهرباء" },
    { "Expense ID": "EXP-3", "Date": "2026-05-30", "Category": "Salaries", "Amount": 6000, "Notes": "راتب موظف المبيعات" }
  ],
  Settings: [
    { "Key": "Business Name", "Value": "الباز للادوات الكهربيه" },
    { "Key": "Address", "Value": "" },
    { "Key": "Phone Number", "Value": "+201018907086" },
    { "Key": "Currency", "Value": "EGP" },
    { "Key": "Admin Email", "Value": "admin@elbaz.com" },
    { "Key": "Admin Password", "Value": "admin" }
  ],
  Archive_Customers: []
};

function normalizeDate(dateVal) {
  if (!dateVal) return "";
  const str = String(dateVal).trim();
  if (str.includes("T") && str.endsWith("Z")) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  return str.substring(0, 10);
}

function normalizeDbDates(db) {
  if (!db) return db;
  if (Array.isArray(db.Invoices)) {
    db.Invoices.forEach(inv => {
      if (inv["Invoice Date"]) {
        inv["Invoice Date"] = normalizeDate(inv["Invoice Date"]);
      }
    });
  }
  if (Array.isArray(db.Expenses)) {
    db.Expenses.forEach(exp => {
      if (exp["Date"]) {
        exp["Date"] = normalizeDate(exp["Date"]);
      }
    });
  }
  if (Array.isArray(db.Archive_Customers)) {
    db.Archive_Customers.forEach(cust => {
      if (cust["Archive Date"]) {
        cust["Archive Date"] = normalizeDate(cust["Archive Date"]);
      }
    });
  }
  return db;
}

class ApiService {
  constructor() {
    this.settings = this.loadConfig();
    this.db = this.loadLocalDb();
    this.cleanupLocalArchivedCustomers();
    this.isMockMode = !this.settings.webAppUrl;
    this.syncListeners = [];
    this.isProcessingQueue = false;

    // Periodically sync pending queue every 20 seconds
    setInterval(() => {
      this.processPendingQueue();
    }, 20000);

    // Initial check on load after 3 seconds
    setTimeout(() => {
      this.processPendingQueue();
    }, 3000);
  }

  loadConfig() {
    const data = localStorage.getItem(API_CONFIG_KEY);
    if (data) {
      try {
        const config = JSON.parse(data);
        let modified = false;
        // Force update config with defaults if webAppUrl is blank
        if (!config.webAppUrl) {
          config.webAppUrl = defaultSettings.webAppUrl;
          config.businessName = defaultSettings.businessName;
          config.address = defaultSettings.address;
          config.phone = defaultSettings.phone;
          config.currency = defaultSettings.currency;
          modified = true;
        }
        // Force update config if admin credentials are missing
        if (!config.adminEmail) {
          config.adminEmail = defaultSettings.adminEmail;
          config.adminPassword = defaultSettings.adminPassword;
          modified = true;
        }
        if (!config.settingsPassword) {
          config.settingsPassword = defaultSettings.settingsPassword;
          modified = true;
        }
        if (modified) {
          localStorage.setItem(API_CONFIG_KEY, JSON.stringify(config));
        }
        return config;
      } catch (e) {
        return defaultSettings;
      }
    }
    // Setup defaults if empty
    localStorage.setItem(API_CONFIG_KEY, JSON.stringify(defaultSettings));
    return defaultSettings;
  }

  saveConfig(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    localStorage.setItem(API_CONFIG_KEY, JSON.stringify(this.settings));
    this.isMockMode = !this.settings.webAppUrl;
  }

  loadLocalDb() {
    const data = localStorage.getItem(LOCAL_DB_KEY);
    if (data) {
      try {
        const db = JSON.parse(data);
        if (!db.Archive_Customers) {
          db.Archive_Customers = [];
        }
        return normalizeDbDates(db);
      } catch (e) {
        const db = JSON.parse(JSON.stringify(demoDatabase));
        return normalizeDbDates(db);
      }
    }
    // Populate with demo data on first load
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(demoDatabase));
    return normalizeDbDates(JSON.parse(JSON.stringify(demoDatabase)));
  }

  cleanupLocalArchivedCustomers() {
    if (!this.db.Archive_Customers) {
      this.db.Archive_Customers = [];
      return;
    }
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const thresholdTime = sixtyDaysAgo.getTime();

    const originalLength = this.db.Archive_Customers.length;
    this.db.Archive_Customers = this.db.Archive_Customers.filter(customer => {
      const archiveDateStr = customer["Archive Date"];
      if (!archiveDateStr) return true; // Keep if no archive date is specified
      const archiveDate = new Date(archiveDateStr);
      if (isNaN(archiveDate.getTime())) return true; // Keep if invalid date
      return archiveDate.getTime() >= thresholdTime;
    });

    if (this.db.Archive_Customers.length !== originalLength) {
      console.log(`API: Pruned ${originalLength - this.db.Archive_Customers.length} expired archived customer(s) from local DB.`);
      this.saveLocalDb();
    }
  }

  saveLocalDb() {
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(this.db));
  }

  registerSyncListener(callback) {
    this.syncListeners.push(callback);
  }

  notifySyncListeners() {
    this.syncListeners.forEach(listener => listener(this.db));
  }

  /**
   * Syncs data from Google Sheet if URL is active.
   * Otherwise returns cached local db immediately.
   */
  async syncData() {
    if (this.isMockMode) {
      console.log("API: Running in Mock Mode. Using local state.");
      return this.db;
    }

    try {
      const response = await fetch(this.settings.webAppUrl, {
        method: "GET",
        mode: "cors"
      });

      if (!response.ok) {
        throw new Error("HTTP error " + response.status);
      }

      const resJson = await response.json();
      if (resJson.success && resJson.data) {
        this.db = normalizeDbDates(resJson.data);
        this.saveLocalDb();
        // Update local settings from DB if loaded
        if (this.db.Settings) {
          const loadedSettings = {};
          this.db.Settings.forEach(s => {
            if (s.Key === "Business Name") loadedSettings.businessName = s.Value;
            if (s.Key === "Address") loadedSettings.address = s.Value;
            if (s.Key === "Phone Number") loadedSettings.phone = s.Value;
            if (s.Key === "Currency") loadedSettings.currency = s.Value;
            if (s.Key === "Admin Email") loadedSettings.adminEmail = s.Value;
            if (s.Key === "Admin Password") loadedSettings.adminPassword = s.Value;
          });
          this.saveConfig(loadedSettings);
        }
        this.notifySyncListeners();
        return this.db;
      } else {
        throw new Error(resJson.error || "Failed to load database from Sheet");
      }
    } catch (error) {
      console.error("API Sync Failed. Falling back to local cache:", error);
      if (window.showToast) {
        showToast("فشلت المزامنة السحابية. يتم تشغيل النظام الآن بالنسخة المحلية المؤقتة.", "warning");
      }
      return this.db;
    }
  }

  /**
   * Helper to perform POST actions to Google Apps Script
   */
  async postAction(action, payload) {
    if (this.isMockMode) {
      return this.executeMockAction(action, payload);
    }

    try {
      const response = await fetch(this.settings.webAppUrl, {
        method: "POST",
        mode: "cors",
        body: JSON.stringify({ action, payload })
      });

      if (!response.ok) {
        throw new Error("HTTP Write Error: " + response.status);
      }

      const resJson = await response.json();
      if (resJson.success) {
        if (resJson.data) {
          this.db = normalizeDbDates(resJson.data);
          this.saveLocalDb();
          this.notifySyncListeners();
        }
        return resJson.result;
      } else {
        throw new Error(resJson.error || "Action failed on server");
      }
    } catch (error) {
      console.error(`API Action [${action}] failed. Storing in sync queue:`, error);
      
      // Execute locally first to keep UI responsive and updated
      const mockResult = await this.executeMockAction(action, payload);
      
      // Push failed action to sync queue
      const queue = this.getPendingQueue();
      queue.push({ action, payload, id: Date.now() });
      this.savePendingQueue(queue);
      
      if (window.showToast) {
        showToast("عذراً، انقطع اتصال الإنترنت! تم حفظ المعاملة محلياً مؤقتاً وسوف تُرفع تلقائياً فور عودة الشبكة.", "warning");
      }
      
      return mockResult;
    }
  }

  // --- Actions ---

  async saveProduct(product) {
    return this.postAction("saveProduct", product);
  }

  async saveCustomer(customer) {
    return this.postAction("saveCustomer", customer);
  }

  async saveInvoice(invoice, items) {
    return this.postAction("saveInvoice", { invoice, items });
  }

  async saveExpense(expense) {
    return this.postAction("saveExpense", expense);
  }

  async updateSettings(settingsList) {
    return this.postAction("updateSettings", settingsList);
  }

  async addPayment(invoiceNumber, amount, discountRemaining = false) {
    return this.postAction("addPayment", { invoiceNumber, amount, discountRemaining });
  }

  // --- Mock Execution for offline/independent run ---

  executeMockAction(action, payload) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          switch(action) {
            case "saveProduct":
              this.mockSaveProduct(payload);
              break;
            case "saveCustomer":
              this.mockSaveCustomer(payload);
              break;
            case "saveInvoice":
              this.mockSaveInvoice(payload);
              break;
            case "saveExpense":
              this.mockSaveExpense(payload);
              break;
            case "updateSettings":
              this.mockUpdateSettings(payload);
              break;
            case "addPayment":
              this.mockAddPayment(payload);
              break;
            default:
              throw new Error("Unknown mock action: " + action);
          }
          this.saveLocalDb();
          this.notifySyncListeners();
          resolve({ success: true, mock: true });
        } catch (e) {
          reject(e);
        }
      }, 500);
    });
  }

  mockSaveProduct(product) {
    const id = product["Product ID"];
    const buy = parseFloat(product["Purchase Price"]) || 0;
    const sell = parseFloat(product["Selling Price"]) || 0;
    product["Profit Per Unit"] = sell - buy;
    product["Status"] = product["Status"] || "Active";
    product["Current Quantity"] = parseFloat(product["Current Quantity"]) || 0;
    product["Minimum Quantity Alert"] = parseFloat(product["Minimum Quantity Alert"]) || 0;

    const existingIndex = this.db.Products.findIndex(p => p["Product ID"] === id);
    if (existingIndex !== -1) {
      product["Creation Date"] = this.db.Products[existingIndex]["Creation Date"];
      this.db.Products[existingIndex] = product;
    } else {
      product["Creation Date"] = product["Creation Date"] || new Date().toISOString();
      this.db.Products.push(product);
    }
  }

  mockSaveCustomer(customer) {
    const id = customer["Customer ID"];
    customer["Status"] = customer["Status"] || "Active";
    customer["Total Purchases"] = parseFloat(customer["Total Purchases"]) || 0;
    customer["Outstanding Balance"] = parseFloat(customer["Outstanding Balance"]) || 0;

    // Ensure Archive_Customers array exists in mock DB
    if (!this.db.Archive_Customers) {
      this.db.Archive_Customers = [];
    }

    if (customer["Status"] === "Archived") {
      // Set Archive Date to current date if not set
      if (!customer["Archive Date"]) {
        customer["Archive Date"] = new Date().toISOString().split('T')[0];
      }

      // Remove from active list if present
      const activeIdx = this.db.Customers.findIndex(c => c["Customer ID"] === id);
      if (activeIdx !== -1) {
        this.db.Customers.splice(activeIdx, 1);
      }

      // Save/Update in Archive_Customers list
      const archIdx = this.db.Archive_Customers.findIndex(c => c["Customer ID"] === id);
      if (archIdx !== -1) {
        this.db.Archive_Customers[archIdx] = customer;
      } else {
        this.db.Archive_Customers.push(customer);
      }
    } else {
      // Remove from Archive_Customers if present
      const archIdx = this.db.Archive_Customers.findIndex(c => c["Customer ID"] === id);
      if (archIdx !== -1) {
        this.db.Archive_Customers.splice(archIdx, 1);
      }

      // Remove Archive Date property if it exists
      delete customer["Archive Date"];

      // Save/Update in Customers list
      const activeIdx = this.db.Customers.findIndex(c => c["Customer ID"] === id);
      if (activeIdx !== -1) {
        this.db.Customers[activeIdx] = customer;
      } else {
        this.db.Customers.push(customer);
      }
    }
  }

  mockSaveInvoice({ invoice, items }) {
    invoice["Total Amount"] = parseFloat(invoice["Total Amount"]) || 0;
    invoice["Paid Amount"] = parseFloat(invoice["Paid Amount"]) || 0;
    invoice["Remaining Amount"] = parseFloat(invoice["Remaining Amount"]) || 0;
    invoice["Discount"] = parseFloat(invoice["Discount"]) || 0;
    
    this.db.Invoices.unshift(invoice);

    items.forEach(item => {
      item["Quantity"] = parseFloat(item["Quantity"]) || 0;
      item["Purchase Price"] = parseFloat(item["Purchase Price"]) || 0;
      item["Selling Price"] = parseFloat(item["Selling Price"]) || 0;
      item["Total Price"] = parseFloat(item["Total Price"]) || 0;
      
      this.db.InvoiceItems.push(item);

      const pIndex = this.db.Products.findIndex(p => p["Product ID"] === item["Product ID"]);
      if (pIndex !== -1) {
        const cur = parseFloat(this.db.Products[pIndex]["Current Quantity"]) || 0;
        this.db.Products[pIndex]["Current Quantity"] = Math.max(0, cur - item["Quantity"]);
      }
    });

    const custId = invoice["Customer ID"];
    if (custId && custId !== "GENERIC") {
      const cIndex = this.db.Customers.findIndex(c => c["Customer ID"] === custId);
      if (cIndex !== -1) {
        const curPurch = parseFloat(this.db.Customers[cIndex]["Total Purchases"]) || 0;
        const curBal = parseFloat(this.db.Customers[cIndex]["Outstanding Balance"]) || 0;
        this.db.Customers[cIndex]["Total Purchases"] = curPurch + invoice["Total Amount"];
        this.db.Customers[cIndex]["Outstanding Balance"] = curBal + invoice["Remaining Amount"];
      }
    }
  }

  mockSaveExpense(expense) {
    expense["Expense ID"] = expense["Expense ID"] || "EXP-" + Date.now();
    expense["Date"] = expense["Date"] || getLocalDateString();
    expense["Amount"] = parseFloat(expense["Amount"]) || 0;
    this.db.Expenses.unshift(expense);
  }

  mockUpdateSettings(settingsList) {
    settingsList.forEach(s => {
      const existingIndex = this.db.Settings.findIndex(sett => sett.Key === s.Key);
      if (existingIndex !== -1) {
        this.db.Settings[existingIndex].Value = s.Value;
      } else {
        this.db.Settings.push({ Key: s.Key, Value: s.Value });
      }

      if (s.Key === "Business Name") this.settings.businessName = s.Value;
      if (s.Key === "Address") this.settings.address = s.Value;
      if (s.Key === "Phone Number") this.settings.phone = s.Value;
      if (s.Key === "Currency") this.settings.currency = s.Value;
      if (s.Key === "Admin Email") this.settings.adminEmail = s.Value;
      if (s.Key === "Admin Password") this.settings.adminPassword = s.Value;
    });
    localStorage.setItem(API_CONFIG_KEY, JSON.stringify(this.settings));
  }

  mockAddPayment({ invoiceNumber, amount, discountRemaining }) {
    const amt = parseFloat(amount) || 0;
    const isDiscount = discountRemaining === true || discountRemaining === "true";
    const invIndex = this.db.Invoices.findIndex(i => i["Invoice Number"] === invoiceNumber);
    
    if (invIndex === -1) throw new Error("فاتورة غير موجودة: " + invoiceNumber);
    
    const invoice = this.db.Invoices[invIndex];
    const total = parseFloat(invoice["Total Amount"]) || 0;
    const curPaid = parseFloat(invoice["Paid Amount"]) || 0;
    const curDiscount = parseFloat(invoice["Discount"]) || 0;
    
    const newPaid = curPaid + amt;
    let newDiscount = curDiscount;
    if (isDiscount) {
      const waivedAmount = Math.max(0, total - curPaid - curDiscount - amt);
      newDiscount = curDiscount + waivedAmount;
    }
    
    let newRem = Math.max(0, total - newPaid - newDiscount);
    if (isDiscount) {
      newRem = 0;
    }
    let newStatus = "Partially Paid";
    if (newRem <= 0) {
      newStatus = "Paid";
    }

    this.db.Invoices[invIndex]["Paid Amount"] = newPaid;
    this.db.Invoices[invIndex]["Discount"] = newDiscount;
    this.db.Invoices[invIndex]["Remaining Amount"] = newRem;
    this.db.Invoices[invIndex]["Status"] = newStatus;

    const custId = invoice["Customer ID"];
    if (custId && custId !== "GENERIC") {
      const cIndex = this.db.Customers.findIndex(c => c["Customer ID"] === custId);
      if (cIndex !== -1) {
        const curBal = parseFloat(this.db.Customers[cIndex]["Outstanding Balance"]) || 0;
        const debtCleared = isDiscount ? (total - curPaid - curDiscount) : amt;
        this.db.Customers[cIndex]["Outstanding Balance"] = Math.max(0, curBal - debtCleared);
      }
    }
  }

  getPendingQueue() {
    try {
      const saved = localStorage.getItem("elbaz_pending_sync");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  savePendingQueue(queue) {
    localStorage.setItem("elbaz_pending_sync", JSON.stringify(queue));
  }

  async processPendingQueue() {
    if (this.isProcessingQueue) return;
    if (this.isMockMode) return;

    const queue = this.getPendingQueue();
    if (queue.length === 0) return;

    this.isProcessingQueue = true;
    console.log(`API Queue: Found ${queue.length} pending actions. Starting background upload...`);

    let successCount = 0;

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      try {
        const response = await fetch(this.settings.webAppUrl, {
          method: "POST",
          mode: "cors",
          body: JSON.stringify({ action: item.action, payload: item.payload })
        });

        if (!response.ok) {
          throw new Error("HTTP error " + response.status);
        }

        const resJson = await response.json();
        if (resJson.success) {
          successCount++;
          if (resJson.data) {
            this.db = normalizeDbDates(resJson.data);
            this.saveLocalDb();
          }
        } else {
          console.warn(`API Queue: Action [${item.action}] rejected by sheet:`, resJson.error);
          successCount++; // Skip rejected payload to avoid blocking queue
        }
      } catch (err) {
        console.warn(`API Queue: Failed to sync action [${item.action}] due to connection:`, err);
        break; // Retry later when network is stable
      }
    }

    if (successCount > 0) {
      const remaining = this.getPendingQueue().slice(successCount);
      this.savePendingQueue(remaining);
      this.notifySyncListeners();
      if (window.showToast) {
        showToast(`تم رفع ومزامنة عدد ${successCount} معاملات أوفلاين مع السحابة بنجاح!`, "success");
      }
    }

    this.isProcessingQueue = false;
  }
}

const api = new ApiService();
window.api = api;
