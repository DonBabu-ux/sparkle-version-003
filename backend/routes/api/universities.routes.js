'use strict';
/**
 * universities.routes.js
 * Public reference routes for the campus/university picker.
 * Mounted at /api/universities in backend/routes/api/index.js.
 * GET is intentionally unauthenticated so the signup flow can
 * populate the campus dropdown before the user logs in.
 */
const express = require('express');
const router = express.Router();
const universitiesController = require('../../controllers/universities.controller');

// GET /api/universities
router.get('/', universitiesController.getUniversities);

// GET /api/universities/countries
router.get('/countries', universitiesController.getCountries);

module.exports = router;
