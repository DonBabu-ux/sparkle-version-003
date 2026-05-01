const geoip = require('geoip-lite');
const NodeGeocoder = require('node-geocoder');
const logger = require('../utils/logger');

// Configure geocoder (using OpenStreetMap/Nominatim as default free option)
const geocoder = NodeGeocoder({
    provider: 'openstreetmap'
});

const resolveLocation = async (req, res) => {
    try {
        const { lat, lon } = req.body;

        // 1. If coordinates provided (from GPS), reverse geocode
        if (lat && lon && !isNaN(lat) && !isNaN(lon)) {
            try {
                const results = await geocoder.reverse({ lat, lon });
                if (results && results.length > 0) {
                    const addr = results[0];
                    const name = [addr.city || addr.town || addr.village, addr.state || addr.county, addr.country]
                        .filter(Boolean)
                        .join(', ');
                    
                    return res.json({
                        success: true,
                        location: {
                            lat: parseFloat(lat),
                            lng: parseFloat(lon),
                            name: name || 'Custom Location',
                            source: 'gps'
                        }
                    });
                }
            } catch (geoError) {
                logger.warn('Reverse geocoding failed, returning raw coords:', geoError.message);
                return res.json({
                    success: true,
                    location: {
                        lat: parseFloat(lat),
                        lng: parseFloat(lon),
                        name: `${parseFloat(lat).toFixed(4)}, ${parseFloat(lon).toFixed(4)}`,
                        source: 'gps'
                    }
                });
            }
        }

        // 2. Fallback: IP-based resolution
        let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        
        // Handle local dev IPs
        if (ip === '::1' || ip === '127.0.0.1' || ip.includes('::ffff:127.0.0.1')) {
            // Default to a central Nairobi IP for testing if local
            ip = '197.232.0.0'; 
        }

        const geo = geoip.lookup(ip);

        if (geo) {
            return res.json({
                success: true,
                location: {
                    lat: geo.ll[0],
                    lng: geo.ll[1],
                    name: `${geo.city ? geo.city + ', ' : ''}${geo.region}, ${geo.country}`,
                    source: 'ip'
                }
            });
        }

        // 3. Final Fallback: Default to Nairobi
        res.json({
            success: true,
            location: {
                lat: -1.2921,
                lng: 36.8219,
                name: 'Nairobi, Kenya (Estimated)',
                source: 'default'
            }
        });

    } catch (error) {
        logger.error('Location resolution error:', error);
        res.status(500).json({ success: false, message: 'Failed to resolve location' });
    }
};

module.exports = {
    resolveLocation
};
