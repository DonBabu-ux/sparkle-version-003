const redisConnection = require('../config/redis');
const logger = require('./logger');

class HealthControl {
    /**
     * Aggregates multiple system signals into a single health score [0-100]
     * 100 = Perfect, 0 = Catastrophic
     */
    static async getSystemHealth() {
        try {
            const signals = await Promise.all([
                this.getLatencySignal(),
                this.getQueueSignal(),
                this.getErrorRateSignal(),
                this.getResourceSignal()
            ]);

            const score = signals.reduce((acc, val) => acc + (val * 0.25), 0);
            return Math.floor(score);
        } catch (error) {
            logger.error('Health aggregation failed:', error);
            return 50; // Safety fallback
        }
    }

    static async getLatencySignal() {
        const p95 = parseInt(await redisConnection.get('mkt:p95:latency') || '100');
        if (p95 < 500) return 100;
        if (p95 < 2000) return 70;
        if (p95 < 5000) return 40;
        return 10;
    }

    static async getQueueSignal() {
        // Mocking queue depth signal for this context
        const depth = parseInt(await redisConnection.get('mkt:queue:depth') || '0');
        if (depth < 1000) return 100;
        if (depth < 5000) return 70;
        if (depth < 10000) return 30;
        return 0;
    }

    static async getErrorRateSignal() {
        const errors = parseInt(await redisConnection.get('mkt:error:count:5m') || '0');
        if (errors < 10) return 100;
        if (errors < 50) return 80;
        if (errors < 200) return 50;
        return 0;
    }

    static async getResourceSignal() {
        const mem = process.memoryUsage().heapUsed / process.memoryUsage().heapTotal;
        if (mem < 0.6) return 100;
        if (mem < 0.8) return 70;
        if (mem < 0.9) return 40;
        return 0;
    }

    static async getSheddingStatus() {
        const health = await this.getSystemHealth();
        if (health > 80) return 'NORMAL';
        if (health > 40) return 'DEGRADED';
        return 'CRITICAL';
    }
}

module.exports = HealthControl;
