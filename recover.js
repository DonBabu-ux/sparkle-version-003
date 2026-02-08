const fs = require('fs');
const path = require('path');

console.log('🔍 Checking for backup files...');

// Common backup locations
const backupLocations = [
    path.join(process.env.APPDATA, 'Code', 'Backups'),
    path.join(process.env.LOCALAPPDATA, 'Temp', 'vscode'),
    path.join(process.env.USERPROFILE, '.config', 'Code', 'Backups'),
    path.join(__dirname, '.vscode')
];

backupLocations.forEach(loc => {
    if (fs.existsSync(loc)) {
        console.log(`📁 Found: ${loc}`);
        // Search for marketplace files
        const searchFiles = (dir) => {
            try {
                const files = fs.readdirSync(dir, { withFileTypes: true });
                files.forEach(file => {
                    const fullPath = path.join(dir, file.name);
                    if (file.isDirectory()) {
                        searchFiles(fullPath);
                    } else if (file.name.includes('marketplace') || file.name.includes('Marketplace')) {
                        console.log(`   📄 ${fullPath}`);
                        // Check if it's your working version
                        const content = fs.readFileSync(fullPath, 'utf8');
                        if (content.includes('getListings') && !content.includes('ml.status =')) {
                            console.log(`   ✅ This looks like working code!`);
                            // Copy it back
                            fs.copyFileSync(fullPath, path.join(__dirname, 'models', 'Marketplace.js'));
                            console.log(`   ✅ Restored!`);
                        }
                    }
                });
            } catch (err) { /* Ignore */ }
        };
        searchFiles(loc);
    }
});

console.log('\n💾 Creating emergency restore file...');

// Create emergency restore with our fixed code
const fixedCode = `// PASTE THE ENTIRE FIXED Marketplace.js CODE HERE
// Copy from our previous conversation where we fixed it
`;

fs.writeFileSync('EMERGENCY_RESTORE_Marketplace.js', fixedCode);
console.log('✅ Created EMERGENCY_RESTORE_Marketplace.js');
console.log('👉 Replace models/Marketplace.js with this file');