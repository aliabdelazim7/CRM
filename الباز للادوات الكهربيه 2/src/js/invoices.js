/**
 * Invoices & POS Module - Localized to Arabic
 * Controls the point-of-sale interactive catalog, cart, checkout payments, and printable invoices
 */

let posCart = [];
let barcodeModeActive = false;

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("pos-product-search")?.addEventListener("input", handlePOSSearch);
  document.getElementById("pos-category-filter")?.addEventListener("change", renderPOSCatalog);
  document.getElementById("pos-clear-cart-btn")?.addEventListener("click", clearPOSCart);
  
  document.getElementById("pos-checkout-btn")?.addEventListener("click", openCheckoutPaymentModal);
  document.getElementById("payment-modal-close")?.addEventListener("click", closeCheckoutPaymentModal);
  document.getElementById("pay-modal-cancel")?.addEventListener("click", closeCheckoutPaymentModal);
  document.getElementById("pay-modal-submit")?.addEventListener("click", () => finalizePOSOrder(true));
  document.getElementById("pay-modal-submit-save-only")?.addEventListener("click", () => finalizePOSOrder(false));

  document.getElementById("pos-barcode-mode-btn")?.addEventListener("click", toggleBarcodeMode);
  document.getElementById("pos-hold-cart-btn")?.addEventListener("click", suspendActiveCart);

  document.getElementById("pay-modal-paid")?.addEventListener("input", recalculateCheckoutPaymentBalances);
  document.getElementById("pay-modal-discount")?.addEventListener("input", recalculateCheckoutPaymentBalances);

  // Quick Customer Inside Checkout Modal
  document.getElementById("pay-modal-add-customer-quick-btn")?.addEventListener("click", () => {
    document.getElementById("pay-modal-quick-customer-form")?.classList.toggle("hidden");
  });

  document.getElementById("pay-modal-cust-cancel")?.addEventListener("click", () => {
    document.getElementById("pay-modal-quick-customer-form")?.classList.add("hidden");
    document.getElementById("pay-modal-cust-name").value = "";
    document.getElementById("pay-modal-cust-phone").value = "";
  });

  document.getElementById("pay-modal-cust-save")?.addEventListener("click", saveQuickCustomerFromCheckout);
});

/**
 * Main POS Screen Renderer
 */
window.renderPOS = function() {
  populatePOSCustomerDropdown();

  const products = window.appState.db.Products || [];
  const activeProds = products.filter(p => (p["Status"] || "Active") !== "Archived");
  const categories = [...new Set(activeProds.map(p => p["Category"]).filter(Boolean))];
  const catFilter = document.getElementById("pos-category-filter");
  if (catFilter) {
    const selected = catFilter.value;
    catFilter.innerHTML = `<option value="All">جميع الأقسام</option>` + 
      categories.map(c => `<option value="${c}">${c}</option>`).join("");
    if (categories.includes(selected)) catFilter.value = selected;
  }

  renderPOSCatalog();
  renderPOSCart();
  renderSuspendedCarts();
};

/**
 * Populate Customer Selection dropdown
 */
function populatePOSCustomerDropdown() {
  const select = document.getElementById("pos-customer-select");
  if (!select) return;

  const customers = window.appState.db.Customers || [];
  const activeCustomers = customers.filter(c => (c["Status"] || "Active") !== "Archived" && c["Customer ID"] !== "GENERIC");

  const currentVal = select.value;
  select.innerHTML = `<option value="GENERIC">عميل نقدي (عام)</option>` + 
    activeCustomers.map(c => `<option value="${c["Customer ID"]}">${c["Name"]} (${c["Phone Number"]})</option>`).join("");
  
  if (currentVal) select.value = currentVal;
}

/**
 * Render Catalog Items left panel
 */
function renderPOSCatalog() {
  const products = window.appState.db.Products || [];
  const query = document.getElementById("pos-product-search")?.value.toLowerCase().trim() || "";
  const category = document.getElementById("pos-category-filter")?.value || "All";

  const filtered = products.filter(p => {
    const isNotArchived = (p["Status"] || "Active") !== "Archived";
    const matchesCategory = category === "All" || p["Category"] === category;
    
    const matchesSearch = 
      (p["Product Name"] && String(p["Product Name"]).toLowerCase().includes(query)) ||
      (p["Product ID"] && String(p["Product ID"]).toLowerCase().includes(query)) ||
      (p["Barcode"] && String(p["Barcode"]).toLowerCase().includes(query)) ||
      (p["Supplier"] && String(p["Supplier"]).toLowerCase().includes(query));

    return isNotArchived && matchesCategory && matchesSearch;
  });

  const grid = document.getElementById("pos-catalog-grid");
  if (!grid) return;

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-8 text-center text-xs text-slate-400 bg-white border border-slate-200 rounded-xl">
        لم يتم العثور على منتجات تطابق البحث.
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const qty = parseFloat(p["Current Quantity"]) || 0;
    const minAlert = parseFloat(p["Minimum Quantity Alert"]) || 0;
    
    const isOutOfStock = qty <= 0;
    const clickHandler = isOutOfStock ? "" : `onclick="addProductToCart('${p["Product ID"]}')"`;
    
    let borderClass = "border-slate-200 hover:border-indigo-200 cursor-pointer";
    let bgClass = "bg-white";
    let statusLabel = "";

    if (qty === 0) {
      borderClass = "border-rose-100 opacity-60 cursor-not-allowed";
      bgClass = "bg-rose-50/20";
      statusLabel = `<span class="text-[9px] font-bold text-rose-600 uppercase bg-rose-50 px-1.5 py-0.5 rounded">نفد من المخزن</span>`;
    } else if (qty <= minAlert) {
      borderClass = "border-amber-200 hover:border-amber-400 cursor-pointer";
      bgClass = "bg-amber-50/10";
      statusLabel = `<span class="text-[9px] font-bold text-amber-600 uppercase bg-amber-50 px-1.5 py-0.5 rounded">منخفض: ${qty} قطع</span>`;
    } else {
      statusLabel = `<span class="text-[9px] text-slate-400">المتاح: ${qty}</span>`;
    }

    return `
      <div ${clickHandler} class="border ${borderClass} ${bgClass} rounded-xl p-4 flex flex-col justify-between transition-all select-none group">
        <div>
          <div class="flex items-start justify-between">
            <span class="text-[10px] text-indigo-500 font-semibold uppercase tracking-wider">${p["Category"]}</span>
            ${statusLabel}
          </div>
          <h4 class="font-bold text-xs text-slate-900 mt-1 line-clamp-2 text-right">${p["Product Name"]}</h4>
          ${p["Barcode"] ? `<p class="text-[9px] font-mono text-slate-400 mt-0.5 text-right">${p["Barcode"]}</p>` : ""}
        </div>
        <div class="flex items-center justify-between border-t border-slate-100 pt-3 mt-3">
          <span class="text-xs font-bold text-slate-800 font-mono">${formatCurrency(p["Selling Price"])}</span>
          ${isOutOfStock ? "" : `
            <span class="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            </span>
          `}
        </div>
      </div>
    `;
  }).join("");

  lucide.createIcons();
}

/**
 * Handle POS search changes (handles scanner triggers on exact match)
 */
function handlePOSSearch(e) {
  const query = e.target.value.trim();
  if (!query) {
    renderPOSCatalog();
    return;
  }

  const products = window.appState.db.Products || [];
  
  const matchedProd = products.find(p => p["Barcode"] === query && (p["Status"] || "Active") === "Active");
  if (matchedProd) {
    const qty = parseFloat(matchedProd["Current Quantity"]) || 0;
    if (qty > 0) {
      addProductToCart(matchedProd["Product ID"]);
      playBeep();
      e.target.value = "";
      renderPOSCatalog();
      showToast(`تم مسح الباركود وإضافة: ${matchedProd["Product Name"]}`, "success");
      return;
    } else {
      showToast(`المنتج الممسوح باركوده [${matchedProd["Product Name"]}] غير متوفر بالمخزن حالياً!`, "warning");
      e.target.value = "";
      return;
    }
  }

  renderPOSCatalog();
}

/**
 * Toggle Barcode Scanner listener UI
 */
function toggleBarcodeMode() {
  barcodeModeActive = !barcodeModeActive;
  const btn = document.getElementById("pos-barcode-mode-btn");
  const input = document.getElementById("pos-product-search");
  
  if (btn) {
    if (barcodeModeActive) {
      btn.innerHTML = `<i data-lucide="scan-line" class="w-3.5 h-3.5 text-white animate-pulse"></i> <span>وضع القارئ: نشط</span>`;
      btn.className = "flex items-center justify-center space-x-reverse space-x-1 py-2 px-3 border border-indigo-600 rounded-lg text-xs font-semibold text-white bg-indigo-600 shadow-md shadow-indigo-100 transition-all";
      input.placeholder = "وجه قارئ الباركود على المنتج...";
      input.focus();
    } else {
      btn.innerHTML = `<i data-lucide="scan-line" class="w-3.5 h-3.5 text-indigo-500"></i> <span>وضع القارئ: معطل</span>`;
      btn.className = "flex items-center justify-center space-x-reverse space-x-1 py-2 px-3 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 transition-all";
      input.placeholder = "ابحث باسم المنتج، كود، أو امسح الباركود...";
    }
  }
  lucide.createIcons();
}

/**
 * Add Product to Cart array
 */
window.addProductToCart = function(productId) {
  const prodObj = window.appState.db.Products.find(p => p["Product ID"] === productId);
  if (!prodObj) return;

  const maxQty = parseFloat(prodObj["Current Quantity"]) || 0;
  
  const cartIndex = posCart.findIndex(item => item.product["Product ID"] === productId);
  if (cartIndex !== -1) {
    const nextQty = posCart[cartIndex].quantity + 1;
    if (nextQty > maxQty) {
      showToast(`عذراً: تم الوصول للحد الأقصى المتاح بالمخزن للمنتج وهو (${maxQty} قطع).`, "warning");
      return;
    }
    posCart[cartIndex].quantity = nextQty;
    posCart[cartIndex].totalPrice = nextQty * parseFloat(prodObj["Selling Price"]);
  } else {
    if (maxQty <= 0) {
      showToast(`عذراً: المنتج غير متوفر بالمخزن حالياً.`, "warning");
      return;
    }
    posCart.push({
      product: prodObj,
      quantity: 1,
      totalPrice: parseFloat(prodObj["Selling Price"])
    });
  }

  renderPOSCart();
};

/**
 * Render POS Cart right panel
 */
function renderPOSCart() {
  const container = document.getElementById("pos-cart-items-container");
  if (!container) return;

  if (posCart.length === 0) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-2">
        <i data-lucide="shopping-bag" class="w-8 h-8 text-slate-300"></i>
        <p class="text-xs">سلة المبيعات فارغة حالياً.</p>
        <p class="text-[10px]">اختر منتجات من الكتالوج الجانبي لإضافتها</p>
      </div>
    `;
    document.getElementById("pos-checkout-btn").disabled = true;
    document.getElementById("pos-cart-count").textContent = "0";
    document.getElementById("pos-cart-total").textContent = formatCurrency(0);
    lucide.createIcons();
    return;
  }

  let cartTotal = 0;
  let itemsCount = 0;

  container.innerHTML = posCart.map((item, index) => {
    cartTotal += item.totalPrice;
    itemsCount += item.quantity;

    return `
      <div class="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs">
        <div class="flex-1 pl-3 text-right">
          <h5 class="font-bold text-slate-800 line-clamp-1">${item.product["Product Name"]}</h5>
          <span class="text-[10px] text-slate-400 font-medium font-mono">${formatCurrency(item.product["Selling Price"])} للوحدة</span>
        </div>
        <div class="flex items-center space-x-reverse space-x-3">
          <div class="flex items-center space-x-reverse space-x-1.5 bg-white border border-slate-200 rounded-lg p-0.5">
            <button onclick="changeCartItemQuantity(${index}, -1)" class="w-5 h-5 rounded flex items-center justify-center hover:bg-slate-100 font-bold text-slate-600">-</button>
            <span class="w-6 text-center font-bold text-slate-800 font-mono">${item.quantity}</span>
            <button onclick="changeCartItemQuantity(${index}, 1)" class="w-5 h-5 rounded flex items-center justify-center hover:bg-slate-100 font-bold text-slate-600">+</button>
          </div>
          <div class="w-20 text-left font-mono font-bold text-slate-900">
            <span>${formatCurrency(item.totalPrice)}</span>
          </div>
          <button onclick="removeCartItem(${index})" class="text-slate-400 hover:text-rose-500 transition-colors mr-2">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `;
  }).join("");

  document.getElementById("pos-checkout-btn").disabled = false;
  document.getElementById("pos-cart-count").textContent = itemsCount;
  document.getElementById("pos-cart-total").textContent = formatCurrency(cartTotal);

  lucide.createIcons();
}

/**
 * Modify Item Count inside cart
 */
window.changeCartItemQuantity = function(index, delta) {
  const item = posCart[index];
  const maxQty = parseFloat(item.product["Current Quantity"]) || 0;
  const newQty = item.quantity + delta;

  if (newQty <= 0) {
    removeCartItem(index);
    return;
  }

  if (newQty > maxQty) {
    showToast(`عذراً: تم تجاوز الحد المتاح للمنتج وهو (${maxQty} قطع).`, "warning");
    return;
  }

  posCart[index].quantity = newQty;
  posCart[index].totalPrice = newQty * parseFloat(item.product["Selling Price"]);
  renderPOSCart();
};

window.removeCartItem = function(index) {
  posCart.splice(index, 1);
  renderPOSCart();
};

window.clearPOSCart = function() {
  posCart = [];
  renderPOSCart();
};

/**
 * Open Checkout Payment sheet modal
 */
function openCheckoutPaymentModal() {
  const modal = document.getElementById("payment-modal");
  if (!modal) return;

  let total = 0;
  posCart.forEach(i => total += i.totalPrice);

  document.getElementById("pay-modal-total-label").textContent = formatCurrency(total);
  
  const discountInput = document.getElementById("pay-modal-discount");
  if (discountInput) discountInput.value = 0;
  
  const netLabel = document.getElementById("pay-modal-net-label");
  if (netLabel) netLabel.textContent = formatCurrency(total);

  const paidInput = document.getElementById("pay-modal-paid");
  
  paidInput.value = total;
  document.getElementById("pay-modal-remaining").value = 0;
  document.getElementById("pay-modal-notes").value = "";
  document.getElementById("pay-modal-method").value = "Cash";

  const dateInput = document.getElementById("pay-modal-date");
  if (dateInput) {
    dateInput.value = getLocalDateString();
  }

  // Populate customer list in modal checkout
  populatePayModalCustomerDropdown();
  
  // Hide and clean quick creation sub-form
  document.getElementById("pay-modal-quick-customer-form")?.classList.add("hidden");
  const custNameInput = document.getElementById("pay-modal-cust-name");
  const custPhoneInput = document.getElementById("pay-modal-cust-phone");
  if (custNameInput) custNameInput.value = "";
  if (custPhoneInput) custPhoneInput.value = "";

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeCheckoutPaymentModal() {
  const modal = document.getElementById("payment-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
}

/**
 * Calculates remaining credit debts inline
 */
function recalculateCheckoutPaymentBalances() {
  let total = 0;
  posCart.forEach(i => total += i.totalPrice);

  const discount = parseFloat(document.getElementById("pay-modal-discount")?.value) || 0;
  const net = Math.max(0, total - discount);

  const netLabel = document.getElementById("pay-modal-net-label");
  if (netLabel) {
    netLabel.textContent = formatCurrency(net);
  }

  const paid = parseFloat(document.getElementById("pay-modal-paid").value) || 0;
  const remaining = Math.max(0, net - paid);

  const remInput = document.getElementById("pay-modal-remaining");
  remInput.value = remaining.toFixed(2);

  if (remaining > 0) {
    remInput.classList.remove("text-emerald-500");
    remInput.classList.add("text-rose-500");
  } else {
    remInput.classList.remove("text-rose-500");
    remInput.classList.add("text-emerald-500");
  }
}

/**
 * Populates customer list inside checkout modal
 */
function populatePayModalCustomerDropdown() {
  const select = document.getElementById("pay-modal-customer-select");
  if (!select) return;

  const customers = window.appState.db.Customers || [];
  const activeCustomers = customers.filter(c => (c["Status"] || "Active") !== "Archived" && c["Customer ID"] !== "GENERIC");

  // Default to what cashier selected on the catalog side
  const currentCatalogSelect = document.getElementById("pos-customer-select")?.value || "GENERIC";

  select.innerHTML = `<option value="GENERIC">عميل نقدي (عام)</option>` + 
    activeCustomers.map(c => `<option value="${c["Customer ID"]}">${c["Name"]} (${c["Phone Number"]})</option>`).join("");
  
  select.value = currentCatalogSelect;
}

/**
 * Save new customer profile inline inside checkout sheet
 */
async function saveQuickCustomerFromCheckout() {
  const name = document.getElementById("pay-modal-cust-name").value.trim();
  const phone = document.getElementById("pay-modal-cust-phone").value.trim();

  if (!name || !phone) {
    showToast("برجاء كتابة اسم العميل ورقم الهاتف.", "warning");
    return;
  }

  const customerId = generateId("CUST");
  const payload = {
    "Customer ID": customerId,
    "Name": name,
    "Phone Number": phone,
    "Address": "",
    "Total Purchases": 0,
    "Outstanding Balance": 0,
    "Status": "Active"
  };

  showLoader("جاري حفظ العميل الجديد...");
  try {
    await api.saveCustomer(payload);
    
    // Hide form
    document.getElementById("pay-modal-quick-customer-form").classList.add("hidden");
    document.getElementById("pay-modal-cust-name").value = "";
    document.getElementById("pay-modal-cust-phone").value = "";

    showToast(`تم تسجيل حساب العميل [${name}] بنجاح`, "success");
    
    // Reload state and sync options
    await api.syncData();
    populatePOSCustomerDropdown();
    populatePayModalCustomerDropdown();
    
    // Set selected to newly created
    document.getElementById("pay-modal-customer-select").value = customerId;
  } catch (error) {
    showToast(`فشل التسجيل السريع للعميل: ${error.message}`, "error");
  } finally {
    hideLoader();
  }
}

/**
 * Complete Checkout Transaction
 */
async function finalizePOSOrder(shouldPrint = true) {
  const customerId = document.getElementById("pay-modal-customer-select").value;
  const paymentMethod = document.getElementById("pay-modal-method").value;
  const paidAmount = parseFloat(document.getElementById("pay-modal-paid").value) || 0;
  const notes = document.getElementById("pay-modal-notes").value.trim();
  const invoiceDate = document.getElementById("pay-modal-date")?.value || getLocalDateString();

  let totalAmount = 0;
  posCart.forEach(item => totalAmount += item.totalPrice);

  const discountAmount = parseFloat(document.getElementById("pay-modal-discount")?.value) || 0;
  const remainingAmount = Math.max(0, totalAmount - discountAmount - paidAmount);
  
  if (customerId === "GENERIC" && remainingAmount > 0) {
    showToast("تنبيه: لا يمكن البيع بالآجل للعملاء النقديين المجهولين. يرجى اختيار حساب العميل أو تسجيل حساب جديد لتسجيل الدين.", "warning");
    return;
  }

  let status = "Paid";
  if (remainingAmount > 0) {
    status = paidAmount === 0 ? "Unpaid" : "Partially Paid";
  }

  let statusLocalized = "Paid";
  if (status === "Paid") statusLocalized = "Paid";
  else if (status === "Partially Paid") statusLocalized = "Partially Paid";
  else statusLocalized = "Unpaid";

  let customerName = "عميل نقدي (عام)";
  if (customerId !== "GENERIC") {
    const custObj = window.appState.db.Customers.find(c => c["Customer ID"] === customerId);
    customerName = custObj ? custObj["Name"] : "عميل مجهول";
  }

  const nextInvoiceNumber = "INV-" + Math.floor(10000 + Math.random() * 90000);

  const invoice = {
    "Invoice Number": nextInvoiceNumber,
    "Customer ID": customerId,
    "Customer Name": customerName,
    "Invoice Date": invoiceDate,
    "Total Amount": totalAmount,
    "Paid Amount": paidAmount,
    "Remaining Amount": remainingAmount,
    "Payment Method": paymentMethod,
    "Status": statusLocalized,
    "Notes": notes,
    "Discount": discountAmount
  };

  const invoiceItems = posCart.map(item => {
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

  const loaderMsg = shouldPrint 
    ? "جاري تسجيل المعاملة المالية وإصدار الفاتورة للطباعة..." 
    : "جاري حفظ الفاتورة بالخلفية...";
  showLoader(loaderMsg);

  try {
    await api.saveInvoice(invoice, invoiceItems);
    closeCheckoutPaymentModal();
    
    if (shouldPrint) {
      printInvoice(invoice, invoiceItems);
    }

    posCart = [];
    renderPOSCart();
    showToast("تم تسجيل المعاملة وحفظ الفاتورة بنجاح!", "success");
    
    if (!api.isMockMode) {
      await api.syncData();
    }
  } catch (error) {
    showToast(`فشل إتمام العملية: ${error.message}`, "error");
  } finally {
    hideLoader();
  }
}

/**
 * Populates print section overlay and triggers browser window printer
 */
function printInvoice(invoice, items) {
  const printSection = document.getElementById("print-section");
  if (!printSection) return;

  document.getElementById("print-biz-name").textContent = window.appState.settings.businessName;
  document.getElementById("print-biz-address").textContent = window.appState.settings.address || "القاهرة، مصر";
  document.getElementById("print-biz-phone").textContent = window.appState.settings.phone ? `الهاتف: ${window.appState.settings.phone}` : "";

  document.getElementById("print-inv-number").textContent = invoice["Invoice Number"];
  document.getElementById("print-inv-date").textContent = `التاريخ: ${invoice["Invoice Date"]}`;

  document.getElementById("print-cust-name").textContent = invoice["Customer Name"];
  let custPhone = "-";
  if (invoice["Customer ID"] !== "GENERIC") {
    const c = window.appState.db.Customers.find(cust => cust["Customer ID"] === invoice["Customer ID"]);
    if (c) custPhone = c["Phone Number"];
  }
  document.getElementById("print-cust-phone").textContent = `الهاتف: ${custPhone}`;

  // Localize Payment Method labels
  let methodAr = invoice["Payment Method"];
  if (methodAr === "Cash") methodAr = "كاش (نقدي)";
  else if (methodAr === "Vodafone Cash") methodAr = "فودافون كاش";
  else if (methodAr === "InstaPay") methodAr = "إنستاباي";
  else if (methodAr === "Bank Transfer") methodAr = "تحويل بنكي";

  document.getElementById("print-payment-method").textContent = `طريقة الدفع: ${methodAr}`;
  
  const statusBadge = document.getElementById("print-payment-status");
  
  // Status translation
  let statusLabel = "غير مدفوع";
  if (invoice["Status"] === "Paid") statusLabel = "مدفوع بالكامل";
  else if (invoice["Status"] === "Partially Paid") statusLabel = "مدفوع جزئياً";
  
  statusBadge.textContent = statusLabel;
  statusBadge.className = "inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ";
  if (invoice["Status"] === "Paid") {
    statusBadge.classList.add("bg-emerald-50", "text-emerald-700", "border-emerald-100");
  } else if (invoice["Status"] === "Partially Paid") {
    statusBadge.classList.add("bg-amber-50", "text-amber-700", "border-amber-100");
  } else {
    statusBadge.classList.add("bg-rose-50", "text-rose-700", "border-rose-100");
  }

  const tbody = document.getElementById("print-items-body");
  tbody.innerHTML = items.map(item => {
    return `
      <tr>
        <td class="py-2.5 px-3 text-right">
          <div class="font-bold text-slate-800">${item["Product Name"]}</div>
          <span class="text-[9px] text-slate-400 font-mono">${item["Product ID"]}</span>
        </td>
        <td class="py-2.5 px-3 text-left font-mono">${formatCurrency(item["Selling Price"])}</td>
        <td class="py-2.5 px-3 text-center font-mono">${item["Quantity"]}</td>
        <td class="py-2.5 px-3 text-left font-bold text-slate-900 font-mono">${formatCurrency(item["Total Price"])}</td>
      </tr>
    `;
  }).join("");

  document.getElementById("print-subtotal").textContent = formatCurrency(invoice["Total Amount"]);
  
  const discountVal = parseFloat(invoice["Discount"]) || 0;
  const discountRow = document.getElementById("print-discount-container");
  if (discountRow) {
    if (discountVal > 0) {
      discountRow.classList.remove("hidden");
      document.getElementById("print-discount").textContent = formatCurrency(discountVal);
    } else {
      discountRow.classList.add("hidden");
    }
  }

  document.getElementById("print-paid").textContent = formatCurrency(invoice["Paid Amount"]);
  document.getElementById("print-due").textContent = formatCurrency(invoice["Remaining Amount"]);

  printSection.classList.remove("hidden");

  setTimeout(() => {
    window.print();
  }, 300);
}

/**
 * Re-prints a historical invoice looking up data from the cache
 */
window.printInvoiceFromHistory = function(invoiceNumber) {
  const invoices = window.appState.db.Invoices || [];
  const invoice = invoices.find(i => i["Invoice Number"] === invoiceNumber);
  if (!invoice) {
    showToast(`عذراً: لم نجد فاتورة بالرقم: ${invoiceNumber}`, "error");
    return;
  }

  const invoiceItems = window.appState.db.InvoiceItems || [];
  const items = invoiceItems.filter(item => item["Invoice Number"] === invoiceNumber);

  printInvoice(invoice, items);
};

// Expose printInvoice globally for CRM invoice checkouts
window.printInvoice = printInvoice;

/**
 * Plays a short, high-pitched beep sound using Web Audio API
 */
function playBeep() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime); // 800 Hz pitch
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime); // moderate volume
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1); // fade out quickly over 100ms
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  } catch (error) {
    console.warn("Could not play audio beep:", error);
  }
}

// Initialize suspended carts list in appState if not defined
if (!window.appState.suspendedCarts) {
  try {
    const saved = localStorage.getItem("elbaz_suspended_carts");
    window.appState.suspendedCarts = saved ? JSON.parse(saved) : [];
  } catch (e) {
    window.appState.suspendedCarts = [];
  }
}

/**
 * Suspends the active POS cart and saves it to localStorage
 */
function suspendActiveCart() {
  if (!posCart || posCart.length === 0) {
    showToast("السلة فارغة حالياً ولا يمكن تعليقها!", "warning");
    return;
  }

  const defaultName = `سلة #${window.appState.suspendedCarts.length + 1} (${new Date().toLocaleTimeString("ar-EG", { hour: '2-digit', minute: '2-digit' })})`;
  const nameOfCart = prompt("برجاء إدخال اسم أو رقم السلة المعلقة للانتظار:", defaultName);
  
  if (nameOfCart === null) {
    return; // Cancelled by user
  }

  const cartName = nameOfCart.trim() || defaultName;
  const customerSelect = document.getElementById("pos-customer-select");
  const customerId = customerSelect ? customerSelect.value : "GENERIC";
  const customerName = customerSelect ? (customerSelect.options[customerSelect.selectedIndex]?.text || "عميل نقدي (عام)") : "عميل نقدي (عام)";
  const totalAmount = posCart.reduce((sum, item) => sum + (parseFloat(item.totalPrice) || 0), 0);

  const suspendedCart = {
    id: Date.now(),
    name: cartName,
    timestamp: new Date().toLocaleString("ar-EG"),
    cart: [...posCart],
    customerId: customerId,
    customerName: customerName,
    totalAmount: totalAmount
  };

  window.appState.suspendedCarts.push(suspendedCart);
  localStorage.setItem("elbaz_suspended_carts", JSON.stringify(window.appState.suspendedCarts));
  
  // Clear current cart and reset customer selection
  posCart = [];
  if (customerSelect) {
    customerSelect.value = "GENERIC";
  }

  renderPOSCart();
  renderPOSCatalog();
  renderSuspendedCarts();
  showToast(`تم تعليق السلة [${cartName}] بنجاح`, "success");
}

/**
 * Renders suspended/held carts in the right-side POS panel
 */
function renderSuspendedCarts() {
  const container = document.getElementById("pos-suspended-carts-container");
  const list = document.getElementById("pos-suspended-carts-list");
  if (!container || !list) return;

  const carts = window.appState.suspendedCarts || [];
  if (carts.length === 0) {
    container.classList.add("hidden");
    list.innerHTML = "";
    return;
  }

  container.classList.remove("hidden");
  list.innerHTML = carts.map(c => `
    <div class="flex items-center justify-between bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/40 p-2 rounded-lg text-xs hover:border-amber-300 dark:hover:border-amber-800 transition-all">
      <div class="flex flex-col text-right col-span-2">
        <span class="font-bold text-slate-800 dark:text-slate-200">${c.name}</span>
        <span class="text-[10px] text-slate-400 dark:text-slate-500">${c.cart.length} أصناف • ${formatCurrency(c.totalAmount)}</span>
      </div>
      <div class="flex space-x-reverse space-x-1.5">
        <button onclick="restoreSuspendedCart(${c.id})" class="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[10px] rounded-md font-bold transition-colors" title="استعادة السلة">استعادة</button>
        <button onclick="deleteSuspendedCart(${c.id})" class="p-1 text-rose-500 hover:bg-rose-550 dark:hover:bg-rose-950/30 rounded transition-colors" title="حذف">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
        </button>
      </div>
    </div>
  `).join("");
}

/**
 * Restores a suspended cart into the active POS cart
 */
window.restoreSuspendedCart = function(id) {
  const carts = window.appState.suspendedCarts || [];
  const foundIndex = carts.findIndex(c => c.id === id);
  if (foundIndex === -1) return;

  if (posCart && posCart.length > 0) {
    const confirmReplace = confirm("هل تريد استعادة هذه السلة؟ سيتم استبدال المنتجات الموجودة حالياً في السلة.");
    if (!confirmReplace) return;
  }

  const selectedCart = carts[foundIndex];
  posCart = [...selectedCart.cart];

  const customerSelect = document.getElementById("pos-customer-select");
  if (customerSelect) {
    customerSelect.value = selectedCart.customerId || "GENERIC";
  }

  // Remove from suspended list
  carts.splice(foundIndex, 1);
  localStorage.setItem("elbaz_suspended_carts", JSON.stringify(carts));

  renderPOSCart();
  renderPOSCatalog();
  renderSuspendedCarts();
  showToast(`تم استعادة السلة [${selectedCart.name}] بنجاح`, "success");
};

/**
 * Deletes a suspended cart from localStorage list
 */
window.deleteSuspendedCart = function(id) {
  const carts = window.appState.suspendedCarts || [];
  const foundIndex = carts.findIndex(c => c.id === id);
  if (foundIndex === -1) return;

  const confirmDelete = confirm("هل أنت متأكد من حذف هذه السلة المعلقة نهائياً؟");
  if (!confirmDelete) return;

  const deletedName = carts[foundIndex].name;
  carts.splice(foundIndex, 1);
  localStorage.setItem("elbaz_suspended_carts", JSON.stringify(carts));

  renderSuspendedCarts();
  showToast(`تم حذف السلة [${deletedName}]`, "info");
};
