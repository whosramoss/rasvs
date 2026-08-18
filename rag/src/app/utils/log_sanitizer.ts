const SENSITIVE_KEY =
  /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api[-_]?key|token|password|passwd|secret|credential|access[-_]?token|refresh[-_]?token|openai-api-key|x-auth.*)$/i;

const SECRET_IN_STRING =
  /(?:Bearer\s+)[A-Za-z0-9._\-+=/]+|sk-(?:proj-)?[A-Za-z0-9_-]+/gi;

const ERROR_SAFE_FIELDS = new Set([
  "status",
  "statusCode",
  "code",
  "type",
  "requestID",
  "request_id",
]);

const ERROR_BLOCKED_FIELDS = new Set([
  "headers",
  "config",
  "request",
  "response",
  "cause",
]);

export function redactSecretsInString(value: string): string {
  return value.replace(SECRET_IN_STRING, "[REDACTED]");
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function redactValue(value: unknown, depth: number): unknown {
  if (depth > 4) {
    return "[Truncated]";
  }

  if (typeof value === "string") {
    return redactSecretsInString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1));
  }

  if (!isPlainRecord(value)) {
    return value;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key) || ERROR_BLOCKED_FIELDS.has(key)) {
      redacted[key] = "[REDACTED]";
      continue;
    }
    redacted[key] = redactValue(nested, depth + 1);
  }
  return redacted;
}

function formatSafeError(error: Error): string {
  const extras: Record<string, unknown> = {};

  for (const key of ERROR_SAFE_FIELDS) {
    if (key in error) {
      extras[key] = (error as unknown as Record<string, unknown>)[key];
    }
  }

  const extraText =
    Object.keys(extras).length > 0 ? ` ${JSON.stringify(redactValue(extras, 0))}` : "";

  return redactSecretsInString(`${error.name}: ${error.message}${extraText}`);
}

export function formatLogArgument(value: unknown): string {
  if (value instanceof Error) {
    return formatSafeError(value);
  }

  if (typeof value === "object" && value !== null) {
    try {
      return JSON.stringify(redactValue(value, 0));
    } catch {
      return "[Unserializable object]";
    }
  }

  return redactSecretsInString(String(value));
}
