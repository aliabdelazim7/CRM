/**
 * Sales, Inventory, CRM, Invoicing & Analytics System
 * Backend Google Apps Script
 * Paste this code inside Google Sheets -> Extensions -> Apps Script
 */

// Define the required sheets and their default headers
const SHEETS_SCHEMA = {
  "Products": [
    "Product ID", "Product Name", "Category", "Supplier", "Purchase Price", 
    "Selling Price", "Profit Per Unit", "Current Quantity", "Minimum Quantity Alert", 
    "Barcode", "Description", "Creation Date", "Status"
  ],
  "Customers": [
    "Customer ID", "Name", "Phone Number", "Address", "Total Purchases", 
    "Outstanding Balance", "Status"
  ],
  "Archive_Customers": [
    "Customer ID", "Name", "Phone Number", "Address", "Total Purchases", 
    "Outstanding Balance", "Status", "Archive Date"
  ],
  "Invoices": [
    "Invoice Number", "Customer ID", "Customer Name", "Invoice Date", 
    "Total Amount", "Paid Amount", "Remaining Amount", "Payment Method", 
    "Status", "Notes", "Discount"
  ],
  "InvoiceItems": [
    "Item ID", "Invoice Number", "Product ID", "Product Name", 
    "Quantity", "Purchase Price", "Selling Price", "Total Price"
  ],
  "Expenses": [
    "Expense ID", "Date", "Category", "Amount", "Notes"
  ],
  "Settings": [
    "Key", "Value"
  ]
};

// Initial Setup function: Creates sheets and sets up headers if they don't exist
function initializeDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  for (const sheetName in SHEETS_SCHEMA) {
    let sheet = ss.getSheetByName(sheetName);
    const headers = SHEETS_SCHEMA[sheetName];
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      // Format headers
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f4f6");
      sheet.setFrozenRows(1);
    } else {
      // Ensure missing headers are appended automatically
      const lastCol = sheet.getLastColumn();
      if (lastCol < headers.length) {
        sheet.getRange(1, lastCol + 1, 1, headers.length - lastCol)
             .setValues([headers.slice(lastCol)])
             .setFontWeight("bold").setBackground("#f3f4f6");
      }
    }
  }
  
  // Set default settings if Settings sheet is empty
  const settingsSheet = ss.getSheetByName("Settings");
  if (settingsSheet.getLastRow() <= 1) {
    const defaultSettings = [
      ["Business Name", "El-Baz Electrical Supplies"],
      ["Address", "Cairo, Egypt"],
      ["Phone Number", "+20 123 456 7890"],
      ["Currency", "EGP"],
      ["Admin Email", "admin@elbaz.com"],
      ["Admin Password", "admin"],
      ["Settings Password", "admin_settings"],
      ["Initialized", "true"]
    ];
    settingsSheet.getRange(2, 1, defaultSettings.length, 2).setValues(defaultSettings);
  }

  // Clean up archived customers older than 60 days
  cleanupOldArchivedCustomers();
}

// GET request handler: Returns all database tables as JSON
function doGet(e) {
  initializeDatabase();
  const lock = LockService.getScriptLock();
  try {
    // Wait up to 30 seconds for lock
    lock.waitLock(30000);
    
    const dbData = readAllTables();
    return createJsonResponse({ success: true, data: dbData });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

// POST request handler: Performs database writes and transactions
function doPost(e) {
  initializeDatabase();
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    
    if (!e.postData || !e.postData.contents) {
      return createJsonResponse({ success: false, error: "Empty request body" });
    }
    
    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    const payload = request.payload;
    
    if (!action) {
      return createJsonResponse({ success: false, error: "Action is required" });
    }
    
    let result;
    switch(action) {
      case "saveProduct":
        result = handleSaveProduct(payload);
        break;
      case "saveCustomer":
        result = handleSaveCustomer(payload);
        break;
      case "saveInvoice":
        result = handleSaveInvoice(payload);
        break;
      case "saveExpense":
        result = handleSaveExpense(payload);
        break;
      case "updateSettings":
        result = handleUpdateSettings(payload);
        break;
      case "addPayment":
        result = handleAddPayment(payload);
        break;
      default:
        throw new Error("Unknown action: " + action);
    }
    
    // Return result along with updated data to minimize network requests
    const freshData = readAllTables();
    return createJsonResponse({ success: true, result: result, data: freshData });
    
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

// Creates CORS-compliant JSON response
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Reads all sheets and converts them to JSON arrays
function readAllTables() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const result = {};
  
  for (const sheetName in SHEETS_SCHEMA) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) continue;
    
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      result[sheetName] = [];
      continue;
    }
    
    const headers = SHEETS_SCHEMA[sheetName];
    const dataRange = sheet.getRange(2, 1, lastRow - 1, headers.length);
    const values = dataRange.getValues();
    
    result[sheetName] = values.map(row => {
      const rowObj = {};
      headers.forEach((header, index) => {
        let val = row[index];
        // Handle timezone date objects to prevent ISO/UTC shifts during JSON.stringify
        if (val instanceof Date) {
          if (header === "Creation Date") {
            val = Utilities.formatDate(val, tz, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
          } else {
            val = Utilities.formatDate(val, tz, "yyyy-MM-dd");
          }
        }
        rowObj[header] = val;
      });
      return rowObj;
    });
  }
  
  return result;
}

// Helper to convert sheet objects back into array format mapped to columns
function mapObjectToRow(obj, headers) {
  return headers.map(header => {
    const val = obj[header];
    return val === undefined || val === null ? "" : val;
  });
}

// Handler: Save or Update a Product
function handleSaveProduct(product) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Products");
  const headers = SHEETS_SCHEMA["Products"];
  const productId = product["Product ID"];
  
  if (!productId) throw new Error("Product ID is required");
  
  // Calculate Profit Per Unit automatically
  const buy = parseFloat(product["Purchase Price"]) || 0;
  const sell = parseFloat(product["Selling Price"]) || 0;
  product["Profit Per Unit"] = sell - buy;
  product["Status"] = product["Status"] || "Active";
  
  const lastRow = sheet.getLastRow();
  let foundRow = -1;
  
  if (lastRow > 1) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (ids[i][0] === productId) {
        foundRow = i + 2; // Row index is 1-based, headers are row 1, index starts at 0, so add 2
        break;
      }
    }
  }
  
  const rowData = mapObjectToRow(product, headers);
  
  if (foundRow !== -1) {
    // Update existing row
    sheet.getRange(foundRow, 1, 1, headers.length).setValues([rowData]);
    return { action: "update", productId: productId };
  } else {
    // Append new row
    product["Creation Date"] = product["Creation Date"] || new Date().toISOString();
    const newRowData = mapObjectToRow(product, headers);
    sheet.appendRow(newRowData);
    return { action: "create", productId: productId };
  }
}

// Handler: Save or Update a Customer
function handleSaveCustomer(customer) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const customerId = customer["Customer ID"];
  
  if (!customerId) throw new Error("Customer ID is required");
  
  customer["Status"] = customer["Status"] || "Active";
  customer["Total Purchases"] = parseFloat(customer["Total Purchases"]) || 0;
  customer["Outstanding Balance"] = parseFloat(customer["Outstanding Balance"]) || 0;

  const isArchived = customer["Status"] === "Archived";
  
  if (isArchived) {
    // 1. Remove from active Customers sheet if exists
    const activeSheet = ss.getSheetByName("Customers");
    const activeLastRow = activeSheet.getLastRow();
    if (activeLastRow > 1) {
      const ids = activeSheet.getRange(2, 1, activeLastRow - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (ids[i][0] === customerId) {
          activeSheet.deleteRow(i + 2);
          break;
        }
      }
    }

    // 2. Save in Archive_Customers sheet
    const archiveSheet = ss.getSheetByName("Archive_Customers");
    const archiveHeaders = SHEETS_SCHEMA["Archive_Customers"];
    const archiveLastRow = archiveSheet.getLastRow();
    
    // Set Archive Date to current date in YYYY-MM-DD
    const tz = ss.getSpreadsheetTimeZone();
    if (!customer["Archive Date"]) {
      customer["Archive Date"] = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
    }

    let foundArchiveRow = -1;
    if (archiveLastRow > 1) {
      const ids = archiveSheet.getRange(2, 1, archiveLastRow - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (ids[i][0] === customerId) {
          foundArchiveRow = i + 2;
          break;
        }
      }
    }

    const rowData = mapObjectToRow(customer, archiveHeaders);
    if (foundArchiveRow !== -1) {
      archiveSheet.getRange(foundArchiveRow, 1, 1, archiveHeaders.length).setValues([rowData]);
      return { action: "update_archive", customerId: customerId };
    } else {
      archiveSheet.appendRow(rowData);
      return { action: "create_archive", customerId: customerId };
    }

  } else {
    // Active Customer (Create/Update/Restore)
    // 1. Remove from Archive_Customers sheet if exists
    const archiveSheet = ss.getSheetByName("Archive_Customers");
    const archiveLastRow = archiveSheet.getLastRow();
    if (archiveLastRow > 1) {
      const ids = archiveSheet.getRange(2, 1, archiveLastRow - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (ids[i][0] === customerId) {
          archiveSheet.deleteRow(i + 2);
          break;
        }
      }
    }

    // Remove Archive Date property if it exists
    delete customer["Archive Date"];

    // 2. Save in Customers sheet
    const activeSheet = ss.getSheetByName("Customers");
    const activeHeaders = SHEETS_SCHEMA["Customers"];
    const activeLastRow = activeSheet.getLastRow();
    
    let foundActiveRow = -1;
    if (activeLastRow > 1) {
      const ids = activeSheet.getRange(2, 1, activeLastRow - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (ids[i][0] === customerId) {
          foundActiveRow = i + 2;
          break;
        }
      }
    }

    const rowData = mapObjectToRow(customer, activeHeaders);
    if (foundActiveRow !== -1) {
      activeSheet.getRange(foundActiveRow, 1, 1, activeHeaders.length).setValues([rowData]);
      return { action: "update", customerId: customerId };
    } else {
      activeSheet.appendRow(rowData);
      return { action: "create", customerId: customerId };
    }
  }
}

// Clean up archived customers older than 60 days
function cleanupOldArchivedCustomers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Archive_Customers");
  if (!sheet) return;
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  
  const headers = SHEETS_SCHEMA["Archive_Customers"];
  const archiveDateColIndex = headers.indexOf("Archive Date");
  if (archiveDateColIndex === -1) return;
  
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const now = new Date().getTime();
  const sixtyDaysInMs = 60 * 24 * 60 * 60 * 1000;
  
  // Iterate backwards to avoid index shifting when deleting rows
  for (let i = values.length - 1; i >= 0; i--) {
    const row = values[i];
    const archiveDateVal = row[archiveDateColIndex];
    if (archiveDateVal) {
      const archiveDate = new Date(archiveDateVal);
      if (!isNaN(archiveDate.getTime())) {
        if (now - archiveDate.getTime() > sixtyDaysInMs) {
          sheet.deleteRow(i + 2);
        }
      }
    }
  }
}

// Handler: Save Invoice (POS transaction)
// Reduces inventory, records total purchases & outstanding balance on customer
function handleSaveInvoice(invoiceData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const invoice = invoiceData.invoice; // Invoices row object
  const items = invoiceData.items; // Array of InvoiceItems objects
  
  if (!invoice || !items || items.length === 0) {
    throw new Error("Invoice details and items are required");
  }
  
  const invoiceSheet = ss.getSheetByName("Invoices");
  const itemsSheet = ss.getSheetByName("InvoiceItems");
  const productsSheet = ss.getSheetByName("Products");
  const customersSheet = ss.getSheetByName("Customers");
  
  // 1. Insert the Invoice
  const invoiceHeaders = SHEETS_SCHEMA["Invoices"];
  const invoiceRow = mapObjectToRow(invoice, invoiceHeaders);
  invoiceSheet.appendRow(invoiceRow);
  
  // 2. Insert Invoice Items and Update Product Quantities
  const itemsHeaders = SHEETS_SCHEMA["InvoiceItems"];
  const productsHeaders = SHEETS_SCHEMA["Products"];
  
  // Fetch products mapping for lookups & updates
  const prodLastRow = productsSheet.getLastRow();
  const productsRows = prodLastRow > 1 ? productsSheet.getRange(2, 1, prodLastRow - 1, productsHeaders.length).getValues() : [];
  const prodIdColIndex = productsHeaders.indexOf("Product ID");
  const prodQtyColIndex = productsHeaders.indexOf("Current Quantity");
  
  items.forEach(item => {
    // Save invoice item
    const itemRow = mapObjectToRow(item, itemsHeaders);
    itemsSheet.appendRow(itemRow);
    
    // Reduce inventory quantity
    const pId = item["Product ID"];
    const qtySold = parseFloat(item["Quantity"]) || 0;
    
    // Find product row
    let prodFoundRowIndex = -1;
    for (let i = 0; i < productsRows.length; i++) {
      if (productsRows[i][prodIdColIndex] === pId) {
        prodFoundRowIndex = i + 2; // +2 for headers and 1-based indexing
        const currentQty = parseFloat(productsRows[i][prodQtyColIndex]) || 0;
        const newQty = Math.max(0, currentQty - qtySold);
        // Write back new quantity
        productsSheet.getRange(prodFoundRowIndex, prodQtyColIndex + 1).setValue(newQty);
        break;
      }
    }
  });
  
  // 3. Update Customer's Total Purchases and Outstanding Balance (if not generic customer)
  const custId = invoice["Customer ID"];
  const totalAmount = parseFloat(invoice["Total Amount"]) || 0;
  const paidAmount = parseFloat(invoice["Paid Amount"]) || 0;
  const remainingAmount = parseFloat(invoice["Remaining Amount"]) || 0;
  
  if (custId && custId !== "GENERIC") {
    const customersHeaders = SHEETS_SCHEMA["Customers"];
    const custLastRow = customersSheet.getLastRow();
    const customersRows = custLastRow > 1 ? customersSheet.getRange(2, 1, custLastRow - 1, customersHeaders.length).getValues() : [];
    const custIdIndex = customersHeaders.indexOf("Customer ID");
    const custPurchIndex = customersHeaders.indexOf("Total Purchases");
    const custBalIndex = customersHeaders.indexOf("Outstanding Balance");
    
    for (let i = 0; i < customersRows.length; i++) {
      if (customersRows[i][custIdIndex] === custId) {
        const custFoundRowIndex = i + 2;
        const currentPurchases = parseFloat(customersRows[i][custPurchIndex]) || 0;
        const currentBalance = parseFloat(customersRows[i][custBalIndex]) || 0;
        
        customersSheet.getRange(custFoundRowIndex, custPurchIndex + 1).setValue(currentPurchases + totalAmount);
        customersSheet.getRange(custFoundRowIndex, custBalIndex + 1).setValue(currentBalance + remainingAmount);
        break;
      }
    }
  }
  
  return { invoiceNumber: invoice["Invoice Number"] };
}

// Handler: Save an Expense
function handleSaveExpense(expense) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Expenses");
  const headers = SHEETS_SCHEMA["Expenses"];
  
  expense["Expense ID"] = expense["Expense ID"] || "EXP-" + Date.now();
  expense["Date"] = expense["Date"] || new Date().toISOString().split('T')[0];
  expense["Amount"] = parseFloat(expense["Amount"]) || 0;
  
  const rowData = mapObjectToRow(expense, headers);
  sheet.appendRow(rowData);
  return { expenseId: expense["Expense ID"] };
}

// Handler: Update Settings
function handleUpdateSettings(settingsList) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Settings");
  
  settingsList.forEach(setting => {
    const key = setting.Key;
    const val = setting.Value;
    
    const lastRow = sheet.getLastRow();
    let foundRow = -1;
    
    if (lastRow > 1) {
      const keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < keys.length; i++) {
        if (keys[i][0] === key) {
          foundRow = i + 2;
          break;
        }
      }
    }
    
    if (foundRow !== -1) {
      sheet.getRange(foundRow, 2).setValue(val);
    } else {
      sheet.appendRow([key, val]);
    }
  });
  
  return { updated: settingsList.length };
}

// Handler: Add partial payment/debt payment to an invoice
function handleAddPayment(paymentData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const invoiceNumber = paymentData.invoiceNumber;
  const amountToPay = parseFloat(paymentData.amount) || 0;
  const discountRemaining = paymentData.discountRemaining === true;
  
  if (!invoiceNumber || amountToPay <= 0) {
    throw new Error("Invoice number and positive payment amount are required");
  }
  
  const invoiceSheet = ss.getSheetByName("Invoices");
  const invoicesHeaders = SHEETS_SCHEMA["Invoices"];
  const invLastRow = invoiceSheet.getLastRow();
  const invoicesRows = invLastRow > 1 ? invoiceSheet.getRange(2, 1, invLastRow - 1, invoicesHeaders.length).getValues() : [];
  
  const invNumIndex = invoicesHeaders.indexOf("Invoice Number");
  const invPaidIndex = invoicesHeaders.indexOf("Paid Amount");
  const invRemIndex = invoicesHeaders.indexOf("Remaining Amount");
  const invStatusIndex = invoicesHeaders.indexOf("Status");
  const invCustIdIndex = invoicesHeaders.indexOf("Customer ID");
  const invTotalIndex = invoicesHeaders.indexOf("Total Amount");
  
  let foundInvoiceRowIndex = -1;
  let currentPaid = 0;
  let totalAmount = 0;
  let customerId = "";
  let currentDiscount = 0;
  
  const invDiscountIndex = invoicesHeaders.indexOf("Discount");
  
  for (let i = 0; i < invoicesRows.length; i++) {
    if (invoicesRows[i][invNumIndex] === invoiceNumber) {
      foundInvoiceRowIndex = i + 2;
      currentPaid = parseFloat(invoicesRows[i][invPaidIndex]) || 0;
      totalAmount = parseFloat(invoicesRows[i][invTotalIndex]) || 0;
      customerId = invoicesRows[i][invCustIdIndex];
      if (invDiscountIndex !== -1) {
        currentDiscount = parseFloat(invoicesRows[i][invDiscountIndex]) || 0;
      }
      break;
    }
  }
  
  if (foundInvoiceRowIndex === -1) {
    throw new Error("Invoice not found: " + invoiceNumber);
  }
  
  // Calculate new payment status and discount
  const newPaid = currentPaid + amountToPay;
  let newDiscount = currentDiscount;
  if (discountRemaining) {
    const waivedAmount = Math.max(0, totalAmount - currentPaid - currentDiscount - amountToPay);
    newDiscount = currentDiscount + waivedAmount;
  }
  
  let newRemaining = Math.max(0, totalAmount - newPaid - newDiscount);
  if (discountRemaining) {
    newRemaining = 0;
  }
  let newStatus = "Partially Paid";
  if (newRemaining <= 0) {
    newStatus = "Paid";
  }
  
  // Update invoice
  invoiceSheet.getRange(foundInvoiceRowIndex, invPaidIndex + 1).setValue(newPaid);
  invoiceSheet.getRange(foundInvoiceRowIndex, invRemIndex + 1).setValue(newRemaining);
  invoiceSheet.getRange(foundInvoiceRowIndex, invStatusIndex + 1).setValue(newStatus);
  if (invDiscountIndex !== -1) {
    invoiceSheet.getRange(foundInvoiceRowIndex, invDiscountIndex + 1).setValue(newDiscount);
  }
  
  // Update customer's outstanding balance
  if (customerId && customerId !== "GENERIC") {
    const customersSheet = ss.getSheetByName("Customers");
    const customersHeaders = SHEETS_SCHEMA["Customers"];
    const custLastRow = customersSheet.getLastRow();
    const customersRows = custLastRow > 1 ? customersSheet.getRange(2, 1, custLastRow - 1, customersHeaders.length).getValues() : [];
    const custIdIndex = customersHeaders.indexOf("Customer ID");
    const custBalIndex = customersHeaders.indexOf("Outstanding Balance");
    
    for (let i = 0; i < customersRows.length; i++) {
      if (customersRows[i][custIdIndex] === customerId) {
        const custFoundRowIndex = i + 2;
        const currentBalance = parseFloat(customersRows[i][custBalIndex]) || 0;
        const debtCleared = discountRemaining ? (totalAmount - currentPaid - currentDiscount) : amountToPay;
        const newBalance = Math.max(0, currentBalance - debtCleared);
        customersSheet.getRange(custFoundRowIndex, custBalIndex + 1).setValue(newBalance);
        break;
      }
    }
  }
  
  return { invoiceNumber: invoiceNumber, paidAmount: newPaid, remainingAmount: newRemaining, status: newStatus };
}
