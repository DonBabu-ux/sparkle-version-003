/**
 * PRODUCTION PATH RESOLVER
 * Use this utility for all require() statements to avoid path issues
 */

const path = require('path');

const rootDir = path.join(__dirname, '..', '..');

module.exports = {
    // Resolve paths relative to project root
    resolve: (relativePath) => {
        return path.join(rootDir, ...relativePath.split('/'));
    },
    
    // Require modules relative to project root
    require: (relativePath) => {
        const absolutePath = path.join(rootDir, ...relativePath.split('/'));
        return require(absolutePath);
    },
    
    // Get root directory
    root: rootDir
};
