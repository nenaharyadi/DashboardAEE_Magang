const db = require('../config/db');
const aeeEngine = require('../services/aeeEngine');

const FALLBACK_PARAMETERS = {
  id: 1,
  w1_ktw: 0.40,
  w2_masa_studi: 0.35,
  w3_progres_ta: 0.25,
  s0_normal: 8,
  batas_kritis_min: 9,
  batas_kritis_max: 14,
  target_sks: 144,
  ipk_minimal: 2.00,
  threshold_ri: 1.00,
  threshold_ta_kritis: 0.25
};

async function fetchActiveParameters() {
  try {
    const [rows] = await db.query('SELECT * FROM aee_parameters WHERE id = 1 LIMIT 1');
    if (rows && rows.length > 0) return rows[0];
  } catch (err) {
    console.warn('[AEE PARAMETERS FALLBACK]', err.message);
  }
  return { ...FALLBACK_PARAMETERS };
}

exports.getAnalyticsAEE = async (req, res) => {
  try {
    const { kodeProdi, kodeFakultas, dosenWaliId } = req.query;

    const activeParamRow = await fetchActiveParameters();

    let queryMhs = `
      SELECT
        m.*,
        p.nama AS nama_prodi,
        p.jenjang,
        p.kode_fakultas,
        f.nama AS nama_fakultas,
        u.nama_lengkap AS nama_dosen_wali
      FROM mahasiswa m
      JOIN program_studi p
        ON m.kode_prodi = p.kode
      JOIN fakultas f
        ON p.kode_fakultas = f.kode
      LEFT JOIN users u
        ON m.dosen_wali_id = u.id
      WHERE 1=1
    `;

    const paramsMhs = [];

    if (dosenWaliId !== undefined && dosenWaliId !== null && dosenWaliId !== '') {
      const idDosenWali = Number(dosenWaliId);
      if (!Number.isInteger(idDosenWali) || idDosenWali <= 0) {
        return res.status(400).json({
          success: false,
          message: 'ID Dosen Wali tidak valid.'
        });
      }
      queryMhs += ' AND m.dosen_wali_id = ?';
      paramsMhs.push(idDosenWali);
    }

    if (kodeProdi) {
      if (String(kodeProdi) === '140810') {
        queryMhs += ' AND m.kode_prodi IN (?, ?)';
        paramsMhs.push(kodeProdi, '9901');
      } else {
        queryMhs += ' AND m.kode_prodi = ?';
        paramsMhs.push(kodeProdi);
      }
    } else if (kodeFakultas) {
      queryMhs += ' AND p.kode_fakultas = ?';
      paramsMhs.push(kodeFakultas.toUpperCase());
    }

    queryMhs += ' ORDER BY m.npm ASC';

    const [mhsRows] = await db.query(queryMhs, paramsMhs);
    const [logMKRows] = await db.query('SELECT * FROM log_pengulangan_mk');

    // Pemisahan Cohort vs Perwalian
    const cohortRows = mhsRows.filter(
      m => m.npm.startsWith('1499102100') && parseInt(m.npm.slice(-2), 10) <= 30
    );

    const perwalianRows = mhsRows.filter(
      m => !(m.npm.startsWith('1499102100') && parseInt(m.npm.slice(-2), 10) <= 30)
    );

    const evalCohort = cohortRows.length > 0 ? cohortRows : mhsRows;

    // Untuk evaluasi Red-Flag & Early Warning, utamakan mahasiswa non-Lulus
    const nonLulusPerwalian = perwalianRows.filter(m => m.status_studi !== 'Lulus');
    const evalPerwalian = nonLulusPerwalian.length > 0
      ? nonLulusPerwalian
      : (perwalianRows.length > 0 ? perwalianRows : mhsRows);

    const doswalName = mhsRows[0]?.nama_dosen_wali || 'Dosen Wali';

    // Hitung F8 menyesuaikan filter jika ada
    const isFiltered = Boolean(kodeProdi || kodeFakultas || dosenWaliId);
    const npmSet = new Set(mhsRows.map(m => m.npm));
    const filteredLogMK = isFiltered ? logMKRows.filter(l => npmSet.has(l.npm)) : logMKRows;
    const totalSksPenyebut = isFiltered
      ? mhsRows.reduce((acc, m) => acc + parseInt(m.sks_kumulatif || 0, 10), 0)
      : 1235;

    // Kalkulasi 9 Rumus AEE dengan parameter dinamis dari DB
    const f1 = aeeEngine.calcF1_AEE(evalCohort, activeParamRow);
    const f2 = aeeEngine.calcF2_RedFlag(evalPerwalian, activeParamRow);
    const f3 = aeeEngine.calcF3_EarlyWarning(evalPerwalian, activeParamRow);
    const f4 = aeeEngine.calcF4_DurasiTA(evalCohort);
    const f5 = aeeEngine.calcF5_Proyeksi(evalCohort, activeParamRow);
    const f6 = aeeEngine.calcF6_KTW(evalCohort, activeParamRow);
    const f7 = aeeEngine.calcF7_MasaStudi(evalCohort);
    const f8 = aeeEngine.calcF8_Pengulangan(filteredLogMK, totalSksPenyebut);
    const f9 = aeeEngine.calcF9_NotifikasiWA(evalPerwalian, doswalName, activeParamRow);

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      activeParameters: {
        w1_ktw: Number(activeParamRow.w1_ktw),
        w2_masa_studi: Number(activeParamRow.w2_masa_studi),
        w3_progres_ta: Number(activeParamRow.w3_progres_ta),
        s0_normal: Number(activeParamRow.s0_normal),
        batas_kritis_min: Number(activeParamRow.batas_kritis_min),
        batas_kritis_max: Number(activeParamRow.batas_kritis_max),
        target_sks: Number(activeParamRow.target_sks),
        ipk_minimal: Number(activeParamRow.ipk_minimal),
        threshold_ri: Number(activeParamRow.threshold_ri),
        threshold_ta_kritis: Number(activeParamRow.threshold_ta_kritis)
      },
      executiveSummary: {
        indeksAEEPersen: f1.skorAEE,
        totalMhsKritisMerah: f2.summary.totalMerahKritis,
        peringatanDiniAktif: f3.summary.totalPeringatanAktif,
        rataRataDurasiTABulan: f4.rataRataDurasiBulan,
        proyeksiKelulusanPersen: f5.proyeksiKelulusanPersen,
        ktwPersen: f6.ktwPersen,
        rataRataMasaStudiTahun: f7.avgMasaStudiTahun,
        rasioPengulanganMKPersen: f8.rasioPengulanganMKPersen,
        totalWANotifikasiTerkirim: f9.summary.totalAlertTerkirim
      },
      detailRumus: {
        F1_AEE: f1,
        F2_RedFlag: f2,
        F3_EarlyWarning: f3,
        F4_DurasiTA: f4,
        F5_Proyeksi: f5,
        F6_KTW: f6,
        F7_MasaStudi: f7,
        F8_Pengulangan: f8,
        F9_Notifikasi: f9
      },
      rawMahasiswa: mhsRows
    });
  } catch (error) {
    console.error('[AEE ANALYTICS ERROR]', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==========================================
// UPDATE KLARIFIKASI DOSEN WALI
// ==========================================
exports.updateKlarifikasiDosenWali = async (req, res) => {
  try {
    const { npm } = req.params;
    const { kategori_pemicu } = req.body;

    await db.query(
      'UPDATE mahasiswa SET kategori_pemicu = ? WHERE npm = ?',
      [kategori_pemicu || null, npm]
    );

    res.status(200).json({
      success: true,
      message: 'Klarifikasi keterlambatan berhasil disimpan.'
    });
  } catch (error) {
    console.error('[UPDATE KLARIFIKASI ERROR]', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==========================================
// REVISI #1: ADMIN EDIT DATA MAHASISWA
// ==========================================
exports.updateMahasiswa = async (req, res) => {
  try {
    const { npm } = req.params;
    const {
      nama,
      angkatan,
      semester_aktif,
      sks_kumulatif,
      ipk,
      status_studi,
      semester_lulus,
      status_ta,
      progres_ta_persen,
      kategori_pemicu
    } = req.body;

    const [existing] = await db.query('SELECT npm FROM mahasiswa WHERE npm = ?', [npm]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Mahasiswa tidak ditemukan.' });
    }

    const cleanStatus = status_studi || 'Aktif';
    const cleanSks = Math.max(0, parseInt(sks_kumulatif, 10) || 0);
    const cleanIpk = Math.min(4.0, Math.max(0.0, parseFloat(ipk) || 0));
    const cleanAngkatan = parseInt(angkatan, 10) || 2021;

    let cleanSemAktif = null;
    let cleanSemLulus = null;
    let cleanStatusTA = status_ta || null;
    let cleanProgresTA = Math.min(1, Math.max(0, (parseFloat(progres_ta_persen) || 0) / 100));

    if (cleanStatus === 'Lulus') {
      cleanSemAktif = null;
      cleanSemLulus = parseInt(semester_lulus, 10) || 8;
      cleanStatusTA = 'Lulus';
      cleanProgresTA = 1.00;
    } else {
      cleanSemLulus = null;
      cleanSemAktif =
        semester_aktif !== '' && semester_aktif !== null && semester_aktif !== undefined
          ? parseInt(semester_aktif, 10)
          : null;
    }

    await db.query(
      `UPDATE mahasiswa SET
        nama = ?,
        angkatan = ?,
        semester_aktif = ?,
        sks_kumulatif = ?,
        ipk = ?,
        status_studi = ?,
        semester_lulus = ?,
        status_ta = ?,
        progres_ta = ?,
        kategori_pemicu = ?
      WHERE npm = ?`,
      [
        nama,
        cleanAngkatan,
        cleanSemAktif,
        cleanSks,
        cleanIpk,
        cleanStatus,
        cleanSemLulus,
        cleanStatusTA,
        cleanProgresTA.toFixed(2),
        kategori_pemicu || null,
        npm
      ]
    );

    res.status(200).json({
      success: true,
      message: `Data mahasiswa ${nama} (${npm}) berhasil diperbarui.`
    });
  } catch (error) {
    console.error('[UPDATE MAHASISWA ERROR]', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==========================================
// REVISI #2: GET & UPDATE PARAMETER RUMUS AEE
// ==========================================
exports.getParameters = async (req, res) => {
  try {
    const params = await fetchActiveParameters();
    res.status(200).json({
      success: true,
      data: params
    });
  } catch (error) {
    console.error('[GET PARAMETERS ERROR]', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateParameters = async (req, res) => {
  try {
    const {
      w1_ktw,
      w2_masa_studi,
      w3_progres_ta,
      s0_normal,
      batas_kritis_min,
      batas_kritis_max,
      target_sks,
      ipk_minimal,
      threshold_ri,
      threshold_ta_kritis
    } = req.body;

    const w1 = parseFloat(w1_ktw);
    const w2 = parseFloat(w2_masa_studi);
    const w3 = parseFloat(w3_progres_ta);
    const totalBobot = w1 + w2 + w3;

    if (isNaN(totalBobot) || Math.abs(totalBobot - 1.0) > 0.01) {
      return res.status(400).json({
        success: false,
        message: `Total bobot W1 + W2 + W3 harus sama dengan 100% (1.00). Saat ini: ${(totalBobot * 100).toFixed(0)}%.`
      });
    }

    const s0 = parseInt(s0_normal, 10) || 8;
    const kMin = parseInt(batas_kritis_min, 10) || 9;
    const kMax = parseInt(batas_kritis_max, 10) || 14;

    if (kMin >= kMax) {
      return res.status(400).json({
        success: false,
        message: 'Batas semester kritis minimal harus lebih kecil dari batas maksimal.'
      });
    }

    const tSks = parseInt(target_sks, 10) || 144;
    const minIpk = parseFloat(ipk_minimal) || 2.00;
    const thRi = parseFloat(threshold_ri) || 1.00;
    const thTa = parseFloat(threshold_ta_kritis) || 0.25;

    await db.query(
      `INSERT INTO aee_parameters
        (id, w1_ktw, w2_masa_studi, w3_progres_ta, s0_normal, batas_kritis_min, batas_kritis_max, target_sks, ipk_minimal, threshold_ri, threshold_ta_kritis)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        w1_ktw = VALUES(w1_ktw),
        w2_masa_studi = VALUES(w2_masa_studi),
        w3_progres_ta = VALUES(w3_progres_ta),
        s0_normal = VALUES(s0_normal),
        batas_kritis_min = VALUES(batas_kritis_min),
        batas_kritis_max = VALUES(batas_kritis_max),
        target_sks = VALUES(target_sks),
        ipk_minimal = VALUES(ipk_minimal),
        threshold_ri = VALUES(threshold_ri),
        threshold_ta_kritis = VALUES(threshold_ta_kritis)`,
      [w1.toFixed(2), w2.toFixed(2), w3.toFixed(2), s0, kMin, kMax, tSks, minIpk.toFixed(2), thRi.toFixed(2), thTa.toFixed(2)]
    );

    res.status(200).json({
      success: true,
      message: 'Parameter & bobot rumus AEE berhasil diperbarui. Seluruh indeks telah dihitung ulang.'
    });
  } catch (error) {
    console.error('[UPDATE PARAMETERS ERROR]', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};