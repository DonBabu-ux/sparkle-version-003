const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log(' SPARKLE CAMPUS DIAGNOSTIC TEST');
console.log('===================================\n');

// Helper function to check file
function checkFile(filePath, description) {
    try {
        const resolved = path.resolve(filePath);
        const exists = fs.existsSync(resolved);
        const size = exists ? fs.statSync(resolved).size : 0;
        
        console.log(\\ \\);
        console.log(\   Path: \\);
        console.log(\   Resolved: \\);
        console.log(\   Exists: \\);
        if (exists) {
            console.log(\   Size: \ bytes\);
            
            // Try to require it
            try {
                delete require.cache[require.resolve(resolved)];
                const module = require(resolved);
                console.log(\   Can require: YES\);
                console.log(\   Exports type: \\);
                if (typeof module === 'object') {
                    console.log(\   Export keys: \\);
                }
                return true;
            } catch (reqErr) {
                console.log(\   Can require: NO - \\);
                return false;
            }
        }
        return false;
    } catch (err) {
        console.log(\ \ - ERROR: \\);
        return false;
    }
}

console.log('1. CHECKING CONTROLLER FILE');
console.log('---------------------------');
const controllerChecked = checkFile(
    './controllers/marketplace.controller.js',
    'Marketplace Controller'
);

console.log('\n2. CHECKING ROUTE FILES');
console.log('-----------------------');

// Check web routes
const webRoutesChecked = checkFile(
    './routes/web/marketplace.routes.js',
    'Web Marketplace Routes'
);

// Check API routes  
const apiRoutesChecked = checkFile(
    './routes/api/marketplace.routes.js',
    'API Marketplace Routes'
);

console.log('\n3. TESTING PATHS FROM DIFFERENT LOCATIONS');
console.log('------------------------------------------');

const testLocations = [
    { dir: '.', name: 'Project Root', path: './controllers/marketplace.controller' },
    { dir: 'routes/web', name: 'Web Routes', path: '../../controllers/marketplace.controller' },
    { dir: 'routes/api', name: 'API Routes', path: '../../controllers/marketplace.controller' }
];

for (const location of testLocations) {
    console.log(\\nTesting from \:\);
    
    // Save current directory
    const originalDir = process.cwd();
    
    try {
        // Change to test directory
        process.chdir(location.dir);
        
        console.log(\   Current dir: \\);
        console.log(\   Trying: require('\')\);
        
        const resolvedPath = path.resolve(location.path + '.js');
        console.log(\   Resolves to: \\);
        console.log(\   File exists: \\);
        
        try {
            delete require.cache[require.resolve(location.path)];
            const module = require(location.path);
            console.log(\    SUCCESS! Loaded \ exports\);
        } catch (err) {
            console.log(\    FAILED: \\);
            
            // Show more details for module not found
            if (err.code === 'MODULE_NOT_FOUND') {
                console.log(\   Looking in: \\);
                
                // Check what Node.js is actually looking for
                const Module = require('module');
                try {
                    const fakeParent = { filename: path.join(process.cwd(), 'test.js') };
                    const lookedUp = Module._resolveFilename(location.path, fakeParent, false);
                    console.log(\   Node resolves to: \\);
                } catch (lookupErr) {
                    console.log(\   Node lookup error: \\);
                }
            }
        }
        
    } catch (err) {
        console.log(\   Error changing dir: \\);
    } finally {
        // Restore original directory
        process.chdir(originalDir);
    }
}

console.log('\n4. CHECKING CONTROLLER SYNTAX');
console.log('----------------------------');

if (controllerChecked) {
    try {
        // Use node -c to check syntax
        const controllerPath = path.resolve('./controllers/marketplace.controller.js');
        execSync(\
ode -c "\"\, { stdio: 'pipe' });
        console.log(' Controller syntax is valid');
    } catch (err) {
        console.log(' Controller has syntax errors:');
        console.log(\   \\);
    }
    
    // Check last few lines of controller
    console.log('\n5. CONTROLLER EXPORTS ANALYSIS');
    console.log('------------------------------');
    
    const controllerContent = fs.readFileSync(
        path.resolve('./controllers/marketplace.controller.js'), 
        'utf8'
    );
    
    const lines = controllerContent.split('\n');
    console.log(\Total lines: \\);
    
    // Find module.exports
    let foundExports = false;
    for (let i = Math.max(0, lines.length - 30); i < lines.length; i++) {
        if (lines[i].includes('module.exports')) {
            foundExports = true;
            console.log(\Found exports at line \:\);
            
            // Show surrounding lines
            const start = Math.max(0, i - 3);
            const end = Math.min(lines.length - 1, i + 5);
            for (let j = start; j <= end; j++) {
                console.log(\   \: \\);
            }
            break;
        }
    }
    
    if (!foundExports) {
        console.log('  No module.exports found in last 30 lines');
        
        // Search entire file
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('module.exports') || lines[i].includes('exports.')) {
                console.log(\Found at line \: \\);
                foundExports = true;
            }
        }
        
        if (!foundExports) {
            console.log(' NO EXPORTS FOUND IN ENTIRE FILE!');
        }
    }
}

console.log('\n6. TESTING SERVER.JS REQUIRES');
console.log('-----------------------------');

try {
    const serverContent = fs.readFileSync(
        path.resolve('./server.js'),
        'utf8'
    );
    
    // Find all require statements
    const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
    let match;
    const requires = [];
    
    while ((match = requireRegex.exec(serverContent)) !== null) {
        requires.push(match[1]);
    }
    
    console.log(\Found \ require statements in server.js\);
    
    // Check critical ones
    const criticalRequires = [
        './routes/api',
        './routes/web',
        './controllers/groupChat.controller'
    ];
    
    for (const req of criticalRequires) {
        if (requires.includes(req)) {
            console.log(\ server.js requires: \\);
            
            // Try to load it
            try {
                delete require.cache[require.resolve(req)];
                require(req);
                console.log(\   Can load: YES\);
            } catch (err) {
                console.log(\   Can load: NO - \\);
            }
        } else {
            console.log(\  server.js does NOT require: \\);
        }
    }
} catch (err) {
    console.log(\Error reading server.js: \\);
}

console.log('\n7. QUICK FIX ATTEMPT');
console.log('--------------------');

if (!controllerChecked) {
    console.log('Creating minimal controller to test...');
    
    const minimalController = \
// Minimal marketplace controller for testing
const renderMarketplace = (req, res) => {
    res.send('Marketplace page - TEST');
};

const renderListingDetail = (req, res) => {
    res.send(\Listing \ - TEST\);
};

const getAllItems = (req, res) => {
    res.json({ message: 'Get all items - TEST', items: [] });
};

const createItem = (req, res) => {
    res.json({ message: 'Create item - TEST', id: 'test123' });
};

module.exports = {
    renderMarketplace,
    renderListingDetail,
    getAllItems,
    createItem,
    getItemById: (req, res) => res.json({ id: req.params.id }),
    updateItem: (req, res) => res.json({ updated: true }),
    deleteItem: (req, res) => res.json({ deleted: true }),
    searchItems: (req, res) => res.json({ results: [] }),
    getCategories: (req, res) => res.json({ categories: [] }),
    getCampuses: (req, res) => res.json({ campuses: [] }),
    getUserListings: (req, res) => res.json({ listings: [] }),
    saveListing: (req, res) => res.json({ saved: true }),
    unsaveListing: (req, res) => res.json({ unsaved: true }),
    getSavedListings: (req, res) => res.json({ saved: [] }),
    createChat: (req, res) => res.json({ chatId: 'chat123' }),
    getChatMessages: (req, res) => res.json({ messages: [] }),
    sendMessage: (req, res) => res.json({ sent: true }),
    getUserChats: (req, res) => res.json({ chats: [] }),
    getMarketplaceStats: (req, res) => res.json({ stats: {} }),
    updateListingStatus: (req, res) => res.json({ updated: true })
};
\;
    
    // Backup original if it exists
    const controllerPath = path.resolve('./controllers/marketplace.controller.js');
    if (fs.existsSync(controllerPath)) {
        fs.copyFileSync(controllerPath, controllerPath + '.backup');
        console.log('Backed up original controller');
    }
    
    fs.writeFileSync(controllerPath, minimalController);
    console.log('Created minimal controller');
    
    // Test it
    try {
        delete require.cache[require.resolve('./controllers/marketplace.controller')];
        const testController = require('./controllers/marketplace.controller');
        console.log(\ Minimal controller works! Exports: \\);
    } catch (err) {
        console.log(\ Minimal controller failed: \\);
    }
}

console.log('\n===================================');
console.log('DIAGNOSTIC COMPLETE');
console.log('===================================');

// Try to start server
console.log('\n FINAL TEST: Attempting to start server...');
console.log('(Press Ctrl+C after 5 seconds to stop)\n');

setTimeout(() => {
    try {
        require('./server.js');
    } catch (err) {
        console.log(\ Server failed to start: \\);
        console.log(\First line of stack: \\);
    }
}, 100);
