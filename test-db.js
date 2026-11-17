
require('dotenv').config();

const db = require('./src/config/db');

async function testConnection() {
  try {
    const [rows] = await db.query(`
      SELECT
        DATABASE() AS database_name,
        (SELECT COUNT(*) FROM fakultas) AS total_fakultas,
        (SELECT COUNT(*) FROM program_studi) AS total_prodi,
        (SELECT COUNT(*) FROM mahasiswa) AS total_mahasiswa
    `);

    console.log('\nKONEKSI DATABASE BERHASIL!');
    console.table(rows);

  } catch (error) {
    console.error('\nKONEKSI DATABASE GAGAL!');
    console.error('Error code:', error.code);
    console.error('Message:', error.message);
    process.exitCode = 1;

  } finally {
    await db.end();
  }
}

testConnection();
