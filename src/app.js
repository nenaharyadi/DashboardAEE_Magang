
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./config/db');
const apiRoutes = require('./routes/apiRoutes');

const app = express();

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// STATIC FILES (LOCAL DEVELOPMENT)
// ==========================================

app.use(express.static(path.join(__dirname, '../public')));

// ==========================================
// HEALTH CHECK
// ==========================================

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');

    res.status(200).json({
      success: true,
      api: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Health Check Database Error:', error);

    res.status(503).json({
      success: false,
      api: 'ok',
      database: 'disconnected',
      message: 'Database connection failed',
      error: error.code || 'DATABASE_ERROR'
    });
  }
});

// ==========================================
// API ROUTES
// ==========================================

app.use('/api', apiRoutes);

// ==========================================
// 404 HANDLER
// ==========================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint tidak ditemukan',
    path: req.originalUrl
  });
});

// ==========================================
// ERROR HANDLER
// ==========================================

app.use((error, req, res, next) => {
  console.error('Server Error:', error);

  res.status(500).json({
    success: false,
    message: 'Terjadi kesalahan pada server'
  });
});

module.exports = app;
