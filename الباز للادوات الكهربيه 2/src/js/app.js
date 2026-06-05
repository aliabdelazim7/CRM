/**
 * Main Application Coordinator & Router - Arabic Localized
 * Manages global state, routing, notification toasts, loaders, and triggers module renders
 */

// Global State
window.appState = {
  db: {
    Products: [],
    Customers: [],
    Invoices: [],
    InvoiceItems: [],
    Expenses: [],
    Settings: []
  },
  currentRoute: "dashboard",
  settings: {
    businessName: "الباز للأدوات الكهربائية",
    currency: "جنيه",
    address: "القاهرة، مصر",
    phone: "+20 123 456 7890"
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  // Check auth first
  initAuth();

  // Ensure dark class is removed and clean up theme key
  document.documentElement.classList.remove("dark");
  localStorage.removeItem("elbaz_theme");

  // Show login success toast if navigated from login screen
  const loginToast = sessionStorage.getItem("elbaz_login_toast");
  if (loginToast) {
    if (loginToast === "demo") {
      showToast("تم تسجيل الدخول في وضع العرض التجريبي (Demo Mode)", "success");
    } else if (loginToast === "admin") {
      showToast("تم تسجيل الدخول بنجاح", "success");
    }
    sessionStorage.removeItem("elbaz_login_toast");
  }

  // Bind global UI events
  initRouter();
  initGlobalEvents();
  
  // Render Lucide icons initially
  lucide.createIcons();

  // Load configuration first
  loadSettingsFromConfig();

  // Initial Sync from database
  await syncDatabase(true);
});

/**
 * Hash Routing Handler
 */
function initRouter() {
  const routes = ["dashboard", "pos", "products", "customers", "expenses", "reports", "settings"];
  
  const handleRoute = () => {
    let hash = window.location.hash.replace("#", "");
    if (!routes.includes(hash)) {
      hash = "dashboard";
    }

    // Intercept settings page access with a password gate
    if (hash === "settings") {
      const config = api.loadConfig();
      const settingsPass = config.settingsPassword || "admin_settings";
      const enteredPass = prompt("برجاء إدخال كلمة مرور مدير النظام للوصول لصفحة الإعدادات:");
      if (enteredPass !== settingsPass) {
        showToast("خطأ: كلمة مرور الإعدادات غير صحيحة!", "error");
        // Revert hash to the previous valid route, or dashboard if none
        const prevRoute = window.appState.currentRoute === "settings" ? "dashboard" : (window.appState.currentRoute || "dashboard");
        window.location.hash = `#${prevRoute}`;
        return;
      }
    }
    
    window.appState.currentRoute = hash;
    
    // Toggle page views
    routes.forEach(route => {
      const pageEl = document.getElementById(`${route}-page`);
      const navLink = document.getElementById(`nav-${route}`);
      
      if (route === hash) {
        if (pageEl) pageEl.classList.remove("hidden");
        if (navLink) {
          navLink.classList.remove("sidebar-link-inactive");
          navLink.classList.add("sidebar-link-active");
        }
        // Trigger module specific renders
        renderRoutePage(route);
      } else {
        if (pageEl) pageEl.classList.add("hidden");
        if (navLink) {
          navLink.classList.remove("sidebar-link-active");
          navLink.classList.add("sidebar-link-inactive");
        }
      }
    });

    // Close mobile menu if open on route change
    const sidebar = document.querySelector("aside");
    if (sidebar) sidebar.classList.add("hidden");
  };

  window.addEventListener("hashchange", handleRoute);
  
  // Trigger initial route
  if (!window.location.hash) {
    window.location.hash = "#dashboard";
  } else {
    handleRoute();
  }
}

/**
 * Route Render Dispatcher
 */
function renderRoutePage(route) {
  try {
    switch (route) {
      case "dashboard":
        if (window.renderDashboard) window.renderDashboard();
        break;
      case "pos":
        if (window.renderPOS) window.renderPOS();
        break;
      case "products":
        if (window.renderProducts) window.renderProducts();
        break;
      case "customers":
        if (window.renderCustomers) window.renderCustomers();
        break;
      case "expenses":
        if (window.renderExpenses) window.renderExpenses();
        break;
      case "reports":
        if (window.renderReports) window.renderReports();
        break;
      case "settings":
        if (window.renderSettings) window.renderSettings();
        break;
    }
  } catch (error) {
    console.error(`Error rendering page [${route}]:`, error);
    showToast(`فشل تحميل الصفحة: ${error.message}`, "error");
  }
}

/**
 * Binds sidebar buttons, mobile menu toggle, search bar
 */
function initGlobalEvents() {
  // Mobile menu button
  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const sidebar = document.querySelector("aside");
  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener("click", () => {
      sidebar.classList.toggle("hidden");
    });
  }

  // Sidebar Manual Sync button
  const syncBtn = document.getElementById("sidebar-sync-btn");
  if (syncBtn) {
    syncBtn.addEventListener("click", async () => {
      await syncDatabase();
    });
  }

  // Settings Save Event Hook
  const settingsForm = document.getElementById("settings-form");
  if (settingsForm) {
    settingsForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const newUrl = document.getElementById("settings-api-url").value.trim();
      const newBizName = document.getElementById("settings-business-name").value.trim();
      const newCurrency = document.getElementById("settings-currency").value.trim();
      const newAddress = document.getElementById("settings-address").value.trim();
      const newPhone = document.getElementById("settings-phone").value.trim();
      const newEmail = document.getElementById("settings-admin-email").value.trim();
      const newPass = document.getElementById("settings-admin-password").value.trim();
      const newSettingsPass = document.getElementById("settings-page-password").value.trim();

      showLoader("Saving Settings & Connecting...");

      try {
        // Save locally first
        api.saveConfig({
          webAppUrl: newUrl,
          businessName: newBizName,
          currency: newCurrency,
          address: newAddress,
          phone: newPhone,
          adminEmail: newEmail,
          adminPassword: newPass,
          settingsPassword: newSettingsPass
        });

        // Try syncing / write to sheets
        await api.updateSettings([
          { Key: "Business Name", Value: newBizName },
          { Key: "Address", Value: newAddress },
          { Key: "Phone Number", Value: newPhone },
          { Key: "Currency", Value: newCurrency },
          { Key: "Admin Email", Value: newEmail },
          { Key: "Admin Password", Value: newPass },
          { Key: "Settings Password", Value: newSettingsPass }
        ]);
        
        loadSettingsFromConfig();
        showToast("Saved settings successfully", "success");
        
        // Re-sync database
        await syncDatabase(true);
      } catch (err) {
        showToast(`Failed to sync configs: ${err.message}`, "error");
      } finally {
        hideLoader();
      }
    });
  }

  // Login Form Submission
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value.trim();
      const pass = document.getElementById("login-password").value.trim();

      const currentConfig = api.loadConfig();
      const correctEmail = currentConfig.adminEmail || "admin@elbaz.com";
      const correctPass = currentConfig.adminPassword || "admin";

      // Clear any previous session details from both storages first
      localStorage.removeItem("elbaz_session_active");
      localStorage.removeItem("elbaz_demo_mode");
      sessionStorage.removeItem("elbaz_session_active");
      sessionStorage.removeItem("elbaz_demo_mode");

      const rememberMe = document.getElementById("login-remember")?.checked;
      const storage = rememberMe ? localStorage : sessionStorage;

      if (email === "demo@elbaz.com" && pass === "demo") {
        storage.setItem("elbaz_session_active", "true");
        storage.setItem("elbaz_demo_mode", "true");
        sessionStorage.setItem("elbaz_login_toast", "demo");
        location.reload();
      } else if (email === correctEmail && pass === correctPass) {
        storage.setItem("elbaz_session_active", "true");
        storage.setItem("elbaz_demo_mode", "false");
        sessionStorage.setItem("elbaz_login_toast", "admin");
        location.reload();
      } else {
        showToast("خطأ: البريد الإلكتروني أو كلمة المرور غير صحيحة!", "error");
      }
    });
  }

  // Password toggle in login form
  const passToggle = document.getElementById("login-password-toggle");
  if (passToggle) {
    passToggle.addEventListener("click", () => {
      const passInput = document.getElementById("login-password");
      const passEye = document.getElementById("login-password-eye");
      if (passInput && passEye) {
        if (passInput.type === "password") {
          passInput.type = "text";
          passEye.setAttribute("data-lucide", "eye-off");
        } else {
          passInput.type = "password";
          passEye.setAttribute("data-lucide", "eye");
        }
        lucide.createIcons();
      }
    });
  }

  // Sidebar Logout button click
  const logoutBtn = document.getElementById("sidebar-logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      const confirmLogout = confirm("هل تريد تسجيل الخروج من النظام بالفعل؟");
      if (confirmLogout) {
        localStorage.removeItem("elbaz_session_active");
        localStorage.removeItem("elbaz_demo_mode");
        sessionStorage.removeItem("elbaz_session_active");
        sessionStorage.removeItem("elbaz_demo_mode");
        location.reload();
      }
    });
  }

  // Global search bar handler
  const globalSearch = document.getElementById("global-search-input");
  const searchResultsDropdown = document.getElementById("global-search-results");

  if (globalSearch && searchResultsDropdown) {
    globalSearch.addEventListener("input", (e) => {
      const query = e.target.value.trim();
      
      // 1. Forward search to active page filters
      const filterQuery = query.toLowerCase();
      const route = window.appState.currentRoute;
      if (route === "products") {
        const prodSearch = document.getElementById("prod-search");
        if (prodSearch) {
          prodSearch.value = filterQuery;
          prodSearch.dispatchEvent(new Event("input"));
        }
      } else if (route === "customers") {
        const custSearch = document.getElementById("cust-search");
        if (custSearch) {
          custSearch.value = filterQuery;
          custSearch.dispatchEvent(new Event("input"));
        }
      } else if (route === "pos") {
        const posSearch = document.getElementById("pos-product-search");
        if (posSearch) {
          posSearch.value = filterQuery;
          posSearch.dispatchEvent(new Event("input"));
        }
      }

      // 2. Populate and display global search results
      if (query.length < 2) {
        searchResultsDropdown.innerHTML = "";
        searchResultsDropdown.classList.add("hidden");
        return;
      }

      renderGlobalSearchResults(query);
    });

    globalSearch.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const query = e.target.value.trim().toUpperCase();
        if (query.startsWith("INV-")) {
          if (typeof window.printInvoiceFromHistory === "function") {
            window.printInvoiceFromHistory(query);
            globalSearch.value = "";
            searchResultsDropdown.classList.add("hidden");
          }
        }
      }
    });

    // Close search dropdown on click outside
    document.addEventListener("click", (e) => {
      if (!globalSearch.contains(e.target) && !searchResultsDropdown.contains(e.target)) {
        searchResultsDropdown.classList.add("hidden");
      }
    });
  }

  // Notification alert button popover toggle
  const alertBtn = document.getElementById("header-alert-btn");
  const notificationPopover = document.getElementById("notification-popover");
  if (alertBtn && notificationPopover) {
    alertBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      notificationPopover.classList.toggle("hidden");
      if (!notificationPopover.classList.contains("hidden")) {
        populateNotifications();
      }
    });

    // Close popover when clicking outside
    document.addEventListener("click", (e) => {
      if (!alertBtn.contains(e.target) && !notificationPopover.contains(e.target)) {
        notificationPopover.classList.add("hidden");
      }
    });
  }

  // Register Sync listener from API
  api.registerSyncListener((freshDb) => {
    window.appState.db = freshDb;
    updateSyncUI();
    renderRoutePage(window.appState.currentRoute);
  });
}

/**
 * Loads cached configuration settings on boot
 */
function loadSettingsFromConfig() {
  const config = api.loadConfig();
  window.appState.settings = {
    businessName: config.businessName || "الباز للادوات الكهربيه",
    currency: config.currency || "EGP",
    address: config.address || "",
    phone: config.phone || "",
    adminEmail: config.adminEmail || "admin@elbaz.com",
    adminPassword: config.adminPassword || "admin",
    settingsPassword: config.settingsPassword || "admin_settings"
  };
  
  const navTitle = document.getElementById("nav-business-title");
  const headerName = document.getElementById("header-business-name");
  const headerCurrency = document.getElementById("header-currency-code");
  const loginTitle = document.getElementById("login-business-title");
  
  const isDemo = localStorage.getItem("elbaz_demo_mode") === "true" || sessionStorage.getItem("elbaz_demo_mode") === "true";
  if (navTitle) {
    if (isDemo) {
      navTitle.innerHTML = window.appState.settings.businessName + ' <span class="inline-block bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded-full font-bold border border-amber-200 mr-1.5">وضع تجريبي</span>';
    } else {
      navTitle.textContent = window.appState.settings.businessName;
    }
  }
  if (headerName) {
    if (isDemo) {
      headerName.innerHTML = window.appState.settings.businessName + ' <span class="inline-block bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded-full font-bold border border-amber-200 mr-1.5">وضع تجريبي</span>';
    } else {
      headerName.textContent = window.appState.settings.businessName;
    }
  }
  if (headerCurrency) headerCurrency.textContent = `العملة: ${window.appState.settings.currency}`;
  if (loginTitle) loginTitle.textContent = window.appState.settings.businessName;

  // Set settings form inputs
  const emailInput = document.getElementById("settings-admin-email");
  const passInput = document.getElementById("settings-admin-password");
  const settingsPassInput = document.getElementById("settings-page-password");
  if (emailInput) emailInput.value = window.appState.settings.adminEmail;
  if (passInput) passInput.value = window.appState.settings.adminPassword;
  if (settingsPassInput) settingsPassInput.value = window.appState.settings.settingsPassword;
}

/**
 * Handles database syncing
 */
async function syncDatabase(silent = false) {
  if (!silent) showLoader("جاري مزامنة البيانات...");
  
  const syncIcon = document.getElementById("sync-icon");
  if (syncIcon) syncIcon.classList.add("animate-spin");

  try {
    const data = await api.syncData();
    window.appState.db = data;
    updateSyncUI();
    
    checkStockAlertStatus();
    renderRoutePage(window.appState.currentRoute);
    if (!silent) showToast("تم تحديث البيانات بنجاح", "success");
  } catch (error) {
    console.error("Sync Error:", error);
    showToast(`فشلت المزامنة المباشرة. تعمل على النسخة المحلية مؤقتاً.`, "warning");
    
    window.appState.db = api.loadLocalDb();
    updateSyncUI();
    checkStockAlertStatus();
    renderRoutePage(window.appState.currentRoute);
  } finally {
    if (syncIcon) syncIcon.classList.remove("animate-spin");
    if (!silent) hideLoader();
  }
}

/**
 * Update connection status indicator
 */
function updateSyncUI() {
  const badge = document.getElementById("sync-status-badge");
  if (!badge) return;

  if (api.isMockMode) {
    badge.textContent = "وضع التجربة";
    badge.className = "px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800";
  } else {
    const queue = (typeof api.getPendingQueue === "function") ? api.getPendingQueue() : [];
    if (queue.length > 0) {
      badge.textContent = `انتظار المزامنة: ${queue.length} معلق`;
      badge.className = "px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 animate-pulse";
    } else {
      badge.textContent = "متصل بجوجل شيت";
      badge.className = "px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800";
    }
  }
}

/**
 * Controls Red Alert notification dot for low stock products
 */
function checkStockAlertStatus() {
  populateNotifications();
}

// --- Global UI Helpers ---

window.showLoader = function(text = "جاري المعالجة...") {
  const overlay = document.getElementById("loader-overlay");
  const loaderText = document.getElementById("loader-text");
  if (overlay && loaderText) {
    loaderText.textContent = text;
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
  }
};

window.hideLoader = function() {
  const overlay = document.getElementById("loader-overlay");
  if (overlay) {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
  }
};

/**
 * Render Toast Notification - RTL oriented layout
 */
window.showToast = function(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "p-4 rounded-xl shadow-lg border flex items-start space-x-reverse space-x-3 pointer-events-auto toast-slide-in transition-all duration-300";

  let bgClass, borderClass, iconColor, iconName;
  switch (type) {
    case "success":
      bgClass = "bg-emerald-50";
      borderClass = "border-emerald-200";
      iconColor = "text-emerald-500";
      iconName = "check-circle";
      break;
    case "warning":
      bgClass = "bg-amber-50";
      borderClass = "border-amber-200";
      iconColor = "text-amber-500";
      iconName = "alert-triangle";
      break;
    case "error":
      bgClass = "bg-rose-50";
      borderClass = "border-rose-200";
      iconColor = "text-rose-500";
      iconName = "alert-circle";
      break;
    default:
      bgClass = "bg-indigo-50";
      borderClass = "border-indigo-200";
      iconColor = "text-indigo-500";
      iconName = "info";
  }

  toast.classList.add(bgClass, borderClass);

  toast.innerHTML = `
    <div class="${iconColor}">
      <i data-lucide="${iconName}" class="w-5 h-5"></i>
    </div>
    <div class="flex-1 text-right">
      <p class="text-xs font-semibold text-slate-800">${message}</p>
    </div>
    <button class="text-slate-400 hover:text-slate-600 transition-colors mr-2" onclick="this.parentElement.remove()">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>
  `;

  container.appendChild(toast);
  lucide.createIcons({ attrs: { class: 'w-4 h-4' } });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50px)"; // Slide out to the left in RTL
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

/**
 * Global helper to format numerical values with business currency
 */
window.formatCurrency = function(value) {
  const num = parseFloat(value) || 0;
  return `${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${window.appState.settings.currency}`;
};

/**
 * Helper to generate unique serial IDs (e.g. products, customer, expense keys)
 */
window.generateId = function(prefix) {
  return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
};

/**
 * Timezone-safe local YYYY-MM-DD date formatter
 */
window.getLocalDateString = function(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Dynamically query and show match items in the global search dropdown popup
 */
function renderGlobalSearchResults(query) {
  const dropdown = document.getElementById("global-search-results");
  if (!dropdown) return;

  const db = window.appState.db;
  const q = query.toLowerCase().trim();

  // Find Products safely
  const products = (db.Products || []).filter(p => 
    (p["Status"] || "Active") !== "Archived" && (
      (p["Product Name"] && String(p["Product Name"]).toLowerCase().includes(q)) ||
      (p["Product ID"] && String(p["Product ID"]).toLowerCase().includes(q))
    )
  ).slice(0, 3);

  // Find Customers safely
  const customers = (db.Customers || []).filter(c => 
    (c["Status"] || "Active") !== "Archived" && c["Customer ID"] !== "GENERIC" && (
      (c["Name"] && String(c["Name"]).toLowerCase().includes(q)) ||
      (c["Phone Number"] && String(c["Phone Number"]).includes(q))
    )
  ).slice(0, 3);

  // Find Invoices safely
  const invoices = (db.Invoices || []).filter(i => 
    (i["Invoice Number"] && String(i["Invoice Number"]).toLowerCase().includes(q)) ||
    (i["Customer Name"] && String(i["Customer Name"]).toLowerCase().includes(q))
  ).slice(0, 3);

  const totalResults = products.length + customers.length + invoices.length;

  if (totalResults === 0) {
    dropdown.innerHTML = `
      <div class="p-3 text-center text-slate-400">
        لا توجد نتائج مطابقة للبحث.
      </div>
    `;
    dropdown.classList.remove("hidden");
    return;
  }

  let html = "";

  if (products.length > 0) {
    html += `<div class="font-bold text-slate-400 border-b border-slate-100 pb-1 mb-1 mt-1 text-right">المنتجات</div>`;
    html += products.map(p => `
      <div onclick="clickGlobalSearchProduct('${p["Product ID"]}')" class="p-2 hover:bg-slate-50 rounded-lg cursor-pointer flex justify-between items-center transition-all">
        <span class="font-bold text-slate-800 text-[11px] text-right ml-2">${p["Product Name"]}</span>
        <span class="font-mono text-indigo-600 font-semibold text-[10px] shrink-0">${formatCurrency(p["Selling Price"])}</span>
      </div>
    `).join("");
  }

  if (customers.length > 0) {
    html += `<div class="font-bold text-slate-400 border-b border-slate-100 pb-1 mt-2 mb-1 text-right">العملاء</div>`;
    html += customers.map(c => `
      <div onclick="clickGlobalSearchCustomer('${c["Customer ID"]}')" class="p-2 hover:bg-slate-50 rounded-lg cursor-pointer flex justify-between items-center transition-all">
        <span class="font-bold text-slate-800 text-[11px] text-right">${c["Name"]}</span>
        <span class="font-mono text-slate-500 text-[10px] shrink-0">${c["Phone Number"]}</span>
      </div>
    `).join("");
  }

  if (invoices.length > 0) {
    html += `<div class="font-bold text-slate-400 border-b border-slate-100 pb-1 mt-2 mb-1 text-right">الفواتير</div>`;
    html += invoices.map(i => `
      <div onclick="clickGlobalSearchInvoice('${i["Invoice Number"]}')" class="p-2 hover:bg-slate-50 rounded-lg cursor-pointer flex justify-between items-center transition-all">
        <span class="font-bold text-indigo-600 font-mono text-[11px] text-right">${i["Invoice Number"]}</span>
        <span class="text-slate-500 text-[10px] shrink-0 text-left">${i["Customer Name"]} (${formatCurrency(i["Total Amount"])})</span>
      </div>
    `).join("");
  }

  dropdown.innerHTML = html;
  dropdown.classList.remove("hidden");
}

// Click handlers for global search dropdown items
window.clickGlobalSearchProduct = function(productId) {
  document.getElementById("global-search-results").classList.add("hidden");
  document.getElementById("global-search-input").value = "";
  window.location.hash = "#products";
  setTimeout(() => {
    if (typeof window.openProductModal === "function") {
      window.openProductModal(productId);
    }
  }, 100);
};

window.clickGlobalSearchCustomer = function(customerId) {
  document.getElementById("global-search-results").classList.add("hidden");
  document.getElementById("global-search-input").value = "";
  window.location.hash = "#customers";
  setTimeout(() => {
    if (typeof window.openCustomerDrawer === "function") {
      window.openCustomerDrawer(customerId);
    }
  }, 100);
};

window.clickGlobalSearchInvoice = function(invoiceNumber) {
  document.getElementById("global-search-results").classList.add("hidden");
  document.getElementById("global-search-input").value = "";
  setTimeout(() => {
    if (typeof window.printInvoiceFromHistory === "function") {
      window.printInvoiceFromHistory(invoiceNumber);
    }
  }, 100);
};

/**
 * Compiles low stock and unpaid invoice notifications
 */
function populateNotifications() {
  const db = window.appState.db;
  const list = document.getElementById("notification-list");
  const badge = document.getElementById("notification-count-badge");
  const alertDot = document.getElementById("low-stock-alert-dot");
  
  if (!list) return;

  const lowStock = (db.Products || []).filter(p => {
    const qty = parseFloat(p["Current Quantity"]) || 0;
    const minAlert = parseFloat(p["Minimum Quantity Alert"]) || 0;
    const status = p["Status"] || "Active";
    return status === "Active" && qty <= minAlert;
  });

  const unpaidInvoices = (db.Invoices || []).filter(i => 
    i["Status"] !== "Paid" && (parseFloat(i["Remaining Amount"]) || 0) > 0
  );

  const totalAlerts = lowStock.length + unpaidInvoices.length;

  // Update badge and red dot
  if (badge) {
    if (totalAlerts > 0) {
      badge.textContent = totalAlerts;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  if (alertDot) {
    if (totalAlerts > 0) {
      alertDot.classList.remove("hidden");
    } else {
      alertDot.classList.add("hidden");
    }
  }

  if (totalAlerts === 0) {
    list.innerHTML = `
      <div class="py-6 text-center text-slate-400 font-semibold">
        لا توجد أي تنبيهات حالياً. كل شيء تمام!
      </div>
    `;
    return;
  }

  let html = "";

  if (lowStock.length > 0) {
    html += `<div class="font-bold text-rose-600 mb-1 border-b border-rose-50 pb-1 text-right">نقص المخزون (${lowStock.length})</div>`;
    html += lowStock.map(p => {
      const qty = parseFloat(p["Current Quantity"]) || 0;
      return `
        <div onclick="clickNotificationProduct('${p["Product ID"]}')" class="p-2 hover:bg-rose-50/50 rounded-lg cursor-pointer transition-all border border-rose-100/20 bg-rose-50/10 mb-1.5 text-right">
          <p class="font-bold text-slate-800 text-[11px]">${p["Product Name"]}</p>
          <p class="text-[9px] text-rose-600 font-semibold mt-0.5">المخزون الحالي: ${qty} وحدات (حد الأمان: ${p["Minimum Quantity Alert"]})</p>
        </div>
      `;
    }).join("");
  }

  if (unpaidInvoices.length > 0) {
    html += `<div class="font-bold text-amber-600 mt-3.5 mb-1 border-b border-amber-50 pb-1 text-right">مديونيات فواتير معلقة (${unpaidInvoices.length})</div>`;
    html += unpaidInvoices.map(i => {
      const due = parseFloat(i["Remaining Amount"]) || 0;
      return `
        <div onclick="clickNotificationInvoice('${i["Invoice Number"]}')" class="p-2 hover:bg-amber-50/50 rounded-lg cursor-pointer transition-all border border-amber-100/20 bg-amber-50/10 mb-1.5 text-right">
          <div class="flex justify-between font-bold text-slate-800 text-[11px]">
            <span class="text-indigo-600 font-mono">${i["Invoice Number"]}</span>
            <span>العميل: ${i["Customer Name"]}</span>
          </div>
          <p class="text-[9px] text-rose-600 font-semibold mt-0.5 text-left font-mono">المتبقي: ${formatCurrency(due)}</p>
        </div>
      `;
    }).join("");
  }

  list.innerHTML = html;
}

// Click actions for notification items
window.clickNotificationProduct = function(productId) {
  document.getElementById("notification-popover").classList.add("hidden");
  window.location.hash = "#products";
  setTimeout(() => {
    if (typeof window.openProductModal === "function") {
      window.openProductModal(productId);
    }
  }, 100);
};

window.clickNotificationInvoice = function(invoiceNumber) {
  document.getElementById("notification-popover").classList.add("hidden");
  setTimeout(() => {
    if (typeof window.printInvoiceFromHistory === "function") {
      window.printInvoiceFromHistory(invoiceNumber);
    }
  }, 100);
};

/**
 * Authentication check helper
 */
window.initAuth = function() {
  const loginOverlay = document.getElementById("login-overlay");
  if (!loginOverlay) return;

  const sessionActive = localStorage.getItem("elbaz_session_active") === "true" || sessionStorage.getItem("elbaz_session_active") === "true";
  if (sessionActive) {
    loginOverlay.classList.add("hidden");
  } else {
    loginOverlay.classList.remove("hidden");
  }
};
