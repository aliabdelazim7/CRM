/**
 * Reports & Business Analytics Module - Localized to Arabic
 * Generates custom reports: Sales, Inventory valuation, Debts, Expenses, and P&L statements.
 * Supports date range presets and CSV exports.
 */

document.addEventListener("DOMContentLoaded", () => {
  const presetSelect = document.getElementById("report-preset-select");
  if (presetSelect) {
    presetSelect.addEventListener("change", handleReportPresetChange);
    handleReportPresetChange();
  }

  document.getElementById("report-generate-btn")?.addEventListener("click", generateActiveReport);
  document.getElementById("report-download-btn")?.addEventListener("click", exportActiveReportToCSV);
});

/**
 * Main Reports Screen Entry
 */
window.renderReports = function() {
  const container = document.getElementById("report-display-container");
  if (container) {
    container.innerHTML = `
      <div class="h-64 flex flex-col items-center justify-center text-center text-slate-400 space-y-2" dir="rtl">
        <i data-lucide="file-text" class="w-10 h-10 text-slate-300"></i>
        <p class="text-sm font-semibold">لم يتم استعراض تقرير بعد.</p>
        <p class="text-xs">اختر نوع التقرير والفترة الزمنية من الأعلى ثم انقر على زر "عرض التقرير".</p>
      </div>
    `;
    lucide.createIcons();
  }
};

/**
 * Triggers date inputs enabling/disabling based on preset selection
 */
function handleReportPresetChange() {
  const preset = document.getElementById("report-preset-select").value;
  const startInput = document.getElementById("report-start-date");
  const endInput = document.getElementById("report-end-date");
  
  if (!startInput || !endInput) return;

  const today = new Date();
  let start = new Date();
  let end = new Date();

  startInput.disabled = true;
  endInput.disabled = true;

  switch (preset) {
    case "today":
      break;
    case "seven_days":
      start.setDate(today.getDate() - 7);
      break;
    case "this_month":
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case "last_month":
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    case "custom":
      startInput.disabled = false;
      endInput.disabled = false;
      return;
  }

  startInput.value = getLocalDateString(start);
  endInput.value = getLocalDateString(end);
}

/**
 * Route generator to appropriate calculator
 */
function generateActiveReport() {
  const reportType = document.getElementById("report-type-select").value;
  const startDate = document.getElementById("report-start-date").value;
  const endDate = document.getElementById("report-end-date").value;

  if (!startDate || !endDate) {
    showToast("برجاء تحديد تواريخ البداية والنهاية أولاً.", "warning");
    return;
  }

  const container = document.getElementById("report-display-container");
  if (!container) return;

  showLoader("جاري استخراج البيانات وبناء التقرير...");
  
  setTimeout(() => {
    try {
      let html = "";
      switch (reportType) {
        case "sales":
          html = buildSalesReport(startDate, endDate);
          break;
        case "inventory":
          html = buildInventoryReport();
          break;
        case "debts":
          html = buildDebtsReport();
          break;
        case "expenses":
          html = buildExpensesReport(startDate, endDate);
          break;
        case "profit":
          html = buildProfitReport(startDate, endDate);
          break;
      }
      container.innerHTML = html;
      lucide.createIcons();
    } catch (e) {
      console.error(e);
      showToast(`فشل توليد التقرير: ${e.message}`, "error");
    } finally {
      hideLoader();
    }
  }, 100);
}

function isDateInRange(targetDate, start, end) {
  if (!targetDate) return false;
  const target = String(targetDate).substring(0, 10);
  return target >= start && target <= end;
}

// ==================== REPORTS CALCULATORS ====================

/**
 * 1. Sales & POS Report
 */
function buildSalesReport(start, end) {
  const invoices = window.appState.db.Invoices || [];
  const filtered = invoices.filter(inv => isDateInRange(inv["Invoice Date"], start, end));
  
  let totalAmount = 0;
  let totalDiscounts = 0;
  let totalNet = 0;
  let totalPaid = 0;
  let totalDue = 0;

  const rows = filtered.map(inv => {
    const total = parseFloat(inv["Total Amount"]) || 0;
    const discount = parseFloat(inv["Discount"]) || 0;
    const net = total - discount;
    const paid = parseFloat(inv["Paid Amount"]) || 0;
    const due = parseFloat(inv["Remaining Amount"]) || 0;

    totalAmount += total;
    totalDiscounts += discount;
    totalNet += net;
    totalPaid += paid;
    totalDue += due;

    // Status translation
    let statusAr = "مدفوع بالكامل";
    if (inv["Status"] === "Partially Paid") statusAr = "مدفوع جزئياً";
    else if (inv["Status"] === "Unpaid") statusAr = "غير مدفوع";

    // Payment Method translation
    let methodAr = inv["Payment Method"];
    if (methodAr === "Cash") methodAr = "نقدي";
    else if (methodAr === "Vodafone Cash") methodAr = "فودافون كاش";
    else if (methodAr === "InstaPay") methodAr = "إنستاباي";
    else if (methodAr === "Bank Transfer") methodAr = "تحويل بنكي";

    return `
      <tr class="border-b border-slate-100 text-xs hover:bg-slate-50">
        <td class="py-2.5 px-4 font-mono font-bold text-indigo-600 hover:underline cursor-pointer text-right" onclick="printInvoiceFromHistory('${inv["Invoice Number"]}')">${escapeHtml(inv["Invoice Number"])}</td>
        <td class="py-2.5 px-4 font-mono text-right">${escapeHtml(inv["Invoice Date"])}</td>
        <td class="py-2.5 px-4 font-semibold text-slate-800 text-right">${escapeHtml(inv["Customer Name"])}</td>
        <td class="py-2.5 px-4 text-slate-600 text-right">${methodAr}</td>
        <td class="py-2.5 px-4 text-center">
          <span class="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold ${inv["Status"] === "Paid" ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}">${statusAr}</span>
        </td>
        <td class="py-2.5 px-4 text-left font-mono">${formatCurrency(total)}</td>
        <td class="py-2.5 px-4 text-left font-mono text-amber-600">${formatCurrency(discount)}</td>
        <td class="py-2.5 px-4 text-left font-mono font-semibold">${formatCurrency(net)}</td>
        <td class="py-2.5 px-4 text-left font-mono">${formatCurrency(paid)}</td>
        <td class="py-2.5 px-4 text-left font-mono text-rose-600 font-bold">${formatCurrency(due)}</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="space-y-4" dir="rtl">
      <div class="flex justify-between items-center border-b border-slate-100 pb-3">
        <h3 class="font-bold text-sm text-slate-800 font-display">تقرير مبيعات فواتير المتجر</h3>
        <span class="text-xs text-slate-400 font-mono">الفترة: من ${start} إلى ${end}</span>
      </div>
      <div class="responsive-table-container">
        <table class="w-full text-right border-collapse custom-table">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200">
              <th class="py-2.5 px-4 text-right">رقم الفاتورة</th>
              <th class="py-2.5 px-4 text-right">التاريخ</th>
              <th class="py-2.5 px-4 text-right">العميل</th>
              <th class="py-2.5 px-4 text-right">طريقة الدفع</th>
              <th class="py-2.5 px-4 text-center">الحالة</th>
              <th class="py-2.5 px-4 text-left pl-4">الإجمالي قبل الخصم</th>
              <th class="py-2.5 px-4 text-left pl-4 text-amber-600">الخصم</th>
              <th class="py-2.5 px-4 text-left pl-4 font-semibold">الصافي</th>
              <th class="py-2.5 px-4 text-left pl-4">المدفوع</th>
              <th class="py-2.5 px-4 text-left pl-4 text-rose-600">المتبقي (آجل)</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="10" class="text-center py-6 text-slate-400 font-bold">لا توجد أي مبيعات مسجلة في هذا النطاق الزمني.</td></tr>`}
          </tbody>
          <tfoot class="bg-slate-50 border-t border-slate-300 font-bold font-mono">
            <tr class="text-xs text-slate-900">
              <td colspan="5" class="py-3 px-4 text-right">الإجمالي العام:</td>
              <td class="py-3 px-4 text-left">${formatCurrency(totalAmount)}</td>
              <td class="py-3 px-4 text-left text-amber-600">${formatCurrency(totalDiscounts)}</td>
              <td class="py-3 px-4 text-left font-semibold">${formatCurrency(totalNet)}</td>
              <td class="py-3 px-4 text-left">${formatCurrency(totalPaid)}</td>
              <td class="py-3 px-4 text-left text-rose-600">${formatCurrency(totalDue)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;
}

/**
 * 2. Inventory & Valuation Report
 */
function buildInventoryReport() {
  const products = window.appState.db.Products || [];
  const activeProds = products.filter(p => (p["Status"] || "Active") !== "Archived");

  let totalQty = 0;
  let totalCostVal = 0;
  let totalRetailVal = 0;

  const rows = activeProds.map(p => {
    const qty = parseFloat(p["Current Quantity"]) || 0;
    const cost = parseFloat(p["Purchase Price"]) || 0;
    const sell = parseFloat(p["Selling Price"]) || 0;

    const costVal = qty * cost;
    const retailVal = qty * sell;

    totalQty += qty;
    totalCostVal += costVal;
    totalRetailVal += retailVal;

    return `
      <tr class="border-b border-slate-100 text-xs hover:bg-slate-50">
        <td class="py-2.5 px-4 font-mono text-slate-500 font-semibold text-right">${escapeHtml(p["Product ID"])}</td>
        <td class="py-2.5 px-4 font-bold text-slate-800 text-right">${escapeHtml(p["Product Name"])}</td>
        <td class="py-2.5 px-4 text-slate-500 text-right">${escapeHtml(p["Category"])}</td>
        <td class="py-2.5 px-4 text-center font-mono">${qty}</td>
        <td class="py-2.5 px-4 text-left font-mono">${formatCurrency(cost)}</td>
        <td class="py-2.5 px-4 text-left font-mono">${formatCurrency(sell)}</td>
        <td class="py-2.5 px-4 text-left font-mono font-semibold">${formatCurrency(costVal)}</td>
        <td class="py-2.5 px-4 text-left font-mono font-bold text-indigo-600">${formatCurrency(retailVal)}</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="space-y-4" dir="rtl">
      <div class="flex justify-between items-center border-b border-slate-100 pb-3">
        <h3 class="font-bold text-sm text-slate-800 font-display">تقرير جرد المخازن وتقييم الأصول المتاحة</h3>
        <span class="text-xs text-slate-400 font-mono">القيم تعتمد على الأرصدة الحالية في الأرفف</span>
      </div>
      <div class="responsive-table-container">
        <table class="w-full text-right border-collapse custom-table">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200">
              <th class="py-2.5 px-4 text-right">كود المنتج</th>
              <th class="py-2.5 px-4 text-right">اسم البند</th>
              <th class="py-2.5 px-4 text-right">القسم</th>
              <th class="py-2.5 px-4 text-center">الكمية</th>
              <th class="py-2.5 px-4 text-left pl-4">سعر التكلفة</th>
              <th class="py-2.5 px-4 text-left pl-4">سعر البيع</th>
              <th class="py-2.5 px-4 text-left pl-4">قيمة المخزون (تكلفة)</th>
              <th class="py-2.5 px-4 text-left pl-4">قيمة المخزون (بيع)</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="8" class="text-center py-6 text-slate-400 font-bold">المخزن فارغ حالياً ولا توجد منتجات مسجلة.</td></tr>`}
          </tbody>
          <tfoot class="bg-slate-50 border-t border-slate-300 font-bold font-mono">
            <tr class="text-xs text-slate-900">
              <td colspan="3" class="py-3 px-4 text-right">إجمالي التقييم:</td>
              <td class="py-3 px-4 text-center">${totalQty}</td>
              <td colspan="2" class="py-3 px-4"></td>
              <td class="py-3 px-4 text-left">${formatCurrency(totalCostVal)}</td>
              <td class="py-3 px-4 text-left text-indigo-600">${formatCurrency(totalRetailVal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;
}

/**
 * 3. Outstanding Balances CRM Report
 */
function buildDebtsReport() {
  const customers = window.appState.db.Customers || [];
  const debtors = customers.filter(c => (c["Status"] || "Active") !== "Archived" && (parseFloat(c["Outstanding Balance"]) || 0) > 0);

  let totalDebt = 0;
  let totalPurchases = 0;

  const rows = debtors.map(c => {
    const purchases = parseFloat(c["Total Purchases"]) || 0;
    const balance = parseFloat(c["Outstanding Balance"]) || 0;

    totalDebt += balance;
    totalPurchases += purchases;

    return `
      <tr class="border-b border-slate-100 text-xs hover:bg-slate-50">
        <td class="py-2.5 px-4 font-mono text-slate-500 text-right">${escapeHtml(c["Customer ID"])}</td>
        <td class="py-2.5 px-4 font-bold text-slate-800 hover:underline cursor-pointer text-right" onclick="openCustomerDrawer('${escapeHtml(c["Customer ID"])}')">${escapeHtml(c["Name"])}</td>
        <td class="py-2.5 px-4 font-mono text-slate-600 text-right">${escapeHtml(c["Phone Number"])}</td>
        <td class="py-2.5 px-4 text-slate-500 text-right">${escapeHtml(c["Address"] || "-")}</td>
        <td class="py-2.5 px-4 text-left font-mono">${formatCurrency(purchases)}</td>
        <td class="py-2.5 px-4 text-left font-mono text-rose-600 font-bold">${formatCurrency(balance)}</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="space-y-4" dir="rtl">
      <div class="flex justify-between items-center border-b border-slate-100 pb-3">
        <h3 class="font-bold text-sm text-slate-800 font-display">تقرير مديونيات وحسابات العملاء الآجلة</h3>
        <span class="text-xs text-rose-500 font-bold uppercase">قائمة ديون العملاء النشطة</span>
      </div>
      <div class="responsive-table-container">
        <table class="w-full text-right border-collapse custom-table">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200">
              <th class="py-2.5 px-4 text-right">كود العميل</th>
              <th class="py-2.5 px-4 text-right">اسم العميل</th>
              <th class="py-2.5 px-4 text-right">رقم الهاتف</th>
              <th class="py-2.5 px-4 text-right">العنوان</th>
              <th class="py-2.5 px-4 text-left pl-4">إجمالي مسحوباته</th>
              <th class="py-2.5 px-4 text-left pl-4 text-rose-600">المديونية الحالية</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="6" class="text-center py-6 text-slate-400 font-bold">لا يوجد مديونيات مستحقة على أي من العملاء حالياً. كروت الحسابات ممتازة!</td></tr>`}
          </tbody>
          <tfoot class="bg-slate-50 border-t border-slate-300 font-bold font-mono">
            <tr class="text-xs text-slate-900">
              <td colspan="4" class="py-3 px-4 text-right">الإجماليات:</td>
              <td class="py-3 px-4 text-left">${formatCurrency(totalPurchases)}</td>
              <td class="py-3 px-4 text-left text-rose-600">${formatCurrency(totalDebt)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;
}

/**
 * 4. Expense Breakdown Report
 */
function buildExpensesReport(start, end) {
  const expenses = window.appState.db.Expenses || [];
  const filtered = expenses.filter(exp => isDateInRange(exp["Date"], start, end));

  let totalExpenses = 0;

  const rows = filtered.map(exp => {
    const amt = parseFloat(exp["Amount"]) || 0;
    totalExpenses += amt;

    // Category translation
    let catAr = exp["Category"];
    if (catAr === "Rent") catAr = "إيجار";
    else if (catAr === "Salaries") catAr = "رواتب";
    else if (catAr === "Electricity") catAr = "كهرباء";
    else if (catAr === "Internet") catAr = "إنترنت";
    else if (catAr === "Marketing") catAr = "تسويق";
    else if (catAr === "Transportation") catAr = "نقل وانتقالات";
    else if (catAr === "Other") catAr = "أخرى";

    return `
      <tr class="border-b border-slate-100 text-xs hover:bg-slate-50">
        <td class="py-2.5 px-4 font-mono font-semibold text-slate-500 text-right">${escapeHtml(exp["Date"])}</td>
        <td class="py-2.5 px-4 font-mono text-slate-400 text-right">${escapeHtml(exp["Expense ID"])}</td>
        <td class="py-2.5 px-4 text-right"><span class="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-700">${escapeHtml(catAr)}</span></td>
        <td class="py-2.5 px-4 text-slate-600 text-right">${escapeHtml(exp["Notes"])}</td>
        <td class="py-2.5 px-4 text-left font-mono font-bold text-slate-900">${formatCurrency(amt)}</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="space-y-4" dir="rtl">
      <div class="flex justify-between items-center border-b border-slate-100 pb-3">
        <h3 class="font-bold text-sm text-slate-800 font-display">تقرير مصروفات التشغيل والمصروفات النثرية</h3>
        <span class="text-xs text-slate-400 font-mono">الفترة: من ${start} إلى ${end}</span>
      </div>
      <div class="responsive-table-container">
        <table class="w-full text-right border-collapse custom-table">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200">
              <th class="py-2.5 px-4 text-right">التاريخ</th>
              <th class="py-2.5 px-4 text-right">كود المصروف</th>
              <th class="py-2.5 px-4 text-right">التصنيف</th>
              <th class="py-2.5 px-4 text-right">البيان / ملاحظات</th>
              <th class="py-2.5 px-4 text-left pl-4">القيمة المالية</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="5" class="text-center py-6 text-slate-400 font-bold font-sans">لم يتم تسجيل أي مصروفات في هذا النطاق الزمني.</td></tr>`}
          </tbody>
          <tfoot class="bg-slate-50 border-t border-slate-300 font-bold font-mono">
            <tr class="text-xs text-slate-900">
              <td colspan="4" class="py-3 px-4 text-right">إجمالي المصروفات:</td>
              <td class="py-3 px-4 text-left text-rose-600">${formatCurrency(totalExpenses)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;
}

/**
 * 5. Profit & Loss Report (P&L)
 */
function buildProfitReport(start, end) {
  const db = window.appState.db;
  const invoices = db.Invoices || [];
  const items = db.InvoiceItems || [];
  const expenses = db.Expenses || [];

  const rangeInvoices = invoices.filter(i => isDateInRange(i["Invoice Date"], start, end));
  const totalRevenue = rangeInvoices.reduce((sum, inv) => sum + (parseFloat(inv["Total Amount"]) || 0), 0);
  const totalDiscounts = rangeInvoices.reduce((sum, inv) => sum + (parseFloat(inv["Discount"]) || 0), 0);
  const netRevenue = totalRevenue - totalDiscounts;

  const rangeInvoiceIds = new Set(rangeInvoices.map(i => i["Invoice Number"]));
  let totalCogs = 0;
  items.forEach(item => {
    if (rangeInvoiceIds.has(item["Invoice Number"])) {
      const qty = parseFloat(item["Quantity"]) || 0;
      const cost = parseFloat(item["Purchase Price"]) || 0;
      totalCogs += qty * cost;
    }
  });

  const grossProfit = netRevenue - totalCogs;

  const rangeExpenses = expenses.filter(e => isDateInRange(e["Date"], start, end));
  
  const expensesByCategory = {};
  let totalExpenses = 0;
  rangeExpenses.forEach(e => {
    const amt = parseFloat(e["Amount"]) || 0;
    const cat = e["Category"] || "Other";
    expensesByCategory[cat] = (expensesByCategory[cat] || 0) + amt;
    totalExpenses += amt;
  });

  const netProfit = grossProfit - totalExpenses;

  // Translate P&L operational items
  const catNamesAr = {
    "Rent": "إيجار المحلات والفروع",
    "Salaries": "رواتب ومستحقات الموظفين",
    "Electricity": "فاتورة الكهرباء والإنارة",
    "Internet": "فاتورة الإنترنت والاتصالات",
    "Marketing": "الحملات الإعلانية والتسويق",
    "Transportation": "مصاريف النقل واللوجستيات",
    "Other": "مصروفات تشغيلية أخرى"
  };

  return `
    <div class="space-y-6 max-w-xl mx-auto" dir="rtl">
      <div class="text-center border-b border-slate-100 pb-4">
        <h3 class="font-bold text-base text-slate-800 font-display">قائمة الأرباح والخسائر الإجمالية (P&L)</h3>
        <p class="text-xs text-slate-400 font-mono mt-1">الفترة الزمنية: من ${start} إلى ${end}</p>
      </div>

      <div class="space-y-4 text-xs font-sans">
        
        <!-- Revenue / Sales -->
        <div class="border-b border-slate-100 pb-2">
          <div class="flex justify-between items-center text-slate-800 font-bold text-sm">
            <span>إجمالي الإيرادات التشغيلية (المبيعات الإجمالية)</span>
            <span class="font-mono text-emerald-600 font-bold text-sm">+${formatCurrency(totalRevenue)}</span>
          </div>
        </div>

        <!-- Discounts -->
        <div class="border-b border-slate-100 pb-2">
          <div class="flex justify-between items-center text-slate-800 font-semibold">
            <span>إجمالي الخصومات الممنوحة للعملاء</span>
            <span class="font-mono text-rose-500 font-semibold">-${formatCurrency(totalDiscounts)}</span>
          </div>
        </div>

        <!-- Net Revenue -->
        <div class="border-b border-slate-100 pb-2">
          <div class="flex justify-between items-center text-slate-900 font-bold">
            <span>صافي المبيعات (Net Revenue)</span>
            <span class="font-mono text-emerald-600 font-bold">${formatCurrency(netRevenue)}</span>
          </div>
        </div>

        <!-- COGS -->
        <div class="border-b border-slate-100 pb-2">
          <div class="flex justify-between items-center text-slate-800 font-semibold">
            <span>تكلفة البضائع المباعة (COGS)</span>
            <span class="font-mono text-rose-500 font-semibold">-${formatCurrency(totalCogs)}</span>
          </div>
          <p class="text-[9px] text-slate-400 mt-1">المعادلة: مجموع (أسعار شراء المنتجات المباعة في الفواتير * الكمية المباعة)</p>
        </div>

        <!-- Gross Profit -->
        <div class="bg-slate-50 rounded-xl p-4 border border-slate-150 flex justify-between items-center font-bold text-slate-900 text-sm">
          <span>مجمل الربح التجاري (Gross Profit)</span>
          <span class="font-mono text-emerald-600 font-bold text-sm">${formatCurrency(grossProfit)}</span>
        </div>

        <!-- Operating Expenses Category List -->
        <div class="space-y-2.5 pt-2">
          <div class="font-bold text-slate-700 text-xs uppercase tracking-wider text-right">خصم مصروفات التشغيل</div>
          
          <div class="pr-4 space-y-2 border-r border-slate-200">
            ${Object.keys(expensesByCategory).map(cat => `
              <div class="flex justify-between text-xs text-slate-600">
                <span>${escapeHtml(catNamesAr[cat] || cat)}</span>
                <span class="font-mono font-medium">-${formatCurrency(expensesByCategory[cat])}</span>
              </div>
            `).join("") || `<div class="text-slate-400 text-xs italic pr-2">لم تسجل أي مصروفات تشغيلية في هذه الفترة.</div>`}
          </div>

          <div class="flex justify-between text-xs font-bold text-slate-700 pt-2 border-t border-slate-100">
            <span>إجمالي المصروفات التشغيلية</span>
            <span class="font-mono text-rose-500 font-bold">-${formatCurrency(totalExpenses)}</span>
          </div>
        </div>

        <!-- Net Profit Summary -->
        <div class="rounded-xl p-5 border flex justify-between items-center font-bold text-sm mt-6 ${netProfit >= 0 ? 'bg-emerald-50/50 border-emerald-200 text-emerald-700' : 'bg-rose-50/50 border-rose-200 text-rose-700'}">
          <div class="text-right">
            <span class="block text-xs font-bold uppercase ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}">صافي الربح (أو الخسارة) النهائي</span>
            <span class="text-[10px] font-normal text-slate-400 normal-case mt-0.5">المعادلة: مجمل الربح - إجمالي المصروفات</span>
          </div>
          <span class="font-display text-lg font-extrabold font-mono">
            ${netProfit >= 0 ? '+' : ''}${formatCurrency(netProfit)}
          </span>
        </div>

      </div>
    </div>
  `;
}

// ==================== CSV EXPORT LOGIC ====================

function exportActiveReportToCSV() {
  const container = document.getElementById("report-display-container");
  const table = container?.querySelector("table");
  
  if (!table) {
    const pnlBlock = container?.querySelector(".max-w-xl");
    if (pnlBlock) {
      exportProfitAndLossToCSV();
      return;
    }
    showToast("برجاء توليد التقرير المالي أولاً لتصديره.", "warning");
    return;
  }

  const csvRows = [];
  csvRows.push("\ufeff"); // Excel Arabic UTF-8 BOM
  const rows = table.querySelectorAll("tr");

  rows.forEach(tr => {
    const row = [];
    const cols = tr.querySelectorAll("th, td");
    
    cols.forEach(col => {
      let text = col.innerText.trim();
      text = text.replace(/"/g, '""');
      
      if (text.includes(",") || text.includes("\n") || text.includes('"')) {
        row.push(`"${text}"`);
      } else {
        row.push(text);
      }
    });

    csvRows.push(row.join(","));
  });

  const reportType = document.getElementById("report-type-select").value;
  const start = document.getElementById("report-start-date").value;
  const end = document.getElementById("report-end-date").value;

  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `تقرير_${reportType}_من_${start}_إلى_${end}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exports Profit & Loss report block custom layout into CSV structure
 */
function exportProfitAndLossToCSV() {
  const start = document.getElementById("report-start-date").value;
  const end = document.getElementById("report-end-date").value;

  const db = window.appState.db;
  const invoices = db.Invoices || [];
  const items = db.InvoiceItems || [];
  const expenses = db.Expenses || [];

  const rangeInvoices = invoices.filter(i => isDateInRange(i["Invoice Date"], start, end));
  const totalRevenue = rangeInvoices.reduce((sum, inv) => sum + (parseFloat(inv["Total Amount"]) || 0), 0);
  const totalDiscounts = rangeInvoices.reduce((sum, inv) => sum + (parseFloat(inv["Discount"]) || 0), 0);
  const netRevenue = totalRevenue - totalDiscounts;

  const rangeInvoiceIds = new Set(rangeInvoices.map(i => i["Invoice Number"]));
  let totalCogs = 0;
  items.forEach(item => {
    if (rangeInvoiceIds.has(item["Invoice Number"])) {
      const qty = parseFloat(item["Quantity"]) || 0;
      const cost = parseFloat(item["Purchase Price"]) || 0;
      totalCogs += qty * cost;
    }
  });

  const grossProfit = netRevenue - totalCogs;

  const rangeExpenses = expenses.filter(e => isDateInRange(e["Date"], start, end));
  const expensesByCategory = {};
  let totalExpenses = 0;
  rangeExpenses.forEach(e => {
    const amt = parseFloat(e["Amount"]) || 0;
    const cat = e["Category"] || "Other";
    expensesByCategory[cat] = (expensesByCategory[cat] || 0) + amt;
    totalExpenses += amt;
  });

  const netProfit = grossProfit - totalExpenses;

  const catNamesAr = {
    "Rent": "إيجار المحلات والفروع",
    "Salaries": "رواتب ومستحقات الموظفين",
    "Electricity": "فاتورة الكهرباء والإنارة",
    "Internet": "فاتورة الإنترنت والاتصالات",
    "Marketing": "الحملات الإعلانية والتسويق",
    "Transportation": "مصاريف النقل واللوجستيات",
    "Other": "مصروفات تشغيلية أخرى"
  };

  const csvRows = [
    `\ufeffقائمة الأرباح والخسائر الإجمالية (P&L),,`,
    `الفترة الزمنية:,من ${start} إلى ${end},`,
    `,,`,
    `البند,القيمة المالية (جنيه),النسبة`,
    `إجمالي الإيرادات التشغيلية (المبيعات الإجمالية),${totalRevenue},`,
    `إجمالي الخصومات الممنوحة,-${totalDiscounts},`,
    `صافي المبيعات (Net Revenue),${netRevenue},`,
    `تكلفة البضائع المباعة (COGS),-${totalCogs},`,
    `مجمل الربح التجاري (Gross Profit),${grossProfit},`,
    `,,`,
    `المصروفات التشغيلية المخصومة,,`,
  ];

  Object.keys(expensesByCategory).forEach(cat => {
    const val = expensesByCategory[cat];
    const pct = totalExpenses > 0 ? Math.round((val / totalExpenses) * 100) : 0;
    csvRows.push(`${catNamesAr[cat] || cat},-${val},${pct}%`);
  });

  csvRows.push(`إجمالي المصروفات التشغيلية,-${totalExpenses},`);
  csvRows.push(`,,`);
  csvRows.push(`صافي الأرباح والخسائر النهائي,${netProfit},`);

  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `بيان_الأرباح_والخسائر_من_${start}_إلى_${end}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
