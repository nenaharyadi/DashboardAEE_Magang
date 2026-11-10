const express = require('express');
const router = express.Router();

const masterController = require('../controllers/masterController');
const aeeController = require('../controllers/aeeController');

// Routes Data Master Unpad (MySQL)
router.get('/fakultas', masterController.getFakultas);
router.get('/prodi', masterController.getProdi);
router.get('/matakuliah/perrangkatan', masterController.getMataKuliahPerrangkatan);

// Routes Analytics 9 Rumus AEE (MySQL)
router.get('/aee/analytics', aeeController.getAnalyticsAEE);

module.exports = router;