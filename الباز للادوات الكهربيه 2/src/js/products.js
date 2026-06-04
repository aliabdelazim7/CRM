/**
 * Products Module - Localized to Arabic
 * Manages Product CRUD operations, catalog pagination, filtering, and CSV export
 */

// Pagination variables
let prodCurrentPage = 1;
const prodPageSize = 10;

// Setup event listeners once on file script load
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("product-form");
  if (form) {
    form.addEventListener("submit", handleProductFormSubmit);
  }

  document.getElementById("prod-add-new-btn")?.addEventListener("click", () => openProductModal());
  document.getElementById("product-modal-close")?.addEventListener("click", closeProductModal);
  document.getElementById("prod-form-cancel")?.addEventListener("click", closeProductModal);

  document.getElementById("prod-search")?.addEventListener("input", () => {
    prodCurrentPage = 1;
    renderProducts();
  });
  document.getElementById("prod-filter-category")?.addEventListener("change", () => {
    prodCurrentPage = 1;
    renderProducts();
  });
  document.getElementById("prod-filter-stock")?.addEventListener("change", () => {
    prodCurrentPage = 1;
    renderProducts();
  });

  document.getElementById("prod-prev-page-btn")?.addEventListener("click", () => {
    if (prodCurrentPage > 1) {
      prodCurrentPage--;
      renderProducts();
    }
  });
  document.getElementById("prod-next-page-btn")?.addEventListener("click", () => {
    prodCurrentPage++;
    renderProducts();
  });

  document.getElementById("prod-export-csv-btn")?.addEventListener("click", exportProductsToCSV);

  document.getElementById("prod-manage-categories-btn")?.addEventListener("click", () => {
    document.getElementById("categories-modal")?.classList.remove("hidden");
    document.getElementById("categories-modal")?.classList.add("flex");
    renderCategoriesModalList();
  });
  document.getElementById("categories-modal-close")?.addEventListener("click", () => {
    document.getElementById("categories-modal")?.classList.add("hidden");
    document.getElementById("categories-modal")?.classList.remove("flex");
  });
  document.getElementById("categories-add-btn")?.addEventListener("click", handleAddCategorySubmit);
  document.getElementById("categories-new-input")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      handleAddCategorySubmit();
    }
  });
});

/**
 * Main Product Module Renderer
 */
window.renderProducts = function() {
  const products = window.appState.db.Products || [];
  
  populateCategoryFilters(products);

  const searchQuery = document.getElementById("prod-search")?.value.toLowerCase().trim() || "";
  const categoryFilter = document.getElementById("prod-filter-category")?.value || "All";
  const stockFilter = document.getElementById("prod-filter-stock")?.value || "All";

  let filtered = products.filter(p => {
    const isNotArchived = (p["Status"] || "Active") !== "Archived";
    
    const matchesSearch = 
      (p["Product Name"] && String(p["Product Name"]).toLowerCase().includes(searchQuery)) ||
      (p["Product ID"] && String(p["Product ID"]).toLowerCase().includes(searchQuery)) ||
      (p["Supplier"] && String(p["Supplier"]).toLowerCase().includes(searchQuery));
    
    const matchesCategory = categoryFilter === "All" || p["Category"] === categoryFilter;

    const qty = parseFloat(p["Current Quantity"]) || 0;
    const minAlert = parseFloat(p["Minimum Quantity Alert"]) || 0;
    let stockStatus = "Available";
    if (qty === 0) {
      stockStatus = "Out Of Stock";
    } else if (qty <= minAlert) {
      stockStatus = "Low Stock";
    }

    const matchesStock = stockFilter === "All" || 
      (stockFilter === "Available" && stockStatus === "Available") ||
      (stockFilter === "Low Stock" && stockStatus === "Low Stock") ||
      (stockFilter === "Out Of Stock" && stockStatus === "Out Of Stock");

    return isNotArchived && matchesSearch && matchesCategory && matchesStock;
  });

  filtered.sort((a, b) => new Date(b["Creation Date"]) - new Date(a["Creation Date"]));

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / prodPageSize) || 1;
  if (prodCurrentPage > totalPages) prodCurrentPage = totalPages;

  const startIndex = (prodCurrentPage - 1) * prodPageSize;
  const endIndex = Math.min(startIndex + prodPageSize, totalItems);
  const paginated = filtered.slice(startIndex, endIndex);

  const prevBtn = document.getElementById("prod-prev-page-btn");
  const nextBtn = document.getElementById("prod-next-page-btn");
  const infoText = document.getElementById("prod-pagination-info");

  if (prevBtn) prevBtn.disabled = prodCurrentPage === 1;
  if (nextBtn) nextBtn.disabled = prodCurrentPage === totalPages;
  if (infoText) infoText.textContent = totalItems > 0 
    ? `عرض ${startIndex + 1} - ${endIndex} من إجمالي ${totalItems} منتج` 
    : "عرض 0 منتج";

  const tbody = document.getElementById("products-table-body");
  if (!tbody) return;

  if (paginated.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="py-8 text-center text-xs text-slate-400 font-medium">
          لم يتم العثور على منتجات مطابقة للبحث أو الفلتر المختار.
        </td>
      </tr>
    `;
    return;
  }

  const invoiceItems = window.appState.db.InvoiceItems || [];

  tbody.innerHTML = paginated.map(p => {
    const qty = parseFloat(p["Current Quantity"]) || 0;
    const minAlert = parseFloat(p["Minimum Quantity Alert"]) || 0;
    const profit = parseFloat(p["Profit Per Unit"]) || 0;

    // Calculate total sold units and total profit dynamically
    const prodItems = invoiceItems.filter(item => item["Product ID"] === p["Product ID"]);
    const unitsSold = prodItems.reduce((sum, item) => sum + (parseFloat(item["Quantity"]) || 0), 0);
    const totalProfitVal = prodItems.reduce((sum, item) => {
      const sell = parseFloat(item["Selling Price"]) || 0;
      const cost = parseFloat(item["Purchase Price"]) || 0;
      const q = parseFloat(item["Quantity"]) || 0;
      return sum + (sell - cost) * q;
    }, 0);
    
    let stockBadgeClass, stockStatusText;
    if (qty === 0) {
      stockBadgeClass = "bg-rose-50 text-rose-700 border-rose-100";
      stockStatusText = "نفد من المخزن";
    } else if (qty <= minAlert) {
      stockBadgeClass = "bg-amber-50 text-amber-700 border-amber-100";
      stockStatusText = `حرِج: ${qty} وحدات`;
    } else {
      stockBadgeClass = "bg-emerald-50 text-emerald-700 border-emerald-100";
      stockStatusText = `متوفر: ${qty} وحدات`;
    }

    // State Translation
    let statusText = p["Status"] === "Active" ? "نشط" : p["Status"] || "نشط";

    return `
      <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs">
        <td class="py-3 px-6 font-mono font-bold text-slate-600">${p["Product ID"]}</td>
        <td class="py-3 px-6 text-right">
          <div class="font-bold text-slate-900">${p["Product Name"]}</div>
        </td>
        <td class="py-3 px-6 text-slate-500 text-right">${p["Category"]}</td>
        <td class="py-3 px-6 text-slate-500 text-right">${p["Supplier"] || "-"}</td>
        <td class="py-3 px-6 text-left font-mono font-medium">${formatCurrency(p["Purchase Price"])}</td>
        <td class="py-3 px-6 text-left font-mono font-bold text-slate-900">${formatCurrency(p["Selling Price"])}</td>
        <td class="py-3 px-6 text-left font-mono font-medium text-emerald-600">+${formatCurrency(profit)}</td>
        <td class="py-3 px-6 text-center font-mono font-bold text-slate-800">${unitsSold} وحدات</td>
        <td class="py-3 px-6 text-left font-mono font-bold text-indigo-600">${formatCurrency(totalProfitVal)}</td>
        <td class="py-3 px-6 text-center">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${stockBadgeClass}">
            ${stockStatusText}
          </span>
        </td>
        <td class="py-3 px-6 text-right">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700">${statusText}</span>
        </td>
        <td class="py-3 px-6 text-center">
          <div class="flex items-center justify-center space-x-reverse space-x-1">
            <button onclick="openProductModal('${p["Product ID"]}')" class="p-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-100" title="تعديل المنتج">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="archiveProduct('${p["Product ID"]}')" class="p-1 border border-slate-200 rounded text-rose-600 hover:bg-rose-50" title="أرشفة المنتج">
              <i data-lucide="archive" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  lucide.createIcons();
};

function getCustomCategories() {
  try {
    const saved = localStorage.getItem("elbaz_custom_categories");
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
}

function saveCustomCategories(categories) {
  localStorage.setItem("elbaz_custom_categories", JSON.stringify(categories));
}

/**
 * Sync Unique Categories into Selection filtering and Form Autocompletion
 */
function populateCategoryFilters(products) {
  const activeProds = products.filter(p => (p["Status"] || "Active") !== "Archived");
  const customCategories = getCustomCategories();
  const categories = [...new Set([
    ...activeProds.map(p => p["Category"]).filter(Boolean),
    ...customCategories
  ])];

  const categoryFilter = document.getElementById("prod-filter-category");
  if (categoryFilter) {
    const selected = categoryFilter.value;
    categoryFilter.innerHTML = `<option value="All">جميع الأقسام</option>` + 
      categories.map(c => `<option value="${c}">${c}</option>`).join("");
    if (categories.includes(selected)) {
      categoryFilter.value = selected;
    } else {
      categoryFilter.value = "All";
    }
  }

  const datalist = document.getElementById("categories-datalist");
  if (datalist) {
    datalist.innerHTML = categories.map(c => `<option value="${c}"></option>`).join("");
  }
}

/**
 * Handle form submission
 */
async function handleProductFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById("prod-form-id").value;
  const name = document.getElementById("prod-form-name").value.trim();
  const category = document.getElementById("prod-form-category").value.trim();
  const supplier = document.getElementById("prod-form-supplier").value.trim();
  const purchasePrice = parseFloat(document.getElementById("prod-form-cost").value) || 0;
  const sellingPrice = parseFloat(document.getElementById("prod-form-sell").value) || 0;
  const currentQuantity = parseFloat(document.getElementById("prod-form-qty").value) || 0;
  const minQtyAlert = parseFloat(document.getElementById("prod-form-min").value) || 0;
  const barcode = document.getElementById("prod-form-barcode").value.trim();
  const description = document.getElementById("prod-form-desc").value.trim();

  if (sellingPrice < purchasePrice) {
    showToast("تنبيه: يجب أن يكون سعر البيع أعلى من سعر الشراء لتجنب الخسارة.", "warning");
    return;
  }

  const payload = {
    "Product ID": id,
    "Product Name": name,
    "Category": category,
    "Supplier": supplier,
    "Purchase Price": purchasePrice,
    "Selling Price": sellingPrice,
    "Current Quantity": currentQuantity,
    "Minimum Quantity Alert": minQtyAlert,
    "Barcode": barcode,
    "Description": description,
    "Status": "Active"
  };

  showLoader("جاري حفظ المنتج...");
  try {
    await api.saveProduct(payload);
    closeProductModal();
    showToast(`تم حفظ المنتج [${name}] بنجاح في قاعدة البيانات`, "success");
    if (!api.isMockMode) {
      await api.syncData();
    }
  } catch (error) {
    showToast(`فشل حفظ المنتج: ${error.message}`, "error");
  } finally {
    hideLoader();
  }
}

/**
 * Open Modal Form
 */
window.openProductModal = function(productId = null) {
  const modal = document.getElementById("product-modal");
  const form = document.getElementById("product-form");
  const title = document.getElementById("product-modal-title");
  
  if (!modal || !form) return;

  form.reset();

  if (productId) {
    title.textContent = "تعديل بيانات المنتج الحالية";
    const prodObj = window.appState.db.Products.find(p => p["Product ID"] === productId);
    if (prodObj) {
      document.getElementById("prod-form-id").value = prodObj["Product ID"];
      document.getElementById("prod-form-barcode").value = prodObj["Barcode"] || "";
      document.getElementById("prod-form-name").value = prodObj["Product Name"];
      document.getElementById("prod-form-category").value = prodObj["Category"];
      document.getElementById("prod-form-supplier").value = prodObj["Supplier"] || "";
      document.getElementById("prod-form-cost").value = prodObj["Purchase Price"];
      document.getElementById("prod-form-sell").value = prodObj["Selling Price"];
      document.getElementById("prod-form-qty").value = prodObj["Current Quantity"];
      document.getElementById("prod-form-min").value = prodObj["Minimum Quantity Alert"];
      document.getElementById("prod-form-desc").value = prodObj["Description"] || "";
    }
  } else {
    title.textContent = "إضافة منتج جديد للمخزن";
    document.getElementById("prod-form-id").value = generateId("PROD");
    document.getElementById("prod-form-qty").value = 0;
    document.getElementById("prod-form-min").value = 10;
  }

  modal.classList.remove("hidden");
  modal.classList.add("flex");
};

window.closeProductModal = function() {
  const modal = document.getElementById("product-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
};

/**
 * Archive a product
 */
window.archiveProduct = async function(productId) {
  const prodObj = window.appState.db.Products.find(p => p["Product ID"] === productId);
  if (!prodObj) return;

  const confirmed = confirm(`هل أنت متأكد من أرشفة المنتج: ${prodObj["Product Name"]}؟\nسيتم الاحتفاظ بفواتير هذا المنتج مسجلة في النظام مع استبعاده تماماً من قوائم الجرد والبيع الجديدة.`);
  if (!confirmed) return;

  showLoader("جاري أرشفة المنتج...");
  try {
    const updatedProd = { ...prodObj, Status: "Archived" };
    await api.saveProduct(updatedProd);
    showToast("تم أرشفة المنتج بنجاح", "success");
    if (!api.isMockMode) {
      await api.syncData();
    }
  } catch (error) {
    showToast(`فشلت عملية الأرشفة: ${error.message}`, "error");
  } finally {
    hideLoader();
  }
};

/**
 * Exports products data as a CSV download file
 */
function exportProductsToCSV() {
  const products = window.appState.db.Products || [];
  const activeProds = products.filter(p => (p["Status"] || "Active") !== "Archived");

  if (activeProds.length === 0) {
    showToast("لا توجد منتجات متاحة للتصدير حالياً.", "warning");
    return;
  }

  // Translated headers for Egyptian users
  const headers = ["كود المنتج", "اسم المنتج", "القسم", "المورد", "سعر الشراء", "سعر البيع", "الربح لكل وحدة", "الكمية الحالية", "حد التنبيه", "الباركود", "تاريخ الإضافة"];
  const dbFields = ["Product ID", "Product Name", "Category", "Supplier", "Purchase Price", "Selling Price", "Profit Per Unit", "Current Quantity", "Minimum Quantity Alert", "Barcode", "Creation Date"];
  
  const csvRows = [];
  csvRows.push("\ufeff" + headers.join(",")); // UTF-8 BOM for Excel Arabic layout

  activeProds.forEach(p => {
    const row = dbFields.map(field => {
      let val = p[field];
      if (val === undefined || val === null) val = "";
      
      const valStr = String(val).replace(/"/g, '""');
      if (valStr.includes(",") || valStr.includes("\n") || valStr.includes('"')) {
        return `"${valStr}"`;
      }
      return valStr;
    });
    csvRows.push(row.join(","));
  });

  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `تقرير_المنتجات_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Render list of categories inside Categories Manager modal
 */
function renderCategoriesModalList() {
  const container = document.getElementById("categories-list-container");
  if (!container) return;

  const products = window.appState.db.Products || [];
  const activeProds = products.filter(p => (p["Status"] || "Active") !== "Archived");
  const customCategories = getCustomCategories();
  
  // Union of all categories
  const categories = [...new Set([
    ...activeProds.map(p => p["Category"]).filter(Boolean),
    ...customCategories
  ])].sort();

  if (categories.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4 text-xs text-slate-400">
        لا توجد أقسام مسجلة حالياً.
      </div>
    `;
    return;
  }

  container.innerHTML = categories.map(cat => {
    const count = activeProds.filter(p => p["Category"] === cat).length;
    const deleteBtnHtml = count > 0 
      ? `<span class="text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded-full">نشط: ${count} منتج</span>`
      : `<button onclick="deleteCategory('${cat}')" class="text-rose-500 hover:bg-rose-50 p-1.5 rounded transition-all" title="حذف القسم">
           <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
         </button>`;

    return `
      <div class="flex items-center justify-between bg-white border border-slate-200/80 p-2 rounded-lg text-xs hover:border-slate-300 transition-all">
        <span class="font-bold text-slate-700">${cat}</span>
        <div class="flex items-center space-x-reverse space-x-1.5">
          ${deleteBtnHtml}
        </div>
      </div>
    `;
  }).join("");

  lucide.createIcons();
}

/**
 * Handle new category form addition
 */
function handleAddCategorySubmit() {
  const input = document.getElementById("categories-new-input");
  if (!input) return;

  const newCat = input.value.trim();
  if (!newCat) {
    showToast("خطأ: برجاء إدخال اسم القسم أولاً!", "warning");
    return;
  }

  const products = window.appState.db.Products || [];
  const activeProds = products.filter(p => (p["Status"] || "Active") !== "Archived");
  const customCategories = getCustomCategories();
  
  const categories = [...new Set([
    ...activeProds.map(p => p["Category"]).filter(Boolean),
    ...customCategories
  ])];

  if (categories.some(c => c.toLowerCase() === newCat.toLowerCase())) {
    showToast("تنبيه: هذا القسم مسجل بالفعل في النظام!", "warning");
    return;
  }

  customCategories.push(newCat);
  saveCustomCategories(customCategories);
  input.value = "";

  renderCategoriesModalList();
  populateCategoryFilters(products);
  if (typeof window.renderPOS === "function") {
    window.renderPOS();
  }
  showToast(`تم إضافة القسم [${newCat}] بنجاح`, "success");
}

/**
 * Delete a custom category if it has no products
 */
window.deleteCategory = function(catName) {
  const confirmDelete = confirm(`هل تريد بالتأكيد حذف القسم [${catName}]؟`);
  if (!confirmDelete) return;

  let customCategories = getCustomCategories();
  customCategories = customCategories.filter(c => c !== catName);
  saveCustomCategories(customCategories);

  renderCategoriesModalList();
  populateCategoryFilters(window.appState.db.Products);
  if (typeof window.renderPOS === "function") {
    window.renderPOS();
  }
  showToast(`تم حذف القسم [${catName}] بنجاح`, "info");
};
