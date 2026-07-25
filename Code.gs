/**
 * AK4L - QSHE & Security Portal | LRT Jakarta
 * Backend Google Apps Script (Code.gs)
 *
 * Petunjuk Penggunaan:
 * 1. Buka Google Sheets baru atau yang sudah ada.
 * 2. Klik Extensions (Ekstensi) > Apps Script.
 * 3. Hapus semua kode bawaan, lalu tempelkan (paste) seluruh kode di bawah ini.
 * 4. Simpan proyek (Ctrl+S / Cmd+S).
 * 5. Klik "Deploy" (Terapkan) > "New deployment" (Terapkan baru).
 * 6. Pilih tipe: "Web app" (Aplikasi web).
 * 7. Setting:
 *    - Execute as: "Me" (Saya)
 *    - Who has access: "Anyone" (Siapa saja)
 * 8. Klik "Deploy" dan salin Web App URL yang dihasilkan.
 * 9. Tempelkan Web App URL tersebut ke dalam menu Pengaturan Koneksi Google Sheets di portal AK4L.
 */

// Nama-nama sheet yang digunakan dalam Google Spreadsheet
const SHEETS = {
  PTW: 'Permit_To_Work',
  HAZARD: 'Hazard_Reports',
  BUJP: 'BUJP_Reports',
  VMS: 'Visitor_Management',
  APAR: 'APAR_Schedules'
};

/**
 * Mengani permintaan HTTP GET
 */
function doGet(e) {
  try {
    var action = e && e.parameter ? e.parameter.action : null;
    
    // Jika meminta data dari frontend
    if (action === 'getData') {
      var allData = getAllPortalData();
      return createJsonResponse({ status: 'success', data: allData });
    }

    // Default tampilan konfirmasi status backend
    return ContentService.createTextOutput(JSON.stringify({
      status: 'active',
      app: 'AK4L QSHE & Security Portal Backend - LRT Jakarta',
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * Menangani permintaan HTTP POST (Pengiriman Form & Aksi)
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  // Kunci eksekusi selama 10 detik untuk menghindari bentrokan data bersamaan
  lock.tryLock(10000);

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ status: 'error', message: 'Payload data tidak ditemukan' });
    }

    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var timestamp = new Date();

    ensureDatabaseStructure(); // Pastikan lembar kerja dan header sudah siap

    var responseData = { status: 'success', action: action };

    switch (action) {
      case 'addPtw':
        handleAddPtw(payload, timestamp);
        break;

      case 'addHazard':
        handleAddHazard(payload, timestamp);
        break;

      case 'addBujpReport':
        handleAddBujpReport(payload, timestamp);
        break;

      case 'addVms':
        handleAddVms(payload, timestamp);
        break;

      case 'addAparSchedule':
        handleAddAparSchedule(payload, timestamp);
        break;

      case 'updatePtwStatus':
        handleUpdatePtwStatus(payload, timestamp);
        break;

      default:
        responseData = { status: 'error', message: 'Aksi (' + action + ') tidak dikenali' };
        break;
    }

    return createJsonResponse(responseData);

  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}


/**
 * Pendaftaran PTW Baru
 */
function handleAddPtw(data, timestamp) {
  var sheet = getOrCreateSheet(SHEETS.PTW, [
    'No. PTW', 'Jenis Pekerjaan', 'Kontraktor', 'Lokasi', 'Tanggal Berlaku', 'Jam Kerja', 'Supervisor', 'Status', 'Timestamp'
  ]);
  
  sheet.appendRow([
    data.no || '',
    data.type || '',
    data.contractor || '',
    data.location || '',
    data.expiry || '',
    data.time || '',
    data.supervisor || '',
    data.status || 'Pending',
    timestamp
  ]);
}

/**
 * Laporan Temuan Bahaya (KTA/TTA)
 */
function handleAddHazard(data, timestamp) {
  var sheet = getOrCreateSheet(SHEETS.HAZARD, [
    'ID Bahaya', 'Judul Temuan', 'Lokasi', 'Tingkat Risiko', 'Status', 'Timestamp'
  ]);

  sheet.appendRow([
    data.id || '',
    data.title || '',
    data.location || '',
    data.severity || '',
    data.status || 'Open',
    timestamp
  ]);
}

/**
 * Upload Laporan BUJP
 */
function handleAddBujpReport(data, timestamp) {
  var sheet = getOrCreateSheet(SHEETS.BUJP, [
    'ID Laporan', 'Nama Laporan', 'Tanggal Unggah', 'Diunggah Oleh', 'Bulan', 'Status', 'Timestamp'
  ]);

  sheet.appendRow([
    data.id || '',
    data.name || '',
    data.date || '',
    data.uploadedBy || '',
    data.month || '',
    data.status || 'Approved',
    timestamp
  ]);
}

/**
 * Form Visitor Management System (VMS)
 */
function handleAddVms(data, timestamp) {
  var sheet = getOrCreateSheet(SHEETS.VMS, [
    'Nama Pengunjung', 'Perusahaan / Instansi', 'Tanggal Kunjungan', 'Waktu Kunjungan', 'Contact Person', 'Durasi', 'Tujuan', 'Status', 'Timestamp'
  ]);

  sheet.appendRow([
    data.name || '',
    data.org || 'Umum',
    data.date || '',
    data.time || '',
    data.contact || '',
    data.duration || '',
    data.purpose || '',
    data.status || 'Approved',
    timestamp
  ]);
}

/**
 * Jadwal Inspeksi APAR & Hydrant
 */
function handleAddAparSchedule(data, timestamp) {
  var sheet = getOrCreateSheet(SHEETS.APAR, [
    'Kode Alat', 'Lokasi', 'Tanggal Inspeksi', 'Petugas', 'Status', 'Timestamp'
  ]);

  sheet.appendRow([
    data.code || '',
    data.location || '',
    data.date || '',
    data.officer || '',
    data.status || 'Terjadwal',
    timestamp
  ]);
}

/**
 * Update Status PTW (Verifikasi / Approval / Close)
 */
function handleUpdatePtwStatus(data, timestamp) {
  var sheet = getOrCreateSheet(SHEETS.PTW, []);
  var rows = sheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.no) {
      sheet.getRange(i + 1, 8).setValue(data.status); // Kolom Status (Ke-8)
      sheet.getRange(i + 1, 10).setValue('Updated: ' + timestamp);
      break;
    }
  }
}


/**
 * Memastikan semua tabel / sheet memiliki struktur kolom yang sesuai
 */
function ensureDatabaseStructure() {
  getOrCreateSheet(SHEETS.PTW, ['No. PTW', 'Jenis Pekerjaan', 'Kontraktor', 'Lokasi', 'Tanggal Berlaku', 'Jam Kerja', 'Supervisor', 'Status', 'Timestamp']);
  getOrCreateSheet(SHEETS.HAZARD, ['ID Bahaya', 'Judul Temuan', 'Lokasi', 'Tingkat Risiko', 'Status', 'Timestamp']);
  getOrCreateSheet(SHEETS.BUJP, ['ID Laporan', 'Nama Laporan', 'Tanggal Unggah', 'Diunggah Oleh', 'Bulan', 'Status', 'Timestamp']);
  getOrCreateSheet(SHEETS.VMS, ['Nama Pengunjung', 'Perusahaan / Instansi', 'Tanggal Kunjungan', 'Waktu Kunjungan', 'Contact Person', 'Durasi', 'Tujuan', 'Status', 'Timestamp']);
  getOrCreateSheet(SHEETS.APAR, ['Kode Alat', 'Lokasi', 'Tanggal Inspeksi', 'Petugas', 'Status', 'Timestamp']);
}

/**
 * Mengambil atau membuat sheet baru beserta header kolomnya
 */
function getOrCreateSheet(sheetName, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      
      // Styling header otomatis
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#f24d1a')
                 .setFontColor('#ffffff')
                 .setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  }

  return sheet;
}

/**
 * Mengambil seluruh data dari semua tabel untuk sinkronisasi portal
 */
function getAllPortalData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var result = {};

  Object.keys(SHEETS).forEach(function(key) {
    var sheetName = SHEETS[key];
    var sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      result[sheetName] = data;
    } else {
      result[sheetName] = [];
    }
  });

  return result;
}

/**
 * Format output JSON response
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
                       .setMimeType(ContentService.MimeType.JSON);
}
