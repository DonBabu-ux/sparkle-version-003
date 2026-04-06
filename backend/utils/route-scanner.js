/**
 * Scans an Express application and returns a list of all registered routes.
 */
function scanRoutes(app) {
    const routes = [];

    function extractValidation(route) {
        const validation = {};
        if (route.stack) {
            route.stack.forEach(layer => {
                if (layer.handle) {
                    // console.log(`Checking layer for ${route.path}:`, layer.name); 
                    // Note: layer.name might be 'middleware' or 'bound dispatch'

                    if (layer.handle.schema) {
                        console.log(`[Scanner] Found schema for ${route.path}`);
                        const property = layer.handle.property || 'body';
                        try {
                            validation[property] = layer.handle.schema.describe();
                        } catch (e) {
                            console.error(`[Scanner] Error describing schema:`, e);
                        }
                    }
                }
            });
        }
        return validation;
    }

    function processLayer(layer, prefix = '') {
        if (layer.route) {
            // It's a direct route
            const path = (prefix + layer.route.path).replace(/\/+/g, '/');
            const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
            const validation = extractValidation(layer.route);
            routes.push({ path, methods, validation });
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
