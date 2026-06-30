class RealtimeTraceLogger {
  constructor() {
    this.enabled = (typeof process !== 'undefined' && (process.env.DEBUG_REALTIME === 'true' || process.env.NODE_ENV === 'development')) || false;
    this.traces = new Map();
    this.maxTraces = 100;
  }

  generateTraceId() {
    return `trace_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  trace(traceId, stage, data = {}) {
    if (!this.enabled) return;
    const entry = { traceId, stage, timestamp: new Date().toISOString(), data };
    if (this.traces.size >= this.maxTraces) {
      const oldestKey = this.traces.keys().next().value;
      this.traces.delete(oldestKey);
    }
    this.traces.set(traceId, entry);
    const hash = (id) => typeof id === 'string' ? id.slice(0, 8) : id;
    console.log(`[TRACE] ${traceId} | ${stage} | ${JSON.stringify(data, (k, v) => (k.endsWith('Id') ? hash(v) : v))}`);
  }

  error(traceId, stage, err, data = {}) {
    if (!this.enabled) return;
    this.trace(traceId, `${stage}_ERROR`, { error: err.message || err, ...data });
  }

  getTrace(traceId) { return this.traces.get(traceId); }
  getAllTraces() { return Array.from(this.traces.values()); }
  clearTraces() { this.traces.clear(); }
}

export default new RealtimeTraceLogger();
