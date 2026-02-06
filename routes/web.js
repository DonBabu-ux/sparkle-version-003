const express = require('express');
const router = express.Router();

// Import route files
const marketplaceRoutes = require('./web/marketplace.routes');
// const authRoutes = require('./web/auth.routes');
// const userRoutes = require('./web/user.routes');

// Home page
router.get('/', (req, res) => {
    res.render('index', { title: 'Home' });
});

// Web Routes
router.use('/', marketplaceRoutes);
// router.use('/auth', authRoutes);
// router.use('/user', userRoutes);

// 404 handler for web routes
router.use('*', (req, res) => {
    res.status(404).render('404', { title: 'Page Not Found' });
});

module.exports = router;
