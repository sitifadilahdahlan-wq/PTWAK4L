/**
 * AK4L - QSHE & Security Management Portal | LRT Jakarta
 * Backend Integration Script for Google Sheets & Web App Rendering
 * 
 * Petunjuk Deployment:
 * 1. Buka Google Spreadsheet tempat penyimpanan data.
 * 2. Klik menu Ekstensi (Extensions) > Apps Script.
 * 3. Salin seluruh kode ini dan tempelkan di file 'Code.gs'.
 * 4. Buat file HTML baru bernama 'index' (tanpa .html) dan tempelkan kode HTML portal AK4L.
 * 5. Klik "Deploy" > "New deployment" > Pilih Tipe: "Web app".
 * 6. Execute as: "Me" | Who has access: "Anyone".
 * 7. Klik "Deploy" dan jalankan Web App URL yang dihasilkan.
 */

// Global Spreadsheet reference
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Main HTTP GET handler - Merender tampilan UI HTML Portal AK4L saat Web App dibuka
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
       .setTitle('AK4L - QSHE & Security Portal | LRT Jakarta')
       .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
       .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Main HTTP POST handler - Menerima kiriman data API dari luar
 */
function doPost(e) {
  try {
    var data = {};
    
    // Parse data baik dari payload JSON raw maupun url-encoded form parameter
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    if (!data.action) {
      return responseJSON({ status: "error", message: "Parameter 'action' tidak ditemukan." });
    }

    var result = processAction(data.action, data);
    return responseJSON(result);

  } catch (err) {
    return responseJSON({ 
      status: "error", 
      message: err.toString() 
    });
  }
}

/**
 * Fungsi Pengolah Utama Data (Dapat dipanggil via POST API & google.script.run)
 */
function processAction(action, data) {
  var ss = getSpreadsheet();
  var timestamp = new Date();

  switch (action) {
    case "addHazard":
      saveHazardData(ss, data, timestamp);
      break;

    case "addReport":
      saveReportData(ss, data, timestamp);
      break;

    case "addVisitor":
      saveVisitorData(ss, data, timestamp);
      break;

    case "addPtw":
      savePtwData(ss, data, timestamp);
      break;

    case "addSchedule":
      saveScheduleData(ss, data, timestamp);
      break;

    default:
      throw new Error("Action tidak dikenali: " + action);
  }

  return {
    status: "success",
    message: "Data berhasil disimpan ke Google Sheets",
    action: action,
    timestamp: timestamp.toISOString()
  };
}

/**
 * Menyimpan data Permit to Work (PTW) ke tab 'PTW'
 */
function savePtwData(ss, data, timestamp) {
  var headers = ["Timestamp", "No PTW", "Jenis Pekerjaan", "Kontraktor / Pelaksana", "Lokasi", "Masa Berlaku", "Jam Kerja", "Supervisor", "Status"];
  var sheet = getOrCreateSheet(ss, "PTW", headers);
  
  sheet.appendRow([
    timestamp,
    data.no || "",
    data.type || "",
    data.contractor || "",
    data.location || "",
    data.expiry || "",
    data.time || "",
    data.supervisor || "",
    data.status || "Pending"
  ]);
}

/**
 * Menyimpan temuan Bahaya KTA/TTA ke tab 'Hazards'
 */
function saveHazardData(ss, data, timestamp) {
  var headers = ["Timestamp", "ID Temuan", "Judul Temuan", "Lokasi", "Tingkat Bahaya", "Status"];
  var sheet = getOrCreateSheet(ss, "Hazards", headers);

  sheet.appendRow([
    timestamp,
    data.id || "",
    data.title || "",
    data.location || "",
    data.severity || "",
    data.status || "Open"
  ]);
}

/**
 * Menyimpan metadata Laporan BUJP ke tab 'Reports'
 */
function saveReportData(ss, data, timestamp) {
  var headers = ["Timestamp", "ID Laporan", "Nama Laporan", "Tanggal Unggah", "Diupload Oleh", "Bulan", "Status"];
  var sheet = getOrCreateSheet(ss, "Reports", headers);

  sheet.appendRow([
    timestamp,
    data.id || "",
    data.name || "",
    data.date || "",
    data.uploadedBy || "",
    data.month || "",
    data.status || "Approved"
  ]);
}

/**
 * Menyimpan data Pengunjung (Visitor) ke tab 'Visitors'
 */
function saveVisitorData(ss, data, timestamp) {
  var headers = ["Timestamp", "Nama Pengunjung", "Instansi / Perusahaan", "Tanggal Kunjungan", "Waktu Kunjungan", "Status"];
  var sheet = getOrCreateSheet(ss, "Visitors", headers);

  sheet.appendRow([
    timestamp,
    data.name || "",
    data.org || "",
    data.date || "",
    data.time || "",
    data.status || "Approved"
  ]);
}

/**
 * Menyimpan Jadwal Inspeksi APAR ke tab 'Schedules'
 */
function saveScheduleData(ss, data, timestamp) {
  var headers = ["Timestamp", "Kode Alat", "Lokasi", "Tanggal Jadwal", "Petugas", "Status"];
  var sheet = getOrCreateSheet(ss, "Schedules", headers);

  sheet.appendRow([
    timestamp,
    data.code || "",
    data.location || "",
    data.date || "",
    data.officer || "",
    data.status || "Scheduled"
  ]);
}

/**
 * Helper untuk mengambil tab sheet atau membuatnya jika belum ada
 */
function getOrCreateSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    
    // Formatting Header berstandar LRT Jakarta
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#f24d1a");
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    headerRange.setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Utility untuk menghasilkan response berformat JSON
 */
function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
