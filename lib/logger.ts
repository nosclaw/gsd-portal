import { randomUUID } from "node:crypto";

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

interface LogContext {
  requestId?: string;
  userId?: string | number;
  operation?: string;
  resource?: string;
  [key: string]: unknown;
}

function formatEntry(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context
  };
  return JSON.stringify(entry);
}

export const logger = {
  debug(message: string, context?: LogContext) {
    if (process.env.LOG_LEVEL === "DEBUG") {
      console.debug(formatEntry("DEBUG", message, context));
    }
  },
  info(message: string, context?: LogContext) {
    console.log(formatEntry("INFO", message, context));
  },
  warn(message: string, context?: LogContext) {
    console.warn(formatEntry("WARN", message, context));
  },
  error(message: string, context?: LogContext) {
    console.error(formatEntry("ERROR", message, context));
  }
};

export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Extract requestId from request headers, or generate a new one.
 */
export function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") ?? generateRequestId();
}
