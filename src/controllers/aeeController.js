const db = require('../config/db');
const aeeEngine = require('../services/aeeEngine');

exports.getAnalyticsAEE = async (req, res) => {
  try {
    const { kodeProdi, kodeFakultas, dosenWaliId } = req.query;

    let queryMhs = `
      SELECT m.*, p.nama AS nama_prodi, p.jenjang, p.kode_fakultas, f.nama AS nama_fakultas,
             u.nama_lengkap AS nama_dosen_wali
      FROM mahasiswa m 
      JOIN program_studi p ON m.kode_prodi = p.kode 
      JOIN fakultas f ON p.kode_fakultas = f.kode
      LEFT JOIN users u ON m.dosen_wali_id = u.id
      WHERE 1=1
    `;
    const paramsMhs = [];

    if (dosenWaliId) {
      queryMhs += ' AND m.dosen_wali_id = ?';
      paramsMhs.push(parseInt(dosenWaliId));
    }
    if (kodeProdi) {
      queryMhs += ' AND m.kode_prodi = ?';
      paramsMhs.push(kodeProdi);
    } else if (kodeFakultas) {
      queryMhs += ' AND p.kode_fakultas = ?';
      paramsMhs.push(kodeFakultas.toUpperCase());
    }

    queryMhs += ' ORDER BY m.npm ASC';

    const [mhsRows] = await db.query(queryMhs, paramsMhs);
    const [logMKRows] = await db.query('SELECT * FROM log_pengulangan_mk');

    const cohortRows = mhsRows.filter(m => m.npm.startsWith('1499102100') && parseInt(m.npm.slice(-2)) <= 30);
    const perwalianRows = mhsRows.filter(m => !(m.npm.startsWith('1499102100') && parseInt(m.npm.slice(-2)) <= 30));

    const evalCohort = cohortRows.length > 0 ? cohortRows : mhsRows;
    const evalPerwalian = perwalianRows.length > 0 ? perwalianRows : mhsRows;
    const doswalName = mhsRows[0]?.nama_dosen_wali || 'Dosen Wali';

    const f1 = aeeEngine.calcF1_AEE(evalCohort);
    const f2 = aeeEngine.calcF2_RedFlag(evalPerwalian);
    const f3 = aeeEngine.calcF3_EarlyWarning(evalPerwalian);
    const f4 = aeeEngine.calcF4_DurasiTA(evalCohort);
    const f5 = aeeEngine.calcF5_Proyeksi(evalCohort);
    const f6 = aeeEngine.calcF6_KTW(evalCohort);
    const f7 = aeeEngine.calcF7_MasaStudi(evalCohort);
    const f8 = aeeEngine.calcF8_Pengulangan(logMKRows, 1235);
    const f9 = aeeEngine.calcF9_NotifikasiWA(evalPerwalian, doswalName);

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
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
      detailRumus: { F1_AEE: f1, F2_RedFlag: f2, F3_EarlyWarning: f3, F4_DurasiTA: f4, F5_Proyeksi: f5, F6_KTW: f6, F7_MasaStudi: f7, F8_Pengulangan: f8, F9_Notifikasi: f9 },
      rawMahasiswa: mhsRows
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateKlarifikasiDosenWali = async (req, res) => {
  try {
    const { npm } = req.params;
    const { kategori_pemicu } = req.body;

    await db.query(
      'UPDATE mahasiswa SET kategori_pemicu = ? WHERE npm = ?',
      [kategori_pemicu || null, npm]
    );

    res.status(200).json({ success: true, message: 'Klarifikasi keterlambatan berhasil disimpan.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};