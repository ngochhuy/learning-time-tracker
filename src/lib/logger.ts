type LogContext = Record<string, unknown>;

const sensitiveKeys = /authorization|cookie|secret|token|password|database_url|direct_url/i;

function sanitize(context: LogContext) {
  return Object.fromEntries(Object.entries(context).map(([key, value]) => [
    key,
    sensitiveKeys.test(key) ? "[redacted]" : value instanceof Error ? value.name : value,
  ]));
}

/** Structured server logs without credentials, OAuth tokens, or cookies. */
export const logger = {
  error(event: string, context: LogContext = {}) {
    console.error(JSON.stringify({ level: "error", event, timestamp: new Date().toISOString(), ...sanitize(context) }));
  },
  info(event: string, context: LogContext = {}) {
    if (process.env.LOG_LEVEL === "debug" || process.env.NODE_ENV !== "production") {
      console.info(JSON.stringify({ level: "info", event, timestamp: new Date().toISOString(), ...sanitize(context) }));
    }
  },
};
