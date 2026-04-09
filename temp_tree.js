kwconst fs = require('fs');
const path = require('path');

function generateTree(dir, prefix = '') {
    let output = '';
    const items = fs.readdirSync(dir).filter(item => item !== 'node_modules' && item !== '.git');

    items.forEach((item, index) => {
        const fullPath = path.join(dir, item);
        let isDir = false;
        try {
            isDir = fs.statSync(fullPath).isDirectory();
        } catch (e) { }

        const isItemLast = index === items.length - 1;

        output += `${prefix}${isItemLast ? '└── ' : '├── '}${item}\n`;

        if (isDir) {
            output += generateTree(fullPath, prefix + (isItemLast ? '    ' : '│   '));
        }
    });
    return output;
}

const frontendTree = "frontend/\n" + generateTree('frontend');
const backendTree = "backend/\n" + generateTree('backend');
fs.writeFileSync('pages.txt', frontendTree + "\n" + backendTree);
