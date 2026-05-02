const logger = require('../utils/logger');
const axios = require('axios');

/**
 * Resolve lat/lng or IP to a readable location name
 * Part of the Geo-Intelligence layer
 */
const resolveLocation = async (req, res) => {
    try {
        const { lat, lon } = req.body;
        let locationData = {
            lat: lat || -1.2833, // Default Nairobi
            lng: lon || 36.8167,
            name: 'Nairobi, Kenya',
            source: 'default'
        };

        // If coordinates provided, try reverse geocoding (Mock or Real)
        if (lat && lon) {
            // In a production app, we'd use Google Maps / OpenStreetMap here
            // For now, we'll return the coordinates and a formatted name
            locationData = {
                lat,
                lng: lon,
                name: `Location (${lat.toFixed(2)}, ${lon.toFixed(2)})`,
                source: 'gps'
            };
        } else {
            // Fallback: Detect by IP
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            try {
                // Mocking IP resolution for local development
                if (ip === '127.0.0.1' || ip === '::1') {
                    locationData.name = 'Localhost (Nairobi Mock)';
                    locationData.source = 'ip-mock';
                } else {
                    const geoResponse = await axios.get(`http://ip-api.com/json/${ip}?fields=status,message,country,city,lat,lon`);
                    if (geoResponse.data.status === 'success') {
                        locationData = {
                            lat: geoResponse.data.lat,
                            lng: geoResponse.data.lon,
                            name: `${geoResponse.data.city}, ${geoResponse.data.country}`,
                            source: 'ip'
                        };
                    }
                }
            } catch (err) {
                logger.warn('IP location resolution failed:', err.message);
            }
        }

        res.json({
            success: true,
            location: locationData
        });
    } catch (error) {
        logger.error('Location resolution error:', error);
        res.status(500).json({ success: false, message: 'Failed to resolve location' });
    }
};

module.exports = {
    resolveLocation
};
