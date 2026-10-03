class RealtimeTraceLogger {
  constructor() {
    // Enable tracing in development or when DEBUG_REALTIME=true
    this.enabled = process.env.NODE_ENV !== 'production' || process.env.DEBUG_REALTIME === 'true';
    this.traces = new Map(); // optional storage
    this.maxTraces = 100; // cap to avoid memory bloat
  }

  // Generate unique trace identifier
  generateTraceId() {
    return `trace_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  // Record a trace step
  trace(traceId, stage, data = {}) {
    if (!this.enabled) return;
    const now = Date.now();
    let traceObj = this.traces.get(traceId);
    if (!traceObj) {
      traceObj = { traceId, startMs: now, steps: [] };
      if (this.traces.size >= this.maxTraces) {
        const oldestKey = this.traces.keys().next().value;
        this.traces.delete(oldestKey);
      }
      this.traces.set(traceId, traceObj);
    }
    const deltaMs = now - traceObj.startMs;
    const entry = { stage, deltaMs, timestamp: new Date().toISOString(), data };
    traceObj.steps.push(entry);

    const hash = (id) => typeof id === 'string' ? id.slice(0, 8) : id;
    console.log(`[TRACE +${deltaMs}ms] ${traceId} | ${stage} | ${JSON.stringify(data, (k, v) => (k.endsWith('Id') ? hash(v) : v))}`);
  }

  error(traceId, stage, err, data = {}) {
    if (!this.enabled) return;
    this.trace(traceId, `${stage}_ERROR`, { error: err.message || err, ...data });
  }

  getTrace(traceId) { return this.traces.get(traceId); }
  getAllTraces() { return Array.from(this.traces.values()); }
  clearTraces() { this.traces.clear(); }
}

module.exports = new RealtimeTraceLogger();
