type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

function createEntry(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>
): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    const entry = createEntry("info", message, meta);
    if (process.env.NODE_ENV !== "test") {
      process.stdout.write(JSON.stringify(entry) + "\n");
    }
  },

  warn(message: string, meta?: Record<string, unknown>) {
    const entry = createEntry("warn", message, meta);
    if (process.env.NODE_ENV !== "test") {
      process.stdout.write(JSON.stringify(entry) + "\n");
    }
  },

  error(message: string, meta?: Record<string, unknown>) {
    const entry = createEntry("error", message, meta);
    if (process.env.NODE_ENV !== "test") {
      process.stderr.write(JSON.stringify(entry) + "\n");
    }
  },
};
