/**
 * Expenses Module - Localized to Arabic
 * Handles recording and analyzing store operational expenses (rent, salaries, utilities)
 */

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("expense-form")?.addEventListener("submit", handleExpenseFormSubmit);

  document.getElementById("exp-add-new-btn")?.addEventListener("click", openExpenseModal);
  document.getElementById("expense-modal-close")?.addEventListener("click", closeExpenseModal);
  document.getElementById("exp-form-cancel")?.addEventListener("click", closeExpenseModal);

  const monthFilter = document.getElementById("expense-month-filter");
  if (monthFilter) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    monthFilter.value = `${yyyy}-${mm}`;
    monthFilter.addEventListener("change", renderExpenses);
  }

  document.getElementById("expense-category-filter")?.addEventListener("change", renderExpenses);
});

/**
 * Main Expenses Renderer
 */
window.renderExpenses = function() {
  const expenses = window.appState.db.Expenses || [];
  
  const monthFilter = document.getElementById("expense-month-filter")?.value || "";
  const categoryFilter = document.getElementById("expense-category-filter")?.value || "All";

  const filtered = expenses.filter(e => {
    const matchesCategory = categoryFilter === "All" || e["Category"] === categoryFilter;

    let matchesMonth = true;
    if (monthFilter && e["Date"]) {
      matchesMonth = e["Date"].startsWith(monthFilter);
    }

    return matchesCategory && matchesMonth;
  });

  filtered.sort((a, b) => new Date(b["Date"]) - new Date(a["Date"]));

  const infoText = document.getElementById("expense-table-info");
  if (infoText) infoText.textContent = `عرض إجمالي ${filtered.length} عملية مصروف مسجلة`;

  const tbody = document.getElementById("expenses-table-body");
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-8 text-center text-xs text-slate-400 font-medium">
          لا توجد بنود مصروفات مسجلة للفترة أو القسم المختار.
        </td>
      </tr>
    `;
    renderExpenseBreakdown(filtered);
    return;
  }

  tbody.innerHTML = filtered.map(e => {
    return `
      <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs">
        <td class="py-3 px-6 font-mono text-slate-500 font-semibold text-right">${e["Date"]}</td>
        <td class="py-3 px-6 text-right font-mono">${escapeHtml(e["Expense ID"])}</td>
        <td class="py-3 px-6 text-right">
          <span class="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold ${getExpenseCategoryBadgeClass(e["Category"])}">
            ${escapeHtml(translateExpenseCategory(e["Category"]))}
          </span>
        </td>
        <td class="py-3 px-6 text-slate-700 text-right">${escapeHtml(e["Notes"] || "-")}</td>
        <td class="py-3 px-6 text-left font-bold text-slate-900 font-mono">${formatCurrency(e["Amount"])}</td>
      </tr>
    `;
  }).join("");

  renderExpenseBreakdown(filtered);
};

/**
 * Handle form submission
 */
async function handleExpenseFormSubmit(e) {
  e.preventDefault();

  const date = document.getElementById("exp-form-date").value;
  const category = document.getElementById("exp-form-category").value;
  const amount = parseFloat(document.getElementById("exp-form-amount").value) || 0;
  const notes = document.getElementById("exp-form-notes").value.trim();

  if (amount <= 0) {
    showToast("تنبيه: يجب إدخال قيمة مصروف أكبر من الصفر.", "warning");
    return;
  }

  const payload = {
    "Expense ID": generateId("EXP"),
    "Date": date,
    "Category": category,
    "Amount": amount,
    "Notes": notes
  };

  showLoader("جاري حفظ بند المصروف التشغيلي...");
  try {
    await api.saveExpense(payload);
    closeExpenseModal();
    showToast("تم تسجيل بند المصروف بنجاح وتحديث الأرباح", "success");
    if (!api.isMockMode) {
      await api.syncData();
    }
  } catch (error) {
    showToast(`فشل تسجيل بند المصروف: ${error.message}`, "error");
  } finally {
    hideLoader();
  }
}

/**
 * Open Modal Form
 */
window.openExpenseModal = function() {
  const modal = document.getElementById("expense-modal");
  if (!modal) return;

  document.getElementById("expense-form").reset();
  document.getElementById("exp-form-date").value = getLocalDateString();

  modal.classList.remove("hidden");
  modal.classList.add("flex");
};

window.closeExpenseModal = function() {
  const modal = document.getElementById("expense-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
};

/**
 * Category Breakdown Calculator
 */
function renderExpenseBreakdown(filteredExpenses) {
  const labelsContainer = document.getElementById("expense-breakdown-labels");
  const container = document.getElementById("expense-donut-container");
  
  if (!labelsContainer || !container) return;

  if (filteredExpenses.length === 0) {
    container.innerHTML = `<div class="text-slate-400 text-xs font-semibold">لا توجد مصروفات مسجلة.</div>`;
    labelsContainer.innerHTML = "";
    return;
  }

  const categoriesSum = {};
  let grandTotal = 0;

  filteredExpenses.forEach(e => {
    const amt = parseFloat(e["Amount"]) || 0;
    const cat = e["Category"] || "Other";
    categoriesSum[cat] = (categoriesSum[cat] || 0) + amt;
    grandTotal += amt;
  });

  container.innerHTML = `
    <div class="text-center">
      <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">إجمالي المصروفات</p>
      <h4 class="text-xl font-bold text-slate-900 font-display mt-1 font-mono">${formatCurrency(grandTotal)}</h4>
    </div>
  `;

  const sortedCategories = Object.entries(categoriesSum).sort((a, b) => b[1] - a[1]);

  labelsContainer.innerHTML = sortedCategories.map(([cat, val]) => {
    const percent = grandTotal > 0 ? Math.round((val / grandTotal) * 100) : 0;
    
    let progressBg = "bg-indigo-600";
    if (cat === "Rent") progressBg = "bg-rose-500";
    if (cat === "Salaries") progressBg = "bg-emerald-500";
    if (cat === "Electricity" || cat === "Internet") progressBg = "bg-amber-500";
    if (cat === "Marketing") progressBg = "bg-violet-500";

    return `
      <div class="space-y-1 text-xs text-right" dir="rtl">
        <div class="flex justify-between items-center text-slate-700">
          <div class="flex items-center space-x-reverse space-x-1.5">
            <span class="w-2.5 h-2.5 rounded-full ${progressBg}"></span>
            <span class="font-semibold">${escapeHtml(translateExpenseCategory(cat))}</span>
          </div>
          <span class="font-mono font-bold">${formatCurrency(val)} (${percent}%)</span>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-1.5">
          <div class="${progressBg} h-1.5 rounded-full float-right" style="width: ${percent}%"></div>
        </div>
      </div>
    `;
  }).join("");
}

// Helpers
function getExpenseCategoryBadgeClass(category) {
  switch (category) {
    case "Rent":
      return "bg-rose-50 text-rose-700 border border-rose-100";
    case "Salaries":
      return "bg-emerald-50 text-emerald-700 border border-emerald-100";
    case "Electricity":
    case "Internet":
      return "bg-amber-50 text-amber-700 border border-amber-100";
    case "Marketing":
      return "bg-violet-50 text-violet-700 border border-violet-100";
    case "Transportation":
      return "bg-indigo-50 text-indigo-700 border border-indigo-100";
    default:
      return "bg-slate-100 text-slate-700 border border-slate-200";
  }
}

// Translate categories dynamically
function translateExpenseCategory(category) {
  switch (category) {
    case "Rent":
      return "إيجار";
    case "Salaries":
      return "رواتب";
    case "Electricity":
      return "كهرباء";
    case "Internet":
      return "إنترنت";
    case "Marketing":
      return "تسويق";
    case "Transportation":
      return "نقل وانتقالات";
    case "Other":
      return "أخرى";
    default:
      return category || "أخرى";
  }
}
