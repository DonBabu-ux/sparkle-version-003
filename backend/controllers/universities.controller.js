'use strict';
/**
 * universities.controller.js
 * Public reference endpoint for the campus/university picker used in
 * profile settings and signup. Served from the `universities` table
 * (seeded by migration 20261124_universities) instead of hardcoded
 * arrays in the frontend.
 */
const pool = require('../config/database');

/**
 * Simple in-memory cache so repeated campus-picker opens don't hit the DB.
 * Universities change rarely; a 10-minute TTL is plenty.
 */
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

const getCached = (key) => {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
        cache.delete(key);
        return null;
    }
    return entry.data;
};
const setCached = (key, data) => cache.set(key, { ts: Date.now(), data });

/**
 * GET /api/universities
 * Query: ?country=  (exact, case-insensitive)
 *        ?q=        (substring match on name, case-insensitive)
 *        ?active=1  (default 1 — only active universities)
 */
exports.getUniversities = async (req, res) => {
    try {
        const country = (req.query.country || '').trim();
        const q = (req.query.q || '').trim();
        const activeOnly = req.query.active !== '0';

        const cacheKey = `universities:${country.toLowerCase()}:${q.toLowerCase()}:${activeOnly}`;
        const cached = getCached(cacheKey);
        if (cached) {
            return res.json({ status: 'success', count: cached.length, universities: cached, cached: true });
        }

        let sql = `SELECT id, name, country, state, city, is_active FROM universities WHERE 1=1`;
        const params = [];

        if (activeOnly) {
            sql += ` AND is_active = 1`;
        }
        if (country) {
            sql += ` AND country = ?`;
            params.push(country);
        }
        if (q) {
            sql += ` AND name LIKE ?`;
            params.push(`%${q}%`);
        }

        sql += ` ORDER BY country ASC, name ASC LIMIT 500`;

        const [rows] = await pool.query(sql, params);
        setCached(cacheKey, rows);

        return res.json({ status: 'success', count: rows.length, universities: rows, cached: false });
    } catch (err) {
        console.error('[UniversitiesController] error:', err);
        return res.status(500).json({ status: 'error', message: 'Failed to load universities' });
    }
};

/**
 * GET /api/universities/countries
 * Returns the distinct list of countries that have universities,
 * for building a country filter dropdown.
 */
exports.getCountries = async (req, res) => {
    try {
        const cacheKey = 'universities:countries';
        const cached = getCached(cacheKey);
        if (cached) {
            return res.json({ status: 'success', countries: cached, cached: true });
        }

        const [rows] = await pool.query(
            `SELECT DISTINCT country FROM universities WHERE is_active = 1 ORDER BY country ASC`
        );
        const countries = rows.map(r => r.country);
        setCached(cacheKey, countries);

        return res.json({ status: 'success', count: countries.length, countries });
    } catch (err) {
        console.error('[UniversitiesController] countries error:', err);
        return res.status(500).json({ status: 'error', message: 'Failed to load countries' });
    }
};
