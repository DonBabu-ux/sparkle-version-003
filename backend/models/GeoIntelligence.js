const db = require('../config/database');
const redis = require('../config/redis');
const crypto = require('crypto');

class GeoIntelligence {
    /**
     * Log a raw geo-event
     */
    static async logEvent(event) {
        const id = crypto.randomUUID();
        try {
            await db.query(`
                INSERT INTO geo_events (
                    id, user_id, event_type, category, region, sub_region, 
                    lat_bucket, lng_bucket, confidence_score
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id, event.user_id, event.event_type, event.category || 'all',
                event.region, event.sub_region,
                event.lat ? parseFloat(event.lat).toFixed(2) : null,
                event.lng ? parseFloat(event.lng).toFixed(2) : null,
                event.confidence || 1.0
            ]);

            // Real-time Hot Aggregation in Redis
            const date = new Date().toISOString().split('T')[0];
            const key = `geo:agg:${event.region}:${event.category || 'all'}:${date}`;
            await redis.hincrby(key, event.event_type, 1);
            await redis.expire(key, 86400 * 7); // 7 days TTL

            return id;
        } catch (error) {
            console.error('Geo Log Error:', error);
            return null;
        }
    }

    /**
     * Fetch demand score for a region/category
     */
    static async getDemandScore(region, category = 'all') {
        const date = new Date().toISOString().split('T')[0];
        const key = `geo:agg:${region}:${category}:${date}`;
        const data = await redis.hgetall(key);
        
        if (!data || Object.keys(data).length === 0) return 1.0;

        const searches = parseInt(data.search || '0');
        const views = parseInt(data.view || '0');
        const conversions = parseInt(data.purchase || data.offer || '0');

        // Simple Score = Searches + (Views * 0.5) + (Conversions * 5)
        return (searches + (views * 0.5) + (conversions * 5)) || 1.0;
    }

    /**
     * Fetch heatmap data for a metric
     */
    static async getHeatmap(metric = 'search', category = 'all') {
        // In a real system, we'd scan Redis or query SQL aggregates
        // For this implementation, we query SQL aggregates for the last 24h
        const [rows] = await db.query(`
            SELECT region, SUM(metric_value) as value
            FROM geo_aggregates
            WHERE metric_name = ? AND (category = ? OR category = 'all')
            AND bucket_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY region
        `, [metric, category]);
        return rows;
    }

    /**
     * Background Job: Sync Redis Hot Aggregates to SQL
     */
    static async syncAggregates() {
        // Implementation would iterate over Redis keys and UPSERT into geo_aggregates
    }
}

module.exports = GeoIntelligence;
