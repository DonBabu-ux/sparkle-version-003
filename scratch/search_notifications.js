const fs = require('fs');
const path = require('path');

function searchFiles(dir, query) {
    let files;
    try {
        files = fs.readdirSync(dir);
    } catch (e) {
        return; // skip unreadable directories
    }
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                if (file !== 'node_modules' && file !== '.git') {
                    searchFiles(fullPath, query);
                }
            } else if (file.endsWith('.js')) {
                const content = fs.readFileSync(fullPath, 'utf8');
                if (content.includes(query)) {
                    console.log(`Found in: ${fullPath}`);
                }
            }
        } catch (e) {
            // skip broken links or permission errors
        }
    }
}

console.log('Searching for NotificationService...');
searchFiles(process.cwd(), 'NotificationService');
console.log('Search complete.');
