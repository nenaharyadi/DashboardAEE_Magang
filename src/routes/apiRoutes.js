const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const masterController = require('../controllers/masterController');
const aeeController = require('../controllers/aeeController');

// Auth Login Multi-Role
router.post('/login', authController.login);

// Master Data Unpad
router.get('/fakultas', masterController.getFakultas);
router.get('/prodi', masterController.getProdi);
router.get('/matakuliah/perrangkatan', masterController.getMataKuliahPerrangkatan);
router.get('/rekap-fakultas', masterController.getRekapFakultas);
router.get('/dosen-wali', masterController.getDosenWali);

// Analytics AEE & Form Klarifikasi Dosen Wali
router.get('/aee/analytics', aeeController.getAnalyticsAEE);
router.post('/mahasiswa/:npm/klarifikasi', aeeController.updateKlarifikasiDosenWali);

module.exports = router;