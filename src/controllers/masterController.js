const db = require('../config/db');

exports.getFakultas = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT kode, nama FROM fakultas ORDER BY kode ASC');
    res.status(200).json({ success: true, total: rows.length, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getProdi = async (req, res) => {
  try {
    const { kodeFakultas } = req.query;
    let query = `
      SELECT p.kode, p.nama, p.jenjang, p.kode_fakultas, f.nama AS nama_fakultas 
      FROM program_studi p 
      JOIN fakultas f ON p.kode_fakultas = f.kode
      WHERE p.kode != '9901'
    `;
    const params = [];

    if (kodeFakultas) {
      query += ' AND p.kode_fakultas = ?';
      params.push(kodeFakultas.toUpperCase());
    }

    query += ' ORDER BY p.kode ASC';
    const [rows] = await db.query(query, params);
    res.status(200).json({ success: true, total: rows.length, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMataKuliahPerrangkatan = async (req, res) => {
  try {
    const { kodeProdi } = req.query;
    let query = `
      SELECT mk.kode, mk.nama, mk.sks, mk.semester_rencana, mk.kode_prodi, mk.kode_prasyarat, pr.nama AS nama_prasyarat 
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

exports.getRekapFakultas = async (req, res) => {
  try {
    const { kodeFakultas } = req.query;
    let query = `
      SELECT 
        f.kode,
        f.nama,
        COUNT(DISTINCT CASE WHEN p.jenjang = 'S1' AND p.kode != '9901' THEN p.kode END) AS total_s1,
        COUNT(DISTINCT CASE WHEN p.jenjang = 'D4' THEN p.kode END) AS total_d4,
        COUNT(DISTINCT CASE WHEN p.kode != '9901' THEN p.kode END) AS total_prodi,
        COUNT(DISTINCT m.npm) AS total_mahasiswa
      FROM fakultas f
      LEFT JOIN program_studi p ON f.kode = p.kode_fakultas
      LEFT JOIN mahasiswa m ON p.kode = m.kode_prodi
    `;
    const params = [];
    if (kodeFakultas) {
      query += ' WHERE f.kode = ?';
      params.push(kodeFakultas.toUpperCase());
    }
    query += ' GROUP BY f.kode, f.nama ORDER BY total_prodi DESC, f.nama ASC';

    const [rows] = await db.query(query, params);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDosenWali = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.nama_lengkap, u.kode_prodi, p.nama AS nama_prodi, COUNT(m.npm) AS total_bimbingan
       FROM users u
       LEFT JOIN program_studi p ON u.kode_prodi = p.kode
       LEFT JOIN mahasiswa m ON u.id = m.dosen_wali_id
       WHERE u.role = 'dosen'
       GROUP BY u.id, u.nama_lengkap, u.kode_prodi, p.nama`
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};