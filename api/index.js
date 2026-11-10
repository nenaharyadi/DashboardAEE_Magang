const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const apiRoutes = require('../src/routes/apiRoutes');
const app = express();

app.use(cors());
app.use(express.json());

// Serve Public Static Assets (Frontend Dashboard)
app.use(express.static(path.join(__dirname, '../public')));

// Mounting REST API Routes
app.use('/api', apiRoutes);

module.exports = app;

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`🚀 Server AEE Unpad berjalan di http://localhost:${PORT}`));
}