/**
 * Dashboard & Business Analytics Module - Localized to Arabic
 * Handles metric card summaries, best selling items, low stock warnings, and Chart.js graphs
 */

window.dailySalesChartInstance = null;
window.paymentMethodsChartInstance = null;

window.renderDashboard = function() {
  const db = window.appState.db;
  const invoices = db.Invoices || [];
  const items = db.InvoiceItems || [];
  const products = db.Products || [];
  const customers = db.Customers || [];
  const expenses = db.Expenses || [];

  const todayStr = getLocalDateString();
  
  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM

  // Sales Today
  const salesToday = invoices
    .filter(inv => inv["Invoice Date"] === todayStr)
    .reduce((sum, inv) => sum + (parseFloat(inv["Total Amount"]) || 0), 0);

  // Sales This Month
  const monthlyInvoices = invoices.filter(inv => inv["Invoice Date"] && inv["Invoice Date"].startsWith(currentMonthPrefix));
  const salesThisMonth = monthlyInvoices.reduce((sum, inv) => sum + (parseFloat(inv["Total Amount"]) || 0), 0);

  // Gross Profit & Net Profit for the Month
  const monthlyInvoiceNumbers = new Set(monthlyInvoices.map(inv => inv["Invoice Number"]));
  let grossProfitMonth = 0;
  items.forEach(item => {
    if (monthlyInvoiceNumbers.has(item["Invoice Number"])) {
      const sell = parseFloat(item["Selling Price"]) || 0;
      const cost = parseFloat(item["Purchase Price"]) || 0;
      const qty = parseFloat(item["Quantity"]) || 0;
      grossProfitMonth += (sell - cost) * qty;
    }
  });

  // Expenses This Month
  const expensesThisMonth = expenses
    .filter(exp => exp["Date"] && exp["Date"].startsWith(currentMonthPrefix))
    .reduce((sum, exp) => sum + (parseFloat(exp["Amount"]) || 0), 0);

  // Net Profit
  const netProfitMonth = grossProfitMonth - expensesThisMonth;

  // Outstanding Debts
  const outstandingDebts = invoices.reduce((sum, inv) => sum + (parseFloat(inv["Remaining Amount"]) || 0), 0);

  // General counters
  const activeProducts = products.filter(p => (p["Status"] || "Active") !== "Archived");
  const activeCustomers = customers.filter(c => (c["Status"] || "Active") !== "Archived" && c["Customer ID"] !== "GENERIC");

  // Stock status counts
  let lowStockCount = 0;
  let outOfStockCount = 0;
  activeProducts.forEach(p => {
    const qty = parseFloat(p["Current Quantity"]) || 0;
    const minAlert = parseFloat(p["Minimum Quantity Alert"]) || 0;
    if (qty === 0) {
      outOfStockCount++;
    } else if (qty <= minAlert) {
      lowStockCount++;
    }
  });

  // Update Metric DOM Cards
  document.getElementById("stat-sales-today").textContent = formatCurrency(salesToday);
  document.getElementById("stat-sales-month").textContent = formatCurrency(salesThisMonth);
  
  const profitEl = document.getElementById("stat-net-profit");
  profitEl.textContent = formatCurrency(netProfitMonth);
  if (netProfitMonth < 0) {
    profitEl.className = "text-xl font-bold text-rose-600 font-display mt-0.5 font-mono";
  } else {
    profitEl.className = "text-xl font-bold text-slate-900 font-display mt-0.5 font-mono";
  }

  document.getElementById("stat-debts").textContent = formatCurrency(outstandingDebts);
  document.getElementById("stat-cust-count").textContent = activeCustomers.length;
  document.getElementById("stat-prod-count").textContent = activeProducts.length;
  document.getElementById("stat-low-stock-count").textContent = lowStockCount;
  document.getElementById("stat-out-stock-count").textContent = outOfStockCount;
  document.getElementById("stat-expenses-month").textContent = formatCurrency(expensesThisMonth);

  // Localized date header
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const formattedToday = new Date().toLocaleDateString('ar-EG', options);
  document.getElementById("dashboard-date-label").textContent = `اليوم: ${formattedToday}`;

  // Build Charts
  buildDailySalesTimelineChart(invoices);
  buildPaymentMethodsChart(invoices);

  // Render Table: Top Selling Products
  renderTopSellersTable(items);

  // Render List: Critical Stock Warnings
  renderCriticalStockList(activeProducts);
};

/**
 * Renders sales curves for the last 7 days
 */
function buildDailySalesTimelineChart(invoices) {
  const canvas = document.getElementById("dailySalesChart");
  if (!canvas) return;

  const labels = [];
  const salesMap = {};

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const displayLabel = d.toLocaleDateString("ar-EG", { weekday: "short", month: "numeric", day: "numeric" });
    labels.push(displayLabel);
    salesMap[dateStr] = 0;
  }

  invoices.forEach(inv => {
    const date = inv["Invoice Date"];
    if (salesMap[date] !== undefined) {
      salesMap[date] += parseFloat(inv["Total Amount"]) || 0;
    }
  });

  const datasetValues = Object.keys(salesMap).map(k => salesMap[k]);

  if (window.dailySalesChartInstance) {
    window.dailySalesChartInstance.destroy();
  }

  const ctx = canvas.getContext("2d");
  window.dailySalesChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "المبيعات (جنيه)",
        data: datasetValues,
        borderColor: "#4f46e5",
        backgroundColor: "rgba(79, 70, 229, 0.05)",
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointBackgroundColor: "#4f46e5",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          grid: { color: "#f1f5f9" },
          ticks: { font: { size: 10, family: "Inter" }, color: "#64748b" }
        },
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 }, color: "#64748b" }
        }
      }
    }
  });
}

/**
 * Renders doughnut distribution of payment channels - Translated
 */
function buildPaymentMethodsChart(invoices) {
  const canvas = document.getElementById("paymentMethodsChart");
  const legendContainer = document.getElementById("payment-methods-legend");
  if (!canvas || !legendContainer) return;

  const paymentMethods = ["Cash", "Vodafone Cash", "InstaPay", "Bank Transfer"];
  const paymentMethodsAr = {
    "Cash": "نقدي (كاش)",
    "Vodafone Cash": "فودافون كاش",
    "InstaPay": "إنستاباي",
    "Bank Transfer": "تحويل بنكي"
  };

  const volumes = { "Cash": 0, "Vodafone Cash": 0, "InstaPay": 0, "Bank Transfer": 0 };

  invoices.forEach(inv => {
    const method = inv["Payment Method"];
    if (volumes[method] !== undefined) {
      volumes[method] += parseFloat(inv["Total Amount"]) || 0;
    }
  });

  const totalVolume = Object.values(volumes).reduce((a, b) => a + b, 0);

  const colors = ["#4f46e5", "#10b981", "#f59e0b", "#8b5cf6"];
  const datasetValues = paymentMethods.map(m => volumes[m]);

  if (window.paymentMethodsChartInstance) {
    window.paymentMethodsChartInstance.destroy();
  }

  const ctx = canvas.getContext("2d");
  window.paymentMethodsChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: paymentMethods.map(m => paymentMethodsAr[m]),
      datasets: [{
        data: datasetValues,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: "#ffffff"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      cutout: "75%"
    }
  });

  legendContainer.innerHTML = paymentMethods.map((method, index) => {
    const vol = volumes[method];
    const pct = totalVolume > 0 ? Math.round((vol / totalVolume) * 100) : 0;
    
    return `
      <div class="flex items-center justify-between text-xs text-slate-600" dir="rtl">
        <div class="flex items-center space-x-reverse space-x-2">
          <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${colors[index]}"></span>
          <span class="font-medium">${paymentMethodsAr[method]}</span>
        </div>
        <span class="font-bold text-slate-800 font-mono">${formatCurrency(vol)} (${pct}%)</span>
      </div>
    `;
  }).join("");
}

/**
 * Process Best Selling products table
 */
function renderTopSellersTable(items) {
  const tbody = document.getElementById("top-selling-table-body");
  if (!tbody) return;

  const salesMap = {};

  items.forEach(item => {
    const pId = item["Product ID"];
    const pName = item["Product Name"];
    const qty = parseFloat(item["Quantity"]) || 0;
    const rev = parseFloat(item["Total Price"]) || 0;

    if (!salesMap[pId]) {
      salesMap[pId] = { name: pName, qty: 0, revenue: 0 };
    }
    salesMap[pId].qty += qty;
    salesMap[pId].revenue += rev;
  });

  const topSellers = Object.entries(salesMap)
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 5);

  if (topSellers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="py-4 text-center text-xs text-slate-400 font-medium">لا توجد مبيعات مسجلة في هذه الفترة.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = topSellers.map(([id, val]) => {
    return `
      <tr class="hover:bg-slate-50 text-xs border-b border-slate-50">
        <td class="py-2.5 pr-4 font-semibold text-slate-800 text-right">${val.name}</td>
        <td class="py-2.5 text-left font-bold text-slate-700 font-mono pl-4">${val.qty} وحدة</td>
        <td class="py-2.5 text-left font-bold text-slate-900 font-mono pl-4">${formatCurrency(val.revenue)}</td>
      </tr>
    `;
  }).join("");
}

/**
 * Renders low/out of stock items list
 */
function renderCriticalStockList(activeProducts) {
  const list = document.getElementById("critical-stock-alerts-list");
  if (!list) return;

  const alerts = activeProducts.filter(p => {
    const qty = parseFloat(p["Current Quantity"]) || 0;
    const minAlert = parseFloat(p["Minimum Quantity Alert"]) || 0;
    return qty <= minAlert;
  });

  alerts.sort((a, b) => (parseFloat(a["Current Quantity"]) || 0) - (parseFloat(b["Current Quantity"]) || 0));

  if (alerts.length === 0) {
    list.innerHTML = `
      <li class="py-4 text-center text-xs text-slate-400 font-medium">
        جميع مستويات المخزون ممتازة وبحالة ممتازة!
      </li>
    `;
    return;
  }

  list.innerHTML = alerts.map(p => {
    const qty = parseFloat(p["Current Quantity"]) || 0;
    
    let textClass, badgeClass, alertText;
    if (qty === 0) {
      textClass = "text-rose-900";
      badgeClass = "bg-rose-100 text-rose-700";
      alertText = "نفد من المخزن";
    } else {
      textClass = "text-amber-900";
      badgeClass = "bg-amber-100 text-amber-700";
      alertText = `منخفض: متبقي ${qty}`;
    }

    return `
      <li class="py-3 flex items-center justify-between" dir="rtl">
        <div class="text-right">
          <h5 class="text-xs font-bold text-slate-800">${p["Product Name"]}</h5>
          <span class="text-[9px] font-mono text-slate-400 bg-slate-100 px-1 py-0.5 rounded">${p["Product ID"]}</span>
        </div>
        <div class="text-left font-mono">
          <span class="inline-block px-2.5 py-0.5 rounded text-[9px] font-bold ${badgeClass}">
            ${alertText}
          </span>
          <p class="text-[10px] text-slate-400 mt-1">حد الأمان: ${p["Minimum Quantity Alert"]}</p>
        </div>
      </li>
    `;
  }).join("");
}
