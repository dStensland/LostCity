type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  component?: string;
  [key: string]: unknown;
}

const isDev = process.env.NODE_ENV === "development";

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context?.component ? `[${context.component}]` : "";
  return `${timestamp} ${level.toUpperCase()} ${contextStr} ${message}`;
}

export const logger = {
  debug: (message: string, context?: LogContext) => {
    if (isDev) {
      console.log(formatMessage("debug", message, context), context);
    }
  },

  info: (message: string, context?: LogContext) => {
    if (isDev) {
      console.info(formatMessage("info", message, context), context);
    }
  },

  warn: (message: string, context?: LogContext) => {
    console.warn(formatMessage("warn", message, context), context);
  },

  error: (message: string, error?: Error | unknown, context?: LogContext) => {
    console.error(formatMessage("error", message, context), error, context);
    // In production, this could send to Sentry
    // if (!isDev && typeof Sentry !== 'undefined') {
    //   Sentry.captureException(error, { extra: context });
    // }
  },
};

// Shorthand for creating a logger with a fixed component context
export function createLogger(component: string) {
  return {
    debug: (message: string, context?: Omit<LogContext, "component">) =>
      logger.debug(message, { ...context, component }),
    info: (message: string, context?: Omit<LogContext, "component">) =>
      logger.info(message, { ...context, component }),
    warn: (message: string, context?: Omit<LogContext, "component">) =>
      logger.warn(message, { ...context, component }),
    error: (message: string, error?: Error | unknown, context?: Omit<LogContext, "component">) =>
      logger.error(message, error, { ...context, component }),
  };
}
