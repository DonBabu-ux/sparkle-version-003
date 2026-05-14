
const express = require('express');
const app = express();
const path = require('path');

try {
    console.log('Testing routes initialization...');
    const apiRoutes = require('../routes/api/index.js');
    app.use('/api', apiRoutes);
    console.log('✅ Routes initialized successfully');
} catch (error) {
    console.error('❌ Routes initialization failed:');
    console.error(error);
}
