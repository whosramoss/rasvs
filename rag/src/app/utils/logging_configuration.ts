import {
  DEFAULT_LOG_FORMAT,
  DEFAULT_LOG_LEVEL,
  LOG_LEVEL_PRIORITY,
  type LogLevel,
} from "../commands/logging_defaults.js";
import { formatLogArgument, redactSecretsInString } from "./log_sanitizer.js";

class ApplicationLogging {
  private static instance: ApplicationLogging | null = null;
  private level: LogLevel = DEFAULT_LOG_LEVEL;
  private configured = false;

  private constructor() {}

  static getInstance(): ApplicationLogging {
    if (!ApplicationLogging.instance) {
      ApplicationLogging.instance = new ApplicationLogging();
    }
    return ApplicationLogging.instance;
  }

  configure(level?: LogLevel): void {
    if (this.configured) {
      if (level) {
        this.level = level;
      }
      return;
    }
    this.level = level ?? DEFAULT_LOG_LEVEL;
    this.configured = true;
  }

  private formatTimestamp(): string {
    return new Date().toISOString().replace("T", " ").substring(0, 19);
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level];
  }

  private formatMessage(level: LogLevel, message: string): string {
    return DEFAULT_LOG_FORMAT
      .replace("%(asctime)s", this.formatTimestamp())
      .replace("%(levelname)s", level)
      .replace("%(message)s", message);
  }

  log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) return;

    let argIndex = 0;
    let formattedMessage = message.replace(/%s|%d|%j/g, () => {
      const arg = args[argIndex++];
      if (arg === undefined) return "";
      return formatLogArgument(arg);
    });
    formattedMessage = redactSecretsInString(formattedMessage);

    const output = this.formatMessage(level, formattedMessage);

    switch (level) {
      case "ERROR":
        console.error(output);
        break;
      case "WARN":
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    this.log("DEBUG", message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log("INFO", message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log("WARN", message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log("ERROR", message, ...args);
  }
}

export const logger = ApplicationLogging.getInstance();

export function setupLogging(level?: LogLevel): void {
  logger.configure(level);
}
