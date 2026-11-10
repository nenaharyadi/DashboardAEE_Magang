const db = require('../config/db');

// Get 16 Fakultas + 1 Sekolah Vokasi dari MySQL
exports.getFakultas = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT kode, nama FROM fakultas ORDER BY kode ASC');
    res.status(200).json({ success: true, total: rows.length, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get 73 Program Studi dari MySQL (dengan Filter Fakultas)
exports.getProdi = async (req, res) => {
  try {
    const { kodeFakultas } = req.query;
    let query = `
      SELECT p.kode, p.nama, p.jenjang, p.kode_fakultas, f.nama as nama_fakultas 
      FROM program_studi p 
      JOIN fakultas f ON p.kode_fakultas = f.kode
    `;
    const params = [];

    if (kodeFakultas) {
      query += ' WHERE p.kode_fakultas = ?';
      params.push(kodeFakultas.toUpperCase());
    }

    query += ' ORDER BY p.kode ASC';
    const [rows] = await db.query(query, params);
    res.status(200).json({ success: true, total: rows.length, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Mata Kuliah Perrangkatan (Prasyarat Chain) dari MySQL
exports.getMataKuliahPerrangkatan = async (req, res) => {
  try {
    const { kodeProdi } = req.query;
    let query = `
      SELECT mk.kode, mk.nama, mk.sks, mk.semester_rencana, mk.kode_prodi, mk.kode_prasyarat, pr.nama as nama_prasyarat 
      FROM mata_kuliah mk 
      LEFT JOIN mata_kuliah pr ON mk.kode_prasyarat = pr.kode
    `;
    const params = [];

    if (kodeProdi) {
      query += ' WHERE mk.kode_prodi = ?';
      params.push(kodeProdi);
    }

    query += ' ORDER BY mk.semester_rencana ASC';
    const [rows] = await db.query(query, params);
    res.status(200).json({ success: true, total: rows.length, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};