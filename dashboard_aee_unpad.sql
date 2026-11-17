-- =========================================================
-- DATABASE BARU: SYSTEM ANALYTICS AEE UNIVERSITAS PADJADJARAN
-- Lengkap: 16 Fakultas + SV, 73 Prodi (59 S1 + 14 D4), Multi-Role Users,
-- 55 Data Mahasiswa (Cohort & Perwalian) + 30 Log Pengulangan MK
-- =========================================================

SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS db_aee_unpad
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

USE db_aee_unpad;

-- Hapus tabel lama dari tabel anak ke tabel induk
DROP TABLE IF EXISTS log_notifikasi_wa;
DROP TABLE IF EXISTS log_pengulangan_mk;
DROP TABLE IF EXISTS mahasiswa;
DROP TABLE IF EXISTS mata_kuliah;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS program_studi;
DROP TABLE IF EXISTS fakultas;

-- ---------------------------------------------------------
-- 1. Tabel Master: fakultas
-- ---------------------------------------------------------
CREATE TABLE fakultas (
    kode VARCHAR(10) PRIMARY KEY,
    nama VARCHAR(150) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------
-- 2. Tabel Master: program_studi
-- ---------------------------------------------------------
CREATE TABLE program_studi (
    kode VARCHAR(10) PRIMARY KEY,
    nama VARCHAR(150) NOT NULL,
    jenjang VARCHAR(10) DEFAULT 'S1',
    kode_fakultas VARCHAR(10) NOT NULL,
    CONSTRAINT fk_prodi_fakultas
      FOREIGN KEY (kode_fakultas) REFERENCES fakultas(kode)
      ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------
-- 3. Tabel Autentikasi Multi-Role: users
-- ---------------------------------------------------------
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nama_lengkap VARCHAR(150) NOT NULL,
    role ENUM('admin', 'dekan', 'prodi', 'dosen') NOT NULL,
    kode_fakultas VARCHAR(10) NULL,
    kode_prodi VARCHAR(10) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_fakultas
      FOREIGN KEY (kode_fakultas) REFERENCES fakultas(kode)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_user_prodi
      FOREIGN KEY (kode_prodi) REFERENCES program_studi(kode)
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------
-- 4. Tabel Master: mata_kuliah (Perrangkatan & Prasyarat)
-- ---------------------------------------------------------
CREATE TABLE mata_kuliah (
    kode VARCHAR(20) PRIMARY KEY,
    nama VARCHAR(150) NOT NULL,
    sks INT NOT NULL,
    semester_rencana INT NOT NULL,
    kode_prodi VARCHAR(10) NOT NULL,
    kode_prasyarat VARCHAR(20) NULL,
    CONSTRAINT fk_mk_prodi
      FOREIGN KEY (kode_prodi) REFERENCES program_studi(kode)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_mk_prasyarat
      FOREIGN KEY (kode_prasyarat) REFERENCES mata_kuliah(kode)
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------
-- 5. Tabel Utama: mahasiswa
-- ---------------------------------------------------------
CREATE TABLE mahasiswa (
    npm VARCHAR(20) PRIMARY KEY,
    nama VARCHAR(150) NOT NULL,
    angkatan INT NOT NULL,
    semester_aktif INT NULL,
    sks_kumulatif INT DEFAULT 0,
    ipk DECIMAL(3,2) DEFAULT 0.00,
    status_studi ENUM('Aktif', 'Lulus', 'Cuti Resmi', 'Mengundurkan Diri', 'Undur Diri') DEFAULT 'Aktif',
    semester_lulus INT NULL,
    status_ta VARCHAR(50) NULL,
    progres_ta DECIMAL(5,2) DEFAULT 0.00,
    tgl_pengajuan_judul DATE NULL,
    tgl_sidang_lulus DATE NULL,
    kategori_pemicu VARCHAR(100) NULL,
    kode_prodi VARCHAR(10) NOT NULL,
    dosen_wali_id INT NULL,
    CONSTRAINT fk_mhs_prodi
      FOREIGN KEY (kode_prodi) REFERENCES program_studi(kode)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_mhs_doswal
      FOREIGN KEY (dosen_wali_id) REFERENCES users(id)
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------
-- 6. Tabel Riwayat KHS: log_pengulangan_mk
-- ---------------------------------------------------------
CREATE TABLE log_pengulangan_mk (
    id INT AUTO_INCREMENT PRIMARY KEY,
    npm VARCHAR(20) NOT NULL,
    kode_mk VARCHAR(20) NOT NULL,
    nama_mk VARCHAR(150) NOT NULL,
    sks INT NOT NULL,
    semester_pengambilan INT NOT NULL,
    nilai_sebelumnya VARCHAR(2),
    nilai_ulang VARCHAR(2),
    is_prasyarat TINYINT(1) DEFAULT 0,
    CONSTRAINT fk_log_mk_mhs
      FOREIGN KEY (npm) REFERENCES mahasiswa(npm)
      ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------
-- 7. Tabel Log Alert: log_notifikasi_wa
-- ---------------------------------------------------------
CREATE TABLE log_notifikasi_wa (
    id INT AUTO_INCREMENT PRIMARY KEY,
    npm VARCHAR(20) NOT NULL,
    status_alert VARCHAR(50) NOT NULL,
    pesan TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_log_wa_mhs
      FOREIGN KEY (npm) REFERENCES mahasiswa(npm)
      ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =========================================================
-- SEED DATA 1: 16 FAKULTAS + SEKOLAH VOKASI UNPAD
-- =========================================================
INSERT INTO fakultas (kode, nama) VALUES
('FH', 'Hukum'),
('FEB', 'Ekonomi dan Bisnis'),
('FK', 'Kedokteran'),
('FMIPA', 'Matematika dan Ilmu Pengetahuan Alam'),
('FAPERTA', 'Pertanian'),
('FKG', 'Kedokteran Gigi'),
('FISIP', 'Ilmu Sosial dan Ilmu Politik'),
('FIB', 'Ilmu Budaya'),
('FPSI', 'Psikologi'),
('FAPET', 'Peternakan'),
('FIKOM', 'Ilmu Komunikasi'),
('FKEP', 'Keperawatan'),
('FPIK', 'Perikanan dan Ilmu Kelautan'),
('FTIP', 'Teknologi Industri Pertanian'),
('FF', 'Farmasi'),
('FTG', 'Teknik Geologi'),
('SV', 'Sekolah Vokasi');

-- =========================================================
-- SEED DATA 2: 73 PROGRAM STUDI (59 S1 + 14 D4) + SAMPLE COHORT
-- =========================================================
INSERT INTO program_studi (kode, nama, jenjang, kode_fakultas) VALUES
-- Sampel Dataset Spreadsheet Excel (Cohort & Perwalian)
('9901', 'Teknik Informatika (Sample Cohort Excel)', 'S1', 'FMIPA'),
-- 59 Program Studi Sarjana (S1)
('110110', 'Hukum', 'S1', 'FH'),
('120110', 'Akuntansi', 'S1', 'FEB'),
('120310', 'Manajemen', 'S1', 'FEB'),
('120410', 'Ekonomi Islam', 'S1', 'FEB'),
('120510', 'Bisnis Digital', 'S1', 'FEB'),
('120610', 'Ilmu Ekonomi', 'S1', 'FEB'),
('130110', 'Kedokteran', 'S1', 'FK'),
('130210', 'Kedokteran Hewan', 'S1', 'FK'),
('140110', 'Matematika', 'S1', 'FMIPA'),
('140210', 'Kimia', 'S1', 'FMIPA'),
('140310', 'Fisika', 'S1', 'FMIPA'),
('140410', 'Biologi', 'S1', 'FMIPA'),
('140610', 'Statistika', 'S1', 'FMIPA'),
('140710', 'Geofisika', 'S1', 'FMIPA'),
('140810', 'Teknik Informatika', 'S1', 'FMIPA'),
('140910', 'Teknik Elektro', 'S1', 'FMIPA'),
('141010', 'Ilmu Aktuaria', 'S1', 'FMIPA'),
('150510', 'Agroteknologi', 'S1', 'FAPERTA'),
('150610', 'Agribisnis', 'S1', 'FAPERTA'),
('160110', 'Kedokteran Gigi', 'S1', 'FKG'),
('170110', 'Administrasi Publik', 'S1', 'FISIP'),
('170210', 'Hubungan Internasional', 'S1', 'FISIP'),
('170310', 'Kesejahteraan Sosial', 'S1', 'FISIP'),
('170410', 'Ilmu Pemerintahan', 'S1', 'FISIP'),
('170510', 'Antropologi', 'S1', 'FISIP'),
('170610', 'Administrasi Bisnis', 'S1', 'FISIP'),
('170710', 'Sosiologi', 'S1', 'FISIP'),
('170810', 'Ilmu Politik', 'S1', 'FISIP'),
('170910', 'Administrasi Bisnis K. Pangandaran', 'S1', 'FISIP'),
('180110', 'Sastra Indonesia', 'S1', 'FIB'),
('180210', 'Sastra Sunda', 'S1', 'FIB'),
('180310', 'Ilmu Sejarah', 'S1', 'FIB'),
('180410', 'Sastra Inggris', 'S1', 'FIB'),
('180510', 'Sastra Perancis', 'S1', 'FIB'),
('180610', 'Sastra Jepang', 'S1', 'FIB'),
('180710', 'Sastra Rusia', 'S1', 'FIB'),
('180810', 'Sastra Jerman', 'S1', 'FIB'),
('180910', 'Sastra Arab', 'S1', 'FIB'),
('190110', 'Psikologi', 'S1', 'FPSI'),
('200110', 'Peternakan', 'S1', 'FAPET'),
('200610', 'Peternakan K. Pangandaran', 'S1', 'FAPET'),
('210110', 'Ilmu Komunikasi', 'S1', 'FIKOM'),
('210310', 'Hubungan Masyarakat', 'S1', 'FIKOM'),
('210410', 'Televisi dan Film', 'S1', 'FIKOM'),
('210510', 'Manajemen Komunikasi', 'S1', 'FIKOM'),
('210610', 'Jurnalistik', 'S1', 'FIKOM'),
('210710', 'Ilmu Komunikasi K. Pangandaran', 'S1', 'FIKOM'),
('210810', 'Perpustakaan dan Sains Informasi', 'S1', 'FIKOM'),
('220110', 'Keperawatan', 'S1', 'FKEP'),
('220210', 'Keperawatan K. Pangandaran', 'S1', 'FKEP'),
('230110', 'Perikanan', 'S1', 'FPIK'),
('230210', 'Ilmu Kelautan', 'S1', 'FPIK'),
('230410', 'Perikanan Laut Tropis', 'S1', 'FPIK'),
('240110', 'Teknik Pertanian', 'S1', 'FTIP'),
('240210', 'Teknologi Pangan', 'S1', 'FTIP'),
('240310', 'Teknologi Industri Pertanian', 'S1', 'FTIP'),
('260110', 'Farmasi', 'S1', 'FF'),
('260210', 'Rekayasa Kosmetik', 'S1', 'FF'),
('270110', 'Teknik Geologi', 'S1', 'FTG'),
-- 14 Program Studi Sarjana Terapan (D4 - Sekolah Vokasi)
('120104', 'Akuntansi Perpajakan', 'D4', 'SV'),
('120204', 'Akuntansi Sektor Publik', 'D4', 'SV'),
('120304', 'Bisnis Internasional', 'D4', 'SV'),
('120404', 'Pemasaran Digital', 'D4', 'SV'),
('130104', 'Kebidanan', 'D4', 'SV'),
('140104', 'Teknologi Industri Kimia', 'D4', 'SV'),
('150104', 'Agrotekno-preneur', 'D4', 'SV'),
('170104', 'Administrasi Keuangan Publik', 'D4', 'SV'),
('170204', 'Administrasi Pemerintahan', 'D4', 'SV'),
('170304', 'Bisnis Logistik', 'D4', 'SV'),
('170404', 'Kearsipan Digital', 'D4', 'SV'),
('180104', 'Bahasa dan Budaya Tiongkok', 'D4', 'SV'),
('210104', 'Manajemen Produksi Media', 'D4', 'SV'),
('230204', 'Pariwisata Bahari', 'D4', 'SV');

-- =========================================================
-- SEED DATA 3: AKUN LOGIN 4 ROLE (ADMIN, DEKAN, PRODI, DOSEN)
-- =========================================================
INSERT INTO users (id, username, password, nama_lengkap, role, kode_fakultas, kode_prodi) VALUES
(1, 'admin', 'admin123', 'Administrator DPSI Unpad', 'admin', NULL, NULL),
(2, 'dekan_fmipa', 'dekan123', 'Prof. Dr. Dekan FMIPA', 'dekan', 'FMIPA', NULL),
(3, 'prodi_ti', 'prodi123', 'Dr. Kaprodi Teknik Informatika', 'prodi', 'FMIPA', '140810'),
(4, 'dosen_wali1', 'dosen123', 'Dr. Budi Santoso, M.Si.', 'dosen', 'FMIPA', '140810');

-- =========================================================
-- SEED DATA 4: MATA KULIAH PERRANGKATAN
-- =========================================================
INSERT INTO mata_kuliah (kode, nama, sks, semester_rencana, kode_prodi, kode_prasyarat) VALUES
('IF101', 'Algoritma & Pemrograman', 3, 1, '140810', NULL),
('IF201', 'Struktur Data', 3, 2, '140810', 'IF101'),
('IF301', 'Pemrograman Berbasis Objek', 3, 3, '140810', 'IF201'),
('IF401', 'Basis Data Lanjut', 3, 4, '140810', 'IF301'),
('IF801', 'Skripsi / Tugas Akhir', 6, 8, '140810', 'IF401');

-- =========================================================
-- SEED DATA 5: 55 MAHASISWA (30 COHORT + 25 PERWALIAN UNIK)
-- =========================================================
INSERT INTO mahasiswa (npm, nama, angkatan, semester_aktif, sks_kumulatif, ipk, status_studi, semester_lulus, status_ta, progres_ta, tgl_pengajuan_judul, tgl_sidang_lulus, kategori_pemicu, kode_prodi, dosen_wali_id) VALUES
-- 30 Data Cohort (Angkatan 2021)
('149910210001', 'Agung Nugroho', 2021, 11, 136, 2.61, 'Aktif', NULL, 'Bimbingan', 0.60, '2026-05-04', NULL, NULL, '9901', NULL),
('149910210002', 'Bella Safira', 2021, NULL, 151, 3.12, 'Lulus', 10, 'Lulus', 1.00, '2025-08-09', '2026-07-01', NULL, '9901', NULL),
('149910210003', 'Candra Wijaya', 2021, NULL, 148, 3.65, 'Lulus', 8, 'Lulus', 1.00, '2024-11-15', '2025-06-08', NULL, '9901', NULL),
('149910210004', 'Dewi Anggraeni', 2021, NULL, 150, 3.06, 'Lulus', 8, 'Lulus', 1.00, '2024-08-18', '2025-04-21', NULL, '9901', NULL),
('149910210005', 'Eko Prabowo', 2021, 11, 146, 2.95, 'Aktif', NULL, 'Ujian Sidang', 0.85, '2026-02-16', NULL, NULL, '9901', NULL),
('149910210006', 'Fitri Handayani', 2021, 11, 128, 2.44, 'Aktif', NULL, 'SUR', 0.40, '2026-06-15', NULL, NULL, '9901', NULL),
('149910210007', 'Galih Permana', 2021, NULL, 147, 3.51, 'Lulus', 8, 'Lulus', 1.00, '2024-12-28', '2025-06-24', NULL, '9901', NULL),
('149910210008', 'Hana Pertiwi', 2021, NULL, 146, 3.29, 'Lulus', 9, 'Lulus', 1.00, '2025-04-22', '2025-11-09', NULL, '9901', NULL),
('149910210009', 'Irfan Hakim', 2021, NULL, 149, 2.77, 'Lulus', 8, 'Lulus', 1.00, '2024-08-08', '2025-05-10', NULL, '9901', NULL),
('149910210010', 'Jasmine Aulia', 2021, NULL, 148, 2.82, 'Lulus', 10, 'Lulus', 1.00, '2025-06-07', '2026-07-11', NULL, '9901', NULL),
('149910210011', 'Krisna Bayu', 2021, NULL, 147, 3.50, 'Lulus', 8, 'Lulus', 1.00, '2024-07-24', '2025-07-09', NULL, '9901', NULL),
('149910210012', 'Laras Ayu', 2021, 11, 118, 2.20, 'Aktif', NULL, 'Pengajuan Judul', 0.20, '2026-09-07', NULL, NULL, '9901', NULL),
('149910210013', 'Muhammad Fikri', 2021, NULL, 152, 2.75, 'Lulus', 7, 'Lulus', 1.00, '2024-04-18', '2024-11-21', NULL, '9901', NULL),
('149910210014', 'Nadia Rahma', 2021, NULL, 148, 2.05, 'Lulus', 7, 'Lulus', 1.00, '2024-05-25', '2024-11-18', NULL, '9901', NULL),
('149910210015', 'Oscar Mahendra', 2021, 11, 144, 3.12, 'Aktif', NULL, 'Ujian Sidang', 0.85, '2026-03-02', NULL, NULL, '9901', NULL),
('149910210016', 'Putri Ayunda', 2021, NULL, 145, 2.91, 'Lulus', 7, 'Lulus', 1.00, '2024-06-30', '2024-12-28', NULL, '9901', NULL),
('149910210017', 'Raka Dwi Putra', 2021, NULL, 150, 2.97, 'Lulus', 9, 'Lulus', 1.00, '2025-03-03', '2025-11-06', NULL, '9901', NULL),
('149910210018', 'Sekar Wangi', 2021, NULL, 149, 3.66, 'Lulus', 9, 'Lulus', 1.00, '2025-03-24', '2025-12-26', NULL, '9901', NULL),
('149910210019', 'Tegar Mulia', 2021, NULL, 151, 3.36, 'Lulus', 8, 'Lulus', 1.00, '2024-06-15', '2025-06-29', NULL, '9901', NULL),
('149910210020', 'Ulfa Rahmawati', 2021, NULL, 149, 3.37, 'Lulus', 8, 'Lulus', 1.00, '2024-11-06', '2025-06-08', NULL, '9901', NULL),
('149910210021', 'Vino Saputra', 2021, NULL, 148, 3.83, 'Lulus', 8, 'Lulus', 1.00, '2024-07-19', '2025-04-26', NULL, '9901', NULL),
('149910210022', 'Widya Ningrum', 2021, NULL, 148, 3.19, 'Lulus', 9, 'Lulus', 1.00, '2025-04-02', '2025-11-04', NULL, '9901', NULL),
('149910210023', 'Yusuf Kurniawan', 2021, 11, 140, 2.78, 'Aktif', NULL, 'Bimbingan', 0.60, '2026-04-06', NULL, NULL, '9901', NULL),
('149910210024', 'Zaki Mubarak', 2021, NULL, 149, 2.90, 'Lulus', 9, 'Lulus', 1.00, '2025-03-18', '2025-11-21', NULL, '9901', NULL),
('149910210025', 'Anisa Rahayu', 2021, NULL, 147, 3.75, 'Lulus', 10, 'Lulus', 1.00, '2025-08-12', '2026-06-10', NULL, '9901', NULL),
('149910210026', 'Bintang Pradipta', 2021, 11, 64, 1.90, 'Mengundurkan Diri', NULL, NULL, 0.00, NULL, NULL, NULL, '9901', NULL),
('149910210027', 'Cahya Kusuma', 2021, NULL, 145, 3.82, 'Lulus', 8, 'Lulus', 1.00, '2024-03-22', '2025-04-26', NULL, '9901', NULL),
('149910210028', 'Deni Setiawan', 2021, 11, 36, 2.40, 'Mengundurkan Diri', NULL, NULL, 0.00, NULL, NULL, NULL, '9901', NULL),
('149910210029', 'Elsa Fauziah', 2021, NULL, 144, 3.62, 'Lulus', 9, 'Lulus', 1.00, '2025-07-04', '2026-01-13', NULL, '9901', NULL),
('149910210030', 'Fajar Nugraha', 2021, 11, 138, 3.05, 'Aktif', NULL, 'Ujian Sidang', 0.85, '2026-01-12', NULL, NULL, '9901', NULL),
-- 25 Data Perwalian (NPM unik & terhubung ke dosen_wali_id = 4)
('149910250001', 'Adinda Prameswari', 2025, 3, 40, 3.52, 'Aktif', NULL, NULL, 0.00, NULL, NULL, NULL, '9901', 4),
('149910250002', 'Bagas Pratama', 2025, 3, 38, 3.10, 'Aktif', NULL, NULL, 0.00, NULL, NULL, NULL, '9901', 4),
('149910240003', 'Citra Lestari', 2024, 5, 82, 3.28, 'Aktif', NULL, NULL, 0.00, NULL, NULL, NULL, '9901', 4),
('149910240004', 'Dimas Anggara', 2024, 5, 78, 2.85, 'Aktif', NULL, NULL, 0.00, NULL, NULL, NULL, '9901', 4),
('149910230005', 'Eka Putri Maharani', 2023, 7, 128, 3.40, 'Aktif', NULL, 'SUR', 0.40, NULL, NULL, NULL, '9901', 4),
('149910230006', 'Farhan Ramadhan', 2023, 7, 118, 3.05, 'Aktif', NULL, 'Pengajuan Judul', 0.20, NULL, NULL, NULL, '9901', 4),
('149910230007', 'Gita Savitri Dewi', 2023, 7, 124, 2.90, 'Aktif', NULL, NULL, 0.00, NULL, NULL, NULL, '9901', 4),
('149910230008', 'Hafiz Maulana', 2023, 6, 105, 3.15, 'Aktif', NULL, NULL, 0.00, NULL, NULL, NULL, '9901', 4),
('149910220009', 'Intan Permatasari', 2022, 8, 136, 3.30, 'Aktif', NULL, 'Bimbingan', 0.60, NULL, NULL, NULL, '9901', 4),
('149910220010', 'Joko Santoso', 2022, 8, 130, 2.95, 'Aktif', NULL, 'Pengajuan Judul', 0.20, NULL, NULL, NULL, '9901', 4),
('149910220011', 'Kirana Anindya', 2022, 9, 140, 3.20, 'Aktif', NULL, 'Ujian Sidang', 0.80, NULL, NULL, 'Hambatan TA', '9901', 4),
('149910220012', 'Lukman Hakim', 2022, 9, 126, 2.88, 'Aktif', NULL, 'SUR', 0.40, NULL, NULL, 'MK Prasyarat', '9901', 4),
('149910220013', 'Maya Safitri', 2022, 9, 112, 2.70, 'Aktif', NULL, 'Pengajuan Judul', 0.20, NULL, NULL, NULL, '9901', 4),
('149910210034', 'Naufal Rizky', 2021, 11, 144, 3.35, 'Aktif', NULL, 'Ujian Sidang', 0.80, NULL, NULL, 'Hambatan TA', '9901', 4),
('149910210035', 'Oktaviani Putri', 2021, 11, 132, 2.60, 'Aktif', NULL, 'SUR', 0.40, NULL, NULL, 'MK Prasyarat', '9901', 4),
('149910210036', 'Panji Wicaksono', 2021, 10, 120, 2.45, 'Aktif', NULL, 'Pengajuan Judul', 0.20, NULL, NULL, NULL, '9901', 4),
('149910210037', 'Qonita Azzahra', 2021, 11, 96, 2.30, 'Aktif', NULL, NULL, 0.00, NULL, NULL, NULL, '9901', 4),
('149910200018', 'Rizal Firmansyah', 2020, 13, 138, 2.75, 'Aktif', NULL, 'Bimbingan', 0.60, NULL, NULL, 'Finansial/Pribadi', '9901', 4),
('149910200019', 'Salsabila Nur', 2020, 12, 110, 2.35, 'Aktif', NULL, 'Pengajuan Judul', 0.20, NULL, NULL, NULL, '9901', 4),
('149910200020', 'Teguh Prasetyo', 2020, 13, 60, 2.10, 'Aktif', NULL, NULL, 0.00, NULL, NULL, NULL, '9901', 4),
('149910190021', 'Umar Abdillah', 2019, 14, 50, 2.05, 'Aktif', NULL, NULL, 0.00, NULL, NULL, 'Stopout', '9901', 4),
('149910200022', 'Vina Melinda', 2020, 11, 90, 2.50, 'Cuti Resmi', NULL, NULL, 0.00, NULL, NULL, NULL, '9901', 4),
('149910210043', 'Wahyu Hidayat', 2021, NULL, 100, 2.80, 'Aktif', NULL, 'Pengajuan Judul', 0.20, NULL, NULL, NULL, '9901', 4),
('149910230024', 'Yoga Aditya', 2023, 7, 140, 3.60, 'Aktif', NULL, 'Ujian Sidang', 0.80, NULL, NULL, NULL, '9901', 4),
('149910240025', 'Zahra Kamila', 2024, 4, 60, 3.20, 'Aktif', NULL, NULL, 0.00, NULL, NULL, NULL, '9901', 4);

-- =========================================================
-- SEED DATA 6: 30 LOG PENGULANGAN MATA KULIAH (KHS)
-- =========================================================
INSERT INTO log_pengulangan_mk (npm, kode_mk, nama_mk, sks, semester_pengambilan, nilai_sebelumnya, nilai_ulang, is_prasyarat) VALUES
('149910230006', 'MK201', 'Kalkulus Lanjut', 3, 4, 'E', 'C', 1),
('149910220010', 'MK105', 'Aljabar Linear', 3, 3, 'D', 'B', 1),
('149910220010', 'MK210', 'Struktur Data', 4, 5, 'E', 'C', 1),
('149910220012', 'MK201', 'Kalkulus Lanjut', 3, 4, 'E', 'C', 1),
('149910220012', 'MK310', 'Basis Data', 3, 6, 'D', 'C', 0),
('149910220013', 'MK102', 'Pengantar Algoritma', 3, 2, 'E', 'C', 1),
('149910220013', 'MK212', 'Statistika', 3, 4, 'D', 'C', 0),
('149910220013', 'MK305', 'Sistem Operasi', 3, 6, 'E', 'D', 0),
('149910220013', 'MK305', 'Sistem Operasi', 3, 8, 'D', 'C', 0),
('149910210035', 'MK210', 'Struktur Data', 4, 5, 'E', 'C', 1),
('149910210035', 'MK320', 'Jaringan Komputer', 3, 7, 'D', 'B', 0),
('149910210037', 'MK105', 'Aljabar Linear', 3, 3, 'E', 'D', 1),
('149910210037', 'MK105', 'Aljabar Linear', 3, 5, 'D', 'C', 1),
('149910210037', 'MK212', 'Statistika', 3, 6, 'E', 'C', 0),
('149910210037', 'MK330', 'Rekayasa Perangkat Lunak', 3, 8, 'D', 'C', 0),
('149910200019', 'MK201', 'Kalkulus Lanjut', 3, 4, 'E', 'C', 1),
('149910200019', 'MK340', 'Kecerdasan Buatan', 3, 7, 'E', 'D', 0),
('149910200019', 'MK340', 'Kecerdasan Buatan', 3, 9, 'D', 'C', 0),
('149910200020', 'MK101', 'Kalkulus Dasar', 3, 2, 'E', 'D', 1),
('149910200020', 'MK101', 'Kalkulus Dasar', 3, 3, 'D', 'C', 1),
('149910200020', 'MK102', 'Pengantar Algoritma', 3, 3, 'E', 'C', 1),
('149910200020', 'MK210', 'Struktur Data', 4, 5, 'E', 'D', 1),
('149910200020', 'MK210', 'Struktur Data', 4, 7, 'D', 'C', 1),
('149910200020', 'MK212', 'Statistika', 3, 8, 'E', 'C', 0),
('149910200020', 'MK305', 'Sistem Operasi', 3, 9, 'E', 'D', 0),
('149910200020', 'MK305', 'Sistem Operasi', 3, 11, 'D', 'C', 0),
('149910190021', 'MK101', 'Kalkulus Dasar', 3, 4, 'E', 'C', 1),
('149910190021', 'MK210', 'Struktur Data', 4, 5, 'E', 'E', 1),
('149910190021', 'MK210', 'Struktur Data', 4, 7, 'E', 'D', 1),
('149910190021', 'MK210', 'Struktur Data', 4, 9, 'D', 'C', 1);

-- =========================================================
-- SEED DATA 7: SAMPLE LOG NOTIFIKASI WA
-- =========================================================
INSERT INTO log_notifikasi_wa (npm, status_alert, pesan) VALUES
('149910190021', 'Send WA Alert', '[Peringatan AEE Unpad] Yth. Dr. Budi Santoso, M.Si., mhs perwalian Anda Umar Abdillah / 149910190021 telah memasuki Semester 14 (Stopout). Mohon isi Form Klarifikasi Keterlambatan pada Dashboard AEE.');

SET FOREIGN_KEY_CHECKS = 1;