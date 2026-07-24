/**
 * Code.gs - Google Apps Script Backend
 * AK4L - QSHE & Security Portal | LRT Jakarta
 */

/**
 * Menampilkan halaman Web App HTML saat URL dibuka dari browser
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('AK4L - QSHE & Security Portal | LRT Jakarta')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Menerima request POST berisi JSON dari Form Web App (PTW, VMS, Bahaya, Laporan, Jadwal)
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var result = processAction(data.action, data);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'error', 
      message: err.message 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Mengolah aksi dan menyimpan data secara otomatis ke tab Google Sheet yang sesuai.
 * Membuat tab sheet baru & header otomatis jika sheet belum ada.
 */
function processAction(action, data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Pemetaan nama sheet berdasarkan jenis aksi form
  var sheetName = "Log_Portal";
  if (action === "addHazard") sheetName = "KTA_TTA_Hazards";
  else if (action === "addReport") sheetName = "Laporan_BUJP";
  else if (action === "addVisitor") sheetName = "Visitor_VMS";
  else if (action === "addPtw") sheetName = "Permit_To_Work_PTW";
  else if (action === "addSchedule") sheetName = "Jadwal_APAR_Hydrant";
  
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  // Buat baris Header jika sheet masih kosong
  if (sheet.getLastRow() === 0) {
    var headers = ['Waktu_Input'];
    for (var key in data) {
      if (key !== 'action') {
        headers.push(key);
      }
    }
    sheet.appendRow(headers);
    
    // Format Header dengan warna khas LRT Jakarta (Orange)
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#f24d1a")
               .setFontColor("#ffffff")
               .setFontWeight("bold");
  }
  
  // Susun baris data baru
  var row = [new Date()];
  for (var k in data) {
    if (k !== 'action') {
      row.push(data[k]);
    }
  }
  
  sheet.appendRow(row);
  
  return { 
    status: "success", 
    action: action, 
    sheet: sheetName,
    message: "Data berhasil disimpan ke Google Sheets" 
  };
}

/**
 * Fungsi pembantu opsional untuk membaca data dari Google Sheets ke portal
 */
function getSheetRecords(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var results = [];
  
  for (var i = 1; i < values.length; i++) {
    var rowObj = {};
    for (var j = 0; j < headers.length; j++) {
      rowObj[headers[j]] = values[i][j];
    }
    results.push(rowObj);
  }
  
  return results;
}
