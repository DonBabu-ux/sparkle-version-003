console.log(' PRODUCTION READINESS TEST');
console.log('=============================');

// Test 1: Check critical modules
try {
    const requiredModules = [
        'express',
        'mongoose',
        'path',
        'fs',
        'cors',
        'dotenv'
    ];
    
    console.log('\n1. Testing core dependencies...');
    for (const mod of requiredModules) {
        try {
            require(mod);
            console.log(\    \\);
        } catch (e) {
            console.log(\    \ - MISSING: \\);
        }
    }
    
    // Test 2: Check critical project files
    console.log('\n2. Testing project structure...');
    const path = require('path');
    const fs = require('fs');
    
    const criticalFiles = [
        'controllers/marketplace.controller.js',
        'routes/web/marketplace.routes.js',
        'routes/api/marketplace.routes.js',
        'middleware/auth.middleware.js',
        'middleware/security.middleware.js',
        'models/Marketplace.js',
        'utils/logger.js'
    ];
    
    for (const file of criticalFiles) {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            console.log(\    \user.routes.js (\ bytes)\);
        } else {
            console.log(\    \user.routes.js - MISSING\);
        }
    }
    
    // Test 3: Try to load server
    console.log('\n3. Testing server initialization...');
    try {
        // Don't actually start the server, just test loading
        const serverModule = require('./server.js');
        console.log('    Server module loads without immediate errors');
    } catch (error) {
        console.log(\    Server load failed: \\);
        console.log(\   Stack: \\);
    }
    
    console.log('\n PRODUCTION TEST COMPLETE');
    console.log('=============================');
    
} catch (error) {
    console.error(' TEST FAILED:', error);
    process.exit(1);
}
