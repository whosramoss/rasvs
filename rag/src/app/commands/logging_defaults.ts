export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export const DEFAULT_LOG_LEVEL: LogLevel = "INFO";
export const DEFAULT_LOG_FORMAT = "%(asctime)s [%(levelname)s] %(message)s";

export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};
