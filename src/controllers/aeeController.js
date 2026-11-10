const db = require('../config/db');
const aeeEngine = require('../services/aeeEngine');

// Perhitungan 9 Rumus AEE Langsung dari Database MySQL
exports.getAnalyticsAEE = async (req, res) => {
  try {
    const { kodeProdi, kodeFakultas } = req.query;
    let queryMhs = `
      SELECT m.*, p.nama as nama_prodi, p.kode_fakultas, f.nama as nama_fakultas 
      FROM mahasiswa m 
      JOIN program_studi p ON m.kode_prodi = p.kode 
      JOIN fakultas f ON p.kode_fakultas = f.kode
    `;
    const paramsMhs = [];

    if (kodeProdi) {
      queryMhs += ' WHERE m.kode_prodi = ?';
      paramsMhs.push(kodeProdi);
    } else if (kodeFakultas) {
      queryMhs += ' WHERE p.kode_fakultas = ?';
      paramsMhs.push(kodeFakultas.toUpperCase());
    }

    queryMhs += ' ORDER BY m.npm ASC';

    // 1. Fetch Real Database Records dari MySQL db_aee_unpad
    const [mhsRows] = await db.query(queryMhs, paramsMhs);
    const [logMKRows] = await db.query('SELECT * FROM log_pengulangan_mk');

    // 2. Kalkulasi Engine 9 Rumus AEE
    const f1 = aeeEngine.calcF1_AEE(mhsRows);
    const f2 = aeeEngine.calcF2_RedFlag(mhsRows);
    const f3 = aeeEngine.calcF3_EarlyWarning(mhsRows);
    const f4 = aeeEngine.calcF4_DurasiTA(mhsRows);
    const f5 = aeeEngine.calcF5_Proyeksi(mhsRows);
    const f6 = aeeEngine.calcF6_KTW(mhsRows);
    const f7 = aeeEngine.calcF7_MasaStudi(mhsRows);
    const f8 = aeeEngine.calcF8_Pengulangan(logMKRows, 1235);
    const f9 = aeeEngine.calcF9_NotifikasiWA(mhsRows);

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
        rasioPengulanganMKPersen: f8.rasioPengulanganPersen,
        totalWANotifikasiTerkirim: f9.summary.totalAlertTerkirim
      },
      detailRumus: { F1_AEE: f1, F2_RedFlag: f2, F3_EarlyWarning: f3, F4_DurasiTA: f4, F5_Proyeksi: f5, F6_KTW: f6, F7_MasaStudi: f7, F8_Pengulangan: f8, F9_Notifikasi: f9 },
      rawMahasiswa: mhsRows
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};