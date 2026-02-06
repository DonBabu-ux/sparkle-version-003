/**
 * Scans an Express application and returns a list of all registered routes.
 */
function scanRoutes(app) {
    const routes = [];

    function processLayer(layer, prefix = '') {
        if (layer.route) {
            // It's a direct route
            const path = (prefix + layer.route.path).replace(/\/+/g, '/');
            const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
            routes.push({ path, methods });
        } else if (layer.name === 'router' && layer.handle.stack) {
            // It's a router (sub-middleware)
            let newPrefix = prefix;

            if (layer.regexp && layer.regexp.source !== '^\\/?$') {
                // Try to extract the path from the regex
                // Express regex for router.use('/path', ...) usually looks like ^\/path\/?(?=\/|$)
                let source = layer.regexp.source;
                let clean = source
                    .replace('^', '')
                    .replace('\\/?(?=\\/|$)', '')
                    .replace('\\/?$', '')
                    .replace('\\/', '/')
                    .replace(/\\\//g, '/');

                // If it's a complicated regex, it might have (?:...) or other things
                // We'll try to just take the literal part
                let match = clean.match(/^([a-zA-Z0-9\-\_\/]+)/);
                if (match) {
                    newPrefix = (prefix + '/' + match[1]).replace(/\/+/g, '/');
                }
            }

            layer.handle.stack.forEach(subLayer => {
                processLayer(subLayer, newPrefix);
            });
        }
    }

    if (app._router && app._router.stack) {
        app._router.stack.forEach(layer => {
            processLayer(layer);
        });
    }

    // Filter and normalize
    const uniqueRoutes = [];
    const seen = new Set();

    routes.forEach(r => {
        // Normalize trailing slash
        let cleanPath = r.path === '/' ? '/' : r.path.replace(/\/$/, '');
        const key = `${r.methods.join(',')}:${cleanPath}`;

        if (!seen.has(key) &&
            !cleanPath.includes('*') &&
            !cleanPath.includes('api-tester') &&
            !cleanPath.includes('debug/routes') &&
            cleanPath !== '') {
            uniqueRoutes.push({ ...r, path: cleanPath });
            seen.add(key);
        }
    });

    return uniqueRoutes.sort((a, b) => a.path.localeCompare(b.path));
}

module.exports = { scanRoutes };
