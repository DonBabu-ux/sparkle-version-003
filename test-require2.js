try {
    console.log('Testing corrected path...');
    process.chdir('routes/web');
    const path = require('path');
    const requirePath = '../../controllers/marketplace.controller';
    console.log('Requiring:', requirePath);
    
    try {
        const module = require(requirePath);
        console.log('SUCCESS: Module loaded');
        console.log('Exports:', Object.keys(module));
    } catch (err) {
        console.log('ERROR:', err.message);
        console.log('Looking for file at:', path.resolve(requirePath + '.js'));
        
        // Show what the actual path should be
        const actualPath = path.join(__dirname, '..', '..', 'controllers', 'marketplace.controller.js');
        console.log('Actual file should be at:', actualPath);
        const fs = require('fs');
        console.log('File exists?', fs.existsSync(actualPath));
    }
} catch (err) {
    console.log('Test error:', err.message);
}
