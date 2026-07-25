/**
 * AK4L - QSHE & Security Portal | LRT Jakarta
 * Backend Google Apps Script (Code.gs)
 *
 * Target Google Spreadsheet ID: 1GzGKANhPZz4CCIqc_1o7yO_A7d_GeuMklmR40-o-nD4
 */

// ID Google Spreadsheet
const SPREADSHEET_ID = '1GzGKANhPZz4CCIqc_1o7yO_A7d_GeuMklmR40-o-nD4';

// Nama-nama sheet/tabel yang digunakan dalam Google Spreadsheet
const SHEETS = {
  PTW: 'Permit_To_Work',
  HAZARD: 'Hazard_Reports',
  BUJP: 'BUJP_Reports',
  VMS: 'Visitor_Management',
  APAR: 'APAR_Schedules'
};

/**
 * Mengambil instance Google Spreadsheet berdasarkan ID
 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * Menangani permintaan HTTP GET (Pengambilan data frontend & status check)
 */
function doGet(e) {
  try {
    var action = e && e.parameter ? e.parameter.action : null;
    
    // Aksi 1: Ambil seluruh data dari semua tabel
    if (action === 'getData') {
      var allData = getAllPortalData();
      return createJsonResponse({ status: 'success', data: allData });
    }

    // Aksi 2: Cari detail PTW spesifik berdasarkan Nomor PTW
    if (action === 'getPtw') {
      var ptwNo = e.parameter.no;
      var ptwData = getPtwByNo(ptwNo);
      if (ptwData) {
        return createJsonResponse({ status: 'success', ptw: ptwData });
      } else {
        return createJsonResponse({ status: 'not_found', message: 'Data PTW tidak ditemukan' });
      }
    }

    // Default: Tampilan status aktif backend
    return ContentService.createTextOutput(JSON.stringify({
      status: 'active',
      app: 'AK4L QSHE & Security Portal Backend - LRT Jakarta',
      spreadsheetId: SPREADSHEET_ID,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * Menangani permintaan HTTP POST (Pengiriman Form, Input PTW, & Update Status)
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

      case 'updatePtwStatus':
        handleUpdatePtwStatus(payload, timestamp);
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
 * Pendaftaran PTW Baru oleh Petugas QSHE
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
 * Cari Data PTW berdasarkan Nomor PTW
 */
function getPtwByNo(ptwNo) {
  if (!ptwNo) return null;
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.PTW);
  if (!sheet) return null;

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === String(ptwNo).trim().toLowerCase()) {
      return {
        no: data[i][0],
        type: data[i][1],
        contractor: data[i][2],
        location: data[i][3],
        expiry: data[i][4],
        time: data[i][5],
        supervisor: data[i][6],
        status: data[i][7]
      };
    }
  }
  return null;
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
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      
      // Styling header otomatis dengan warna oranye LRT Jakarta
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
  var ss = getSpreadsheet();
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
