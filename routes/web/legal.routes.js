const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Handle /legal and /legal/:documentId in Express backend
router.get(['/legal', '/legal/:documentId'], (req, res) => {
  // If Vite build frontend index.html exists, serve it for SPA routing
  const spaIndex = path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html');
  if (fs.existsSync(spaIndex)) {
    return res.sendFile(spaIndex);
  }
  // Otherwise render fallback EJS view
  res.render('index', { title: 'Legal & Policies - Sparkle' });
});

module.exports = router;
