/**
 * Customers and CRM Module - Localized to Arabic
 * Manages customer listing, creation, credit balance tracking, and partial payment collections
 */

let custModalCart = [];

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("customer-form");
  if (form) {
    form.addEventListener("submit", handleCustomerFormSubmit);
  }

  document.getElementById("cust-add-new-btn")?.addEventListener("click", () => openCustomerModal());
  document.getElementById("customer-modal-close")?.addEventListener("click", closeCustomerModal);
  document.getElementById("cust-form-cancel")?.addEventListener("click", closeCustomerModal);

  document.getElementById("cust-search")?.addEventListener("input", renderCustomers);
  document.getElementById("cust-filter-debt")?.addEventListener("change", renderCustomers);

  document.getElementById("cust-drawer-close")?.addEventListener("click", closeCustomerDrawer);
  document.getElementById("cust-payment-submit")?.addEventListener("click", handleDrawerPaymentSubmit);

  // New elements listeners for invoice builder inside Customer Modal
  document.getElementById("cust-form-has-invoice")?.addEventListener("change", handleInvoiceToggleChange);
  document.getElementById("cust-invoice-add-item-btn")?.addEventListener("click", addCustInvoiceItem);
  document.getElementById("cust-invoice-paid")?.addEventListener("input", validateCustInvoicePaid);
});

/**
 * Main CRM Module Renderer
 */
window.renderCustomers = function() {
  const customers = window.appState.db.Customers || [];

  const searchQuery = document.getElementById("cust-search")?.value.toLowerCase().trim() || "";
  const debtFilter = document.getElementById("cust-filter-debt")?.value || "All";

  let filtered = customers.filter(c => {
    const isNotArchived = (c["Status"] || "Active") !== "Archived";
    const isNotGeneric = c["Customer ID"] !== "GENERIC";

    const matchesSearch = 
      (c["Name"] && String(c["Name"]).toLowerCase().includes(searchQuery)) ||
      (c["Customer ID"] && String(c["Customer ID"]).toLowerCase().includes(searchQuery)) ||
      (c["Phone Number"] && String(c["Phone Number"]).includes(searchQuery)) ||
      (c["Address"] && String(c["Address"]).toLowerCase().includes(searchQuery));

    const balance = parseFloat(c["Outstanding Balance"]) || 0;
    const matchesDebt = 
      debtFilter === "All" ||
      (debtFilter === "With Debt" && balance > 0) ||
      (debtFilter === "No Debt" && balance === 0);

    return isNotArchived && isNotGeneric && matchesSearch && matchesDebt;
  });

  filtered.sort((a, b) => {
    const balDiff = (parseFloat(b["Outstanding Balance"]) || 0) - (parseFloat(a["Outstanding Balance"]) || 0);
    if (balDiff !== 0) return balDiff;
    return (parseFloat(b["Total Purchases"]) || 0) - (parseFloat(a["Total Purchases"]) || 0);
  });

  const infoText = document.getElementById("cust-table-info");
  if (infoText) infoText.textContent = `عرض إجمالي ${filtered.length} عميل مسجل حالياً`;

  const tbody = document.getElementById("customers-table-body");
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-8 text-center text-xs text-slate-400 font-medium">
          لم يتم العثور على حسابات عملاء مطابقة للبحث أو المديونيات.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    const debtVal = parseFloat(c["Outstanding Balance"]) || 0;
    const debtClass = debtVal > 0 ? "text-rose-600 font-bold" : "text-slate-400 font-medium";

    return `
      <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs">
        <td class="py-3 px-6 font-mono font-semibold text-slate-500">${c["Customer ID"]}</td>
        <td class="py-3 px-6 font-bold text-slate-900 text-right">${c["Name"]}</td>
        <td class="py-3 px-6 text-slate-600 font-mono text-right">${c["Phone Number"]}</td>
        <td class="py-3 px-6 text-slate-500 text-right">${c["Address"] || "-"}</td>
        <td class="py-3 px-6 text-left font-mono font-medium">${formatCurrency(c["Total Purchases"])}</td>
        <td class="py-3 px-6 text-left font-mono ${debtClass}">${formatCurrency(debtVal)}</td>
        <td class="py-3 px-6 text-center">
          <div class="flex items-center justify-center space-x-reverse space-x-1">
            <button onclick="openCustomerDrawer('${c["Customer ID"]}')" class="p-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-100" title="كشف الحساب">
              <i data-lucide="eye" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="openCustomerModal('${c["Customer ID"]}')" class="p-1 border border-slate-200 rounded text-indigo-600 hover:bg-indigo-50" title="تعديل البيانات">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="archiveCustomer('${c["Customer ID"]}')" class="p-1 border border-slate-200 rounded text-rose-600 hover:bg-rose-50" title="أرشفة الحساب">
              <i data-lucide="user-minus" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  lucide.createIcons();
};

/**
 * Handle form submission
 */
async function handleCustomerFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById("cust-form-id").value;
  const name = document.getElementById("cust-form-name").value.trim();
  const phone = document.getElementById("cust-form-phone").value.trim();
  const address = document.getElementById("cust-form-address").value.trim();

  const toggleCheckbox = document.getElementById("cust-form-has-invoice");
  const hasInvoice = toggleCheckbox ? toggleCheckbox.checked : false;

  if (hasInvoice && custModalCart.length === 0) {
    showToast("يرجى إضافة بند واحد على الأقل للفاتورة أو إلغاء تحديد خيار تسجيل فاتورة.", "warning");
    return;
  }

  const existing = window.appState.db.Customers.find(c => c["Customer ID"] === id);
  const totalPurch = existing ? parseFloat(existing["Total Purchases"]) || 0 : 0;
  const outBal = existing ? parseFloat(existing["Outstanding Balance"]) || 0 : 0;

  // Compile opening balance invoice if needed
  let openInvoice = null;
  let openInvoiceItems = [];
  const openingBalance = parseFloat(document.getElementById("cust-form-opening-balance")?.value) || 0;
  if (!existing && openingBalance > 0) {
    const nextInvoiceNumber = "INV-OPEN-" + Math.floor(10000 + Math.random() * 90000);
    openInvoice = {
      "Invoice Number": nextInvoiceNumber,
      "Customer ID": id,
      "Customer Name": name,
      "Invoice Date": getLocalDateString(),
      "Total Amount": openingBalance,
      "Paid Amount": 0,
      "Remaining Amount": openingBalance,
      "Payment Method": "Cash",
      "Status": "Unpaid",
      "Notes": "رصيد افتتاحي / مديونية سابقة عند تسجيل الحساب",
      "Discount": 0
    };
    openInvoiceItems = [{
      "Item ID": generateId("ITEM"),
      "Invoice Number": nextInvoiceNumber,
      "Product ID": "PROD-OPEN",
      "Product Name": "رصيد افتتاحي / ديون سابقة",
      "Quantity": 1,
      "Purchase Price": 0,
      "Selling Price": openingBalance,
      "Total Price": openingBalance
    }];
  }

  // Compile invoice payload if needed
  let invoice = null;
  let invoiceItems = [];
  if (hasInvoice && !existing) {
    const totalAmount = custModalCart.reduce((sum, item) => sum + item.totalPrice, 0);
    const paidAmount = parseFloat(document.getElementById("cust-invoice-paid").value) || 0;
    const remainingAmount = Math.max(0, totalAmount - paidAmount);
    const paymentMethod = document.getElementById("cust-invoice-method").value;
    const nextInvoiceNumber = "INV-" + Math.floor(10000 + Math.random() * 90000);

    let status = "Paid";
    if (remainingAmount > 0) {
      status = paidAmount === 0 ? "Unpaid" : "Partially Paid";
    }

    const invoiceDate = document.getElementById("cust-invoice-date")?.value || getLocalDateString();

    invoice = {
      "Invoice Number": nextInvoiceNumber,
      "Customer ID": id,
      "Customer Name": name,
      "Invoice Date": invoiceDate,
      "Total Amount": totalAmount,
      "Paid Amount": paidAmount,
      "Remaining Amount": remainingAmount,
      "Payment Method": paymentMethod,
      "Status": status,
      "Notes": "فاتورة مبيعات أولية عند تسجيل حساب العميل",
      "Discount": 0
    };

    invoiceItems = custModalCart.map(item => {
      return {
        "Item ID": generateId("ITEM"),
        "Invoice Number": nextInvoiceNumber,
        "Product ID": item.product["Product ID"],
        "Product Name": item.product["Product Name"],
        "Quantity": item.quantity,
        "Purchase Price": item.product["Purchase Price"],
        "Selling Price": item.product["Selling Price"],
        "Total Price": item.totalPrice
      };
    });
  }

  const payload = {
    "Customer ID": id,
    "Name": name,
    "Phone Number": phone,
    "Address": address,
    "Total Purchases": totalPurch,
    "Outstanding Balance": outBal,
    "Status": "Active"
  };

  showLoader("جاري حفظ العميل...");
  try {
    // 1. Save customer profile
    await api.saveCustomer(payload);

    // 2. Save opening balance invoice if applicable
    if (openInvoice && openInvoiceItems.length > 0) {
      await api.saveInvoice(openInvoice, openInvoiceItems);
    }

    // 3. Save invoice if applicable
    if (invoice && invoiceItems.length > 0) {
      await api.saveInvoice(invoice, invoiceItems);
      
      // Try to print the invoice using the POS printable layout
      if (typeof window.printInvoice === "function") {
        window.printInvoice(invoice, invoiceItems);
      }
    }

    closeCustomerModal();
    showToast(`تم تسجيل حساب العميل [${name}] بنجاح`, "success");
    if (!api.isMockMode) {
      await api.syncData();
    }
  } catch (error) {
    showToast(`فشل تسجيل العميل أو الفاتورة: ${error.message}`, "error");
  } finally {
    hideLoader();
  }
}

/**
 * Open Customer Modal Form
 */
window.openCustomerModal = function(customerId = null) {
  const modal = document.getElementById("customer-modal");
  const form = document.getElementById("customer-form");
  const title = document.getElementById("customer-modal-title");

  if (!modal || !form) return;

  form.reset();
  custModalCart = [];
  renderCustInvoiceCart();

  const invoiceDateInput = document.getElementById("cust-invoice-date");
  if (invoiceDateInput) {
    invoiceDateInput.value = getLocalDateString();
  }

  const toggleCheckbox = document.getElementById("cust-form-has-invoice");
  const toggleContainer = toggleCheckbox ? toggleCheckbox.closest(".border-t") : null;
  const invoiceSection = document.getElementById("cust-modal-invoice-section");

  if (invoiceSection) invoiceSection.classList.add("hidden");

  if (customerId) {
    title.textContent = "تعديل بيانات العميل الحالي";
    const custObj = window.appState.db.Customers.find(c => c["Customer ID"] === customerId);
    if (custObj) {
      document.getElementById("cust-form-id").value = custObj["Customer ID"];
      document.getElementById("cust-form-name").value = custObj["Name"];
      document.getElementById("cust-form-phone").value = custObj["Phone Number"];
      document.getElementById("cust-form-address").value = custObj["Address"] || "";
    }
    
    // Disable logging invoice on edit mode
    if (toggleContainer) toggleContainer.classList.add("hidden");
    if (toggleCheckbox) {
      toggleCheckbox.checked = false;
      toggleCheckbox.disabled = true;
    }

    // Hide opening balance field in edit mode
    const obContainer = document.getElementById("cust-form-opening-balance-container");
    if (obContainer) obContainer.classList.add("hidden");
  } else {
    title.textContent = "تسجيل عميل جديد بالمتجر";
    document.getElementById("cust-form-id").value = generateId("CUST");

    // Enable logging invoice on new customer mode
    if (toggleContainer) toggleContainer.classList.remove("hidden");
    if (toggleCheckbox) {
      toggleCheckbox.checked = false;
      toggleCheckbox.disabled = false;
    }

    // Show opening balance field in create mode
    const obContainer = document.getElementById("cust-form-opening-balance-container");
    if (obContainer) obContainer.classList.remove("hidden");
    const obInput = document.getElementById("cust-form-opening-balance");
    if (obInput) obInput.value = "0";
  }

  modal.classList.remove("hidden");
  modal.classList.add("flex");
};

window.closeCustomerModal = function() {
  const modal = document.getElementById("customer-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
};

/**
 * Logical Archive Customer
 */
window.archiveCustomer = async function(customerId) {
  const custObj = window.appState.db.Customers.find(c => c["Customer ID"] === customerId);
  if (!custObj) return;

  const confirmed = confirm(`هل أنت متأكد من أرشفة العميل: ${custObj["Name"]}؟\nسيتم استبعاد حسابه من البحث ولكن يتم الاحتفاظ بجميع فواتيره التشغيلية ومسحوباته للمراجعة المالية.`);
  if (!confirmed) return;

  showLoader("جاري أرشفة الحساب...");
  try {
    const updatedCust = { ...custObj, Status: "Archived" };
    await api.saveCustomer(updatedCust);
    showToast("تم أرشفة العميل بنجاح", "success");
    if (!api.isMockMode) {
      await api.syncData();
    }
  } catch (error) {
    showToast(`فشلت أرشفة العميل: ${error.message}`, "error");
  } finally {
    hideLoader();
  }
};

/**
 * Customer Statement Drawer Management
 */
let activeDrawerCustomerId = null;

window.openCustomerDrawer = function(customerId) {
  const drawer = document.getElementById("customer-profile-drawer");
  if (!drawer) return;

  activeDrawerCustomerId = customerId;
  const custObj = window.appState.db.Customers.find(c => c["Customer ID"] === customerId);
  if (!custObj) return;

  document.getElementById("cust-drawer-name").textContent = custObj["Name"];
  document.getElementById("cust-drawer-id").textContent = custObj["Customer ID"];
  document.getElementById("cust-drawer-phone").textContent = custObj["Phone Number"];
  document.getElementById("cust-drawer-address").textContent = custObj["Address"] || "لا يوجد عنوان مسجل";
  document.getElementById("cust-drawer-total").textContent = formatCurrency(custObj["Total Purchases"]);
  
  const balance = parseFloat(custObj["Outstanding Balance"]) || 0;
  document.getElementById("cust-drawer-balance").textContent = formatCurrency(balance);

  const payPanel = document.getElementById("cust-drawer-payment-panel");
  if (balance > 0) {
    if (payPanel) payPanel.classList.remove("hidden");
    const inputAmt = document.getElementById("cust-payment-amount");
    if (inputAmt) {
      inputAmt.value = balance;
      inputAmt.max = balance;
    }
  } else {
    if (payPanel) payPanel.classList.add("hidden");
  }

  renderCustomerInvoiceList(customerId);

  // Slide-in from the left in RTL
  drawer.classList.remove("-translate-x-full");
};

window.closeCustomerDrawer = function() {
  const drawer = document.getElementById("customer-profile-drawer");
  if (drawer) {
    drawer.classList.add("-translate-x-full");
  }
  activeDrawerCustomerId = null;
};

/**
 * Compile customer historical purchases inside drawer
 */
function renderCustomerInvoiceList(customerId) {
  const invoices = window.appState.db.Invoices || [];
  const customerInvoices = invoices.filter(i => i["Customer ID"] === customerId);

  const container = document.getElementById("cust-drawer-invoices-container");
  if (!container) return;

  if (customerInvoices.length === 0) {
    container.innerHTML = `
      <div class="py-6 text-center text-slate-400 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold">
        لا توجد فواتير مبيعات سابقة لهذا العميل.
      </div>
    `;
    return;
  }

  customerInvoices.sort((a, b) => new Date(b["Invoice Date"]) - new Date(a["Invoice Date"]));

  const allItems = window.appState.db.InvoiceItems || [];

  container.innerHTML = customerInvoices.map(i => {
    const rem = parseFloat(i["Remaining Amount"]) || 0;
    const discount = parseFloat(i["Discount"]) || 0;
    const paid = parseFloat(i["Paid Amount"]) || 0;
    const invNumber = i["Invoice Number"];
    
    let pillClass, statusAr;
    if (i["Status"] === "Paid") {
      pillClass = "bg-emerald-50 text-emerald-700 border-emerald-100";
      statusAr = "مدفوع بالكامل";
    } else if (i["Status"] === "Partially Paid") {
      pillClass = "bg-amber-50 text-amber-700 border-amber-100";
      statusAr = "مدفوع جزئياً";
    } else {
      pillClass = "bg-rose-50 text-rose-700 border-rose-100";
      statusAr = "غير مدفوع";
    }

    // Filter items belonging to this specific invoice
    const items = allItems.filter(item => item["Invoice Number"] === invNumber);

    // Build items table rows
    const itemsHtml = items.map(item => `
      <tr class="border-b border-slate-50 last:border-none">
        <td class="py-1 px-2 text-slate-800 font-semibold font-sans text-right">${item["Product Name"]}</td>
        <td class="py-1 px-2 text-center font-mono">${item["Quantity"]}</td>
        <td class="py-1 px-2 text-left font-mono text-slate-500">${formatCurrency(item["Selling Price"])}</td>
        <td class="py-1 px-2 text-left font-mono font-bold text-slate-900">${formatCurrency(item["Total Price"])}</td>
      </tr>
    `).join("") || `
      <tr>
        <td colspan="4" class="py-2 text-center text-slate-400">لا توجد بنود مسجلة في هذه الفاتورة.</td>
      </tr>
    `;

    // Payment collection section for this invoice if there is unpaid debt
    let paymentPanelHtml = "";
    if (rem > 0) {
      paymentPanelHtml = `
        <div class="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-rose-50/20 p-2.5 rounded-lg border border-rose-100/30">
          <div class="text-[10px] text-rose-600 font-semibold text-right">
            المتبقي المديون: <span class="font-mono font-bold">${formatCurrency(rem)}</span>
          </div>
          <div class="flex items-center space-x-reverse space-x-1.5 justify-end">
            <input type="number" step="0.01" max="${rem}" id="pay-single-amount-${invNumber}" placeholder="المبلغ" value="${rem}" class="w-20 border border-slate-200 rounded py-1 px-1.5 text-[10px] bg-white focus:outline-none font-mono text-left pl-1">
            <button type="button" onclick="submitSingleInvoicePayment('${invNumber}')" class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold transition-all">تسجيل دفعة</button>
            <button type="button" onclick="submitSingleInvoicePayment('${invNumber}', ${rem})" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold transition-all">سداد بالكامل</button>
            <button type="button" onclick="submitSingleInvoicePayment('${invNumber}', null, true)" class="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold transition-all" title="تسجيل الدفعة الحالية وإعفاء العميل من باقي المبلغ كخصم تسوية">خصم المتبقي</button>
          </div>
        </div>
      `;
    }

    return `
      <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all space-y-3">
        <!-- Invoice Header -->
        <div class="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-100">
          <div class="flex items-center space-x-reverse space-x-2">
            <button onclick="printInvoiceFromHistory('${invNumber}')" class="text-xs font-mono font-bold text-indigo-600 hover:underline flex items-center" title="طباعة الفاتورة">
              <i data-lucide="printer" class="w-3.5 h-3.5 ml-1"></i>
              <span>${invNumber}</span>
            </button>
            <span class="text-[10px] text-slate-400 font-mono">${i["Invoice Date"]}</span>
          </div>
          <div class="flex items-center space-x-reverse space-x-2">
            <span class="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border ${pillClass}">${statusAr}</span>
            <span class="text-xs font-mono font-bold text-slate-800">${formatCurrency(i["Total Amount"])}</span>
          </div>
        </div>

        <!-- Products Purchased -->
        <div class="border border-slate-100 rounded-lg overflow-hidden bg-slate-50/50">
          <table class="w-full text-right border-collapse text-[10px]" dir="rtl">
            <thead class="bg-slate-100 border-b border-slate-200 font-semibold text-slate-600">
              <tr>
                <th class="py-1 px-2 text-right">اسم المنتج</th>
                <th class="py-1 px-2 text-center">الكمية</th>
                <th class="py-1 px-2 text-left">سعر الوحدة</th>
                <th class="py-1 px-2 text-left">الإجمالي</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-mono">
              ${itemsHtml}
            </tbody>
          </table>
        </div>

        <!-- Notes if exists -->
        ${i["Notes"] ? `<p class="text-[10px] text-slate-400 text-right font-medium">ملاحظات: ${i["Notes"]}</p>` : ""}

        <!-- Financial Summary -->
        <div class="flex justify-between items-center text-[10px] text-slate-500 bg-slate-50/50 p-2 rounded-lg font-mono" dir="rtl">
          <div>
            <span>المدفوع:</span>
            <span class="font-bold text-emerald-600">${formatCurrency(paid)}</span>
          </div>
          ${discount > 0 ? `
          <div>
            <span>الخصم:</span>
            <span class="font-bold text-indigo-600">${formatCurrency(discount)}</span>
          </div>
          ` : ''}
          <div>
            <span>المتبقي:</span>
            <span class="font-bold text-rose-600">${formatCurrency(rem)}</span>
          </div>
        </div>

        <!-- Payment Actions -->
        ${paymentPanelHtml}
      </div>
    `;
  }).join("");

  lucide.createIcons();
}

/**
 * Handle payments directly from specific invoices
 */
window.submitSingleInvoicePayment = async function(invoiceNumber, fixedAmount = null, discountRemaining = false) {
  let amount = fixedAmount;
  if (amount === null) {
    const input = document.getElementById(`pay-single-amount-${invoiceNumber}`);
    amount = parseFloat(input?.value) || 0;
  }

  if (amount < 0 || (amount === 0 && !discountRemaining)) {
    showToast("برجاء إدخال مبلغ صحيح أكبر من أو يساوي الصفر.", "warning");
    return;
  }

  const invoices = window.appState.db.Invoices || [];
  const invoice = invoices.find(i => i["Invoice Number"] === invoiceNumber);
  if (!invoice) return;

  const rem = parseFloat(invoice["Remaining Amount"]) || 0;
  if (amount > rem) {
    showToast(`تنبيه: المبلغ المدخل (${amount}) أكبر من المتبقي على الفاتورة (${rem}).`, "warning");
    return;
  }

  const msg = discountRemaining 
    ? `جاري تسوية الفاتورة وإعفاء المتبقي (${formatCurrency(rem - amount)}) كخصم...` 
    : "جاري تسجيل الدفعة...";

  showLoader(msg);
  try {
    await api.addPayment(invoiceNumber, amount, discountRemaining);
    const successMsg = discountRemaining
      ? `تم تسوية الفاتورة ${invoiceNumber} بالكامل مع خصم الباقي`
      : `تم تسجيل دفعة بقيمة ${formatCurrency(amount)} للفاتورة ${invoiceNumber}`;
    showToast(successMsg, "success");
    
    if (!api.isMockMode) {
      await api.syncData();
    }
    
    // Refresh drawer view
    if (activeDrawerCustomerId) {
      openCustomerDrawer(activeDrawerCustomerId);
    }
  } catch (error) {
    showToast(`فشل تسجيل الدفعة: ${error.message}`, "error");
  } finally {
    hideLoader();
  }
};

/**
 * Distributes payment amount to oldest unpaid customer invoices (FIFO)
 */
async function handleDrawerPaymentSubmit() {
  if (!activeDrawerCustomerId) return;

  const inputAmt = document.getElementById("cust-payment-amount");
  const amountToCollect = parseFloat(inputAmt?.value) || 0;

  if (amountToCollect <= 0) {
    showToast("برجاء إدخال مبلغ تحصيل صحيح أكبر من الصفر.", "warning");
    return;
  }

  const invoices = window.appState.db.Invoices || [];
  const customerInvoices = invoices.filter(i => i["Customer ID"] === activeDrawerCustomerId && i["Status"] !== "Paid");

  customerInvoices.sort((a, b) => new Date(a["Invoice Date"]) - new Date(b["Invoice Date"]));

  if (customerInvoices.length === 0) {
    showToast("حساب العميل خالٍ تماماً من المديونيات.", "warning");
    return;
  }

  showLoader("جاري توزيع مبلغ التحصيل على الفواتير...");
  try {
    let remainingAmountToPay = amountToCollect;

    for (let i = 0; i < customerInvoices.length; i++) {
      if (remainingAmountToPay <= 0) break;

      const invoice = customerInvoices[i];
      const invDue = parseFloat(invoice["Remaining Amount"]) || 0;
      const paymentForThisInvoice = Math.min(remainingAmountToPay, invDue);

      if (paymentForThisInvoice > 0) {
        await api.addPayment(invoice["Invoice Number"], paymentForThisInvoice);
        remainingAmountToPay -= paymentForThisInvoice;
      }
    }

    showToast(`تم تحصيل ${formatCurrency(amountToCollect)} وتسوية مديونيات العميل بنجاح!`, "success");
    
    if (!api.isMockMode) {
      await api.syncData();
    } else {
      openCustomerDrawer(activeDrawerCustomerId);
    }
  } catch (error) {
    showToast(`فشل تحصيل المبلغ: ${error.message}`, "error");
  } finally {
    hideLoader();
  }
}

/**
 * Toggle check/uncheck invoice log section
 */
function handleInvoiceToggleChange(e) {
  const invoiceSection = document.getElementById("cust-modal-invoice-section");
  if (!invoiceSection) return;

  if (e.target.checked) {
    invoiceSection.classList.remove("hidden");
    populateCustInvoiceProductSelect();
  } else {
    invoiceSection.classList.add("hidden");
    custModalCart = [];
    renderCustInvoiceCart();
  }
}

/**
 * Populate products list inside invoice builder select dropdown
 */
function populateCustInvoiceProductSelect() {
  const select = document.getElementById("cust-invoice-product-select");
  if (!select) return;

  const products = window.appState.db.Products || [];
  const activeProducts = products.filter(p => (p["Status"] || "Active") !== "Archived" && (parseFloat(p["Current Quantity"]) || 0) > 0);

  select.innerHTML = '<option value="">-- اختر المنتج --</option>' +
    activeProducts.map(p => {
      const available = parseFloat(p["Current Quantity"]) || 0;
      const price = parseFloat(p["Selling Price"]) || 0;
      return `<option value="${p["Product ID"]}">${p["Product Name"]} (المتاح: ${available}) - ${price} جنيه</option>`;
    }).join("");
}

/**
 * Add product item to Customer registration checkout cart
 */
function addCustInvoiceItem() {
  const productSelect = document.getElementById("cust-invoice-product-select");
  const qtyInput = document.getElementById("cust-invoice-qty");
  
  if (!productSelect || !qtyInput) return;

  const productId = productSelect.value;
  const quantity = parseFloat(qtyInput.value) || 0;

  if (!productId) {
    showToast("يرجى اختيار منتج من القائمة أولاً.", "warning");
    return;
  }

  if (quantity <= 0) {
    showToast("يرجى إدخال كمية صحيحة أكبر من الصفر.", "warning");
    return;
  }

  const prodObj = window.appState.db.Products.find(p => p["Product ID"] === productId);
  if (!prodObj) return;

  const maxQty = parseFloat(prodObj["Current Quantity"]) || 0;
  
  // Find if already exists in local customer modal cart
  const cartIndex = custModalCart.findIndex(item => item.product["Product ID"] === productId);
  let nextQty = quantity;
  if (cartIndex !== -1) {
    nextQty = custModalCart[cartIndex].quantity + quantity;
  }

  if (nextQty > maxQty) {
    showToast(`عذراً: الكمية المطلوبة تتجاوز المتاح في المخزن (${maxQty} قطع).`, "warning");
    return;
  }

  if (cartIndex !== -1) {
    custModalCart[cartIndex].quantity = nextQty;
    custModalCart[cartIndex].totalPrice = nextQty * parseFloat(prodObj["Selling Price"]);
  } else {
    custModalCart.push({
      product: prodObj,
      quantity: quantity,
      totalPrice: quantity * parseFloat(prodObj["Selling Price"])
    });
  }

  // Reset inputs
  productSelect.value = "";
  qtyInput.value = "1";

  renderCustInvoiceCart();
}

/**
 * Render Customer Modal Invoice Cart
 */
function renderCustInvoiceCart() {
  const tbody = document.getElementById("cust-invoice-cart-body");
  if (!tbody) return;

  if (custModalCart.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="py-3 text-center text-slate-400">لا توجد بنود مضافة بعد.</td>
      </tr>
    `;
    const totalInput = document.getElementById("cust-invoice-total");
    const paidInput = document.getElementById("cust-invoice-paid");
    if (totalInput) totalInput.value = "0.00";
    if (paidInput) paidInput.value = "0";
    return;
  }

  let totalAmount = 0;
  tbody.innerHTML = custModalCart.map((item, index) => {
    totalAmount += item.totalPrice;
    return `
      <tr class="hover:bg-slate-50 border-b border-slate-100 text-[10px]">
        <td class="py-1.5 px-2 text-right">${item.product["Product Name"]}</td>
        <td class="py-1.5 px-2 text-center">${item.quantity}</td>
        <td class="py-1.5 px-2 text-left pl-2 font-bold">${formatCurrency(item.totalPrice)}</td>
        <td class="py-1.5 px-2 text-center">
          <button type="button" onclick="removeCustModalCartItem(${index})" class="text-rose-500 hover:text-rose-700">
            <i class="w-3.5 h-3.5 inline" data-lucide="trash-2"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");

  const totalInput = document.getElementById("cust-invoice-total");
  const paidInput = document.getElementById("cust-invoice-paid");
  if (totalInput) totalInput.value = totalAmount.toFixed(2);
  if (paidInput) paidInput.value = totalAmount; // Default to pay in full

  lucide.createIcons();
}

/**
 * Remove item from customer modal cart
 */
window.removeCustModalCartItem = function(index) {
  custModalCart.splice(index, 1);
  renderCustInvoiceCart();
};

/**
 * Clamp paid amount to not exceed invoice total
 */
function validateCustInvoicePaid() {
  const totalInput = document.getElementById("cust-invoice-total");
  const paidInput = document.getElementById("cust-invoice-paid");

  if (!totalInput || !paidInput) return;

  const total = parseFloat(totalInput.value) || 0;
  let paid = parseFloat(paidInput.value) || 0;

  if (paid < 0) paid = 0;
  if (paid > total) paid = total;

  paidInput.value = paid;
}
