export const DEFAULT_AUDIT_REDACTION_REPLACEMENT = "[REDACTED]";

export type AuditRedactionOptions = {
  additionalRawPayloadFieldNames?: readonly string[];
  replacement?: string;
};

type AuditRedactionMatcher = {
  configuredFieldNames: Set<string>;
  replacement: string;
};

const sensitiveFieldFragments = ["token", "password", "passwd", "secret"];

const sensitiveExactFieldNames = new Set([
  "authorization",
  "connectionstring",
  "databaseurl",
  "dburl",
  "dsn",
]);

const normalizeFieldName = (fieldName: string): string =>
  fieldName.toLowerCase().replace(/[^a-z0-9]/g, "");

const createMatcher = (
  options: AuditRedactionOptions = {},
): AuditRedactionMatcher => ({
  configuredFieldNames: new Set(
    (options.additionalRawPayloadFieldNames ?? []).map(normalizeFieldName),
  ),
  replacement: options.replacement ?? DEFAULT_AUDIT_REDACTION_REPLACEMENT,
});

const shouldRedactField = (
  fieldName: string,
  matcher: AuditRedactionMatcher,
): boolean => {
  const normalizedFieldName = normalizeFieldName(fieldName);

  return (
    matcher.configuredFieldNames.has(normalizedFieldName) ||
    sensitiveExactFieldNames.has(normalizedFieldName) ||
    sensitiveFieldFragments.some((fragment) =>
      normalizedFieldName.includes(fragment),
    )
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const redactValue = (value: unknown, matcher: AuditRedactionMatcher): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, matcher));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([fieldName, fieldValue]) => [
      fieldName,
      shouldRedactField(fieldName, matcher)
        ? matcher.replacement
        : redactValue(fieldValue, matcher),
    ]),
  );
};

export const redactSensitiveAuditFields = <Value>(
  value: Value,
  options: AuditRedactionOptions = {},
): Value => redactValue(value, createMatcher(options)) as Value;

