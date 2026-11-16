const db = require('../config/db');

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username dan password wajib diisi.'
      });
    }

    const [rows] = await db.query(
      `SELECT u.id, u.username, u.nama_lengkap, u.role, u.kode_fakultas, u.kode_prodi,
              f.nama AS nama_fakultas, p.nama AS nama_prodi
       FROM users u
       LEFT JOIN fakultas f ON u.kode_fakultas = f.kode
       LEFT JOIN program_studi p ON u.kode_prodi = p.kode
       WHERE u.username = ? AND u.password = ?`,
      [username.trim(), password.trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Username atau password tidak valid.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Login berhasil',
      user: rows[0]
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};