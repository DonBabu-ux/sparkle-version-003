// Central frontend logger. In dev it passes through to the console; in prod it
// keeps warnings/errors and drops log/info/debug noise.
const isDev = import.meta.env?.DEV !== false;

// A.4 #5: prod must never print raw Axios errors — `config.headers` carries
// `Authorization` / `x-refresh-token` and request URLs may embed OTPs in the
// query string. Reduce axios-like errors to a fixed set of safe fields.
const safeUrl = (url: unknown): string | undefined =>
  typeof url === 'string' ? url.split('?')[0] : undefined;

export const redactForLog = (arg: unknown): unknown => {
  if (!arg || typeof arg !== 'object') return arg;
  const a = arg as Record<string, unknown>;
  const nested = (a.config ?? {}) as Record<string, unknown>;
  const resp = (a.response ?? {}) as Record<string, unknown>;
  const isAxiosLike =
    a.isAxiosError === true ||
    (!!a.config && !!(a.request || a.response)) ||
    // bare axios-config object logged directly (url+method+headers at top level)
    (!!a.headers && typeof a.url === 'string' && typeof a.method === 'string');
  if (!isAxiosLike) return arg;
  const cfg = a.headers ? a : nested;
  return {
    name: a.name,
    message: a.message,
    code: a.code,
    status: resp.status,
    statusText: resp.statusText,
    method: cfg.method,
    url: safeUrl(cfg.url),
    stack: typeof a.stack === 'string' ? a.stack : undefined,
  };
};

const sanitize = (args: unknown[]): unknown[] => args.map(redactForLog);

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) console.debug(...args);
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info(...args);
  },
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  warn: (...args: unknown[]) => console.warn(...sanitize(args)),
  error: (...args: unknown[]) => console.error(...sanitize(args)),
};

export default logger;
