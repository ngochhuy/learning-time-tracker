import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export type TimestampValidationContext = {
  diagnosticId: string;
  operation: "start" | "pause" | "resume" | "finish";
  sessionKind: "timer" | "pomodoro";
};

type TimestampRejectionReason =
  | "invalid_format"
  | "non_canonical_iso"
  | "not_after_interval_start"
  | "not_after_previous_interval";

type ParsedTimestamp = {
  clickedAt: Date;
  deltaMs: number;
};

function baseLogContext(context: TimestampValidationContext, receivedAt: Date) {
  return {
    diagnosticId: context.diagnosticId,
    operation: context.operation,
    sessionKind: context.sessionKind,
    receivedAt: receivedAt.toISOString(),
  };
}

function logRejection(
  context: TimestampValidationContext | undefined,
  receivedAt: Date,
  reason: TimestampRejectionReason,
  details: Record<string, unknown>,
) {
  if (!context) return;
  logger.warn("timer_timestamp_validation", {
    ...baseLogContext(context, receivedAt),
    outcome: "rejected",
    reason,
    ...details,
  });
}

function logAcceptance(
  context: TimestampValidationContext | undefined,
  receivedAt: Date,
  parsed: ParsedTimestamp,
  details: Record<string, unknown> = {},
) {
  if (!context) return;
  logger.diagnostic("timer_timestamp_validation", {
    ...baseLogContext(context, receivedAt),
    outcome: "accepted",
    reason: "client_time_authoritative",
    clickedAt: parsed.clickedAt.toISOString(),
    deltaMs: parsed.deltaMs,
    ...details,
  });
}

function parseClientTimestamp(
  value: string,
  receivedAt: Date,
  context?: TimestampValidationContext,
): ParsedTimestamp {
  const clickedAt = new Date(value);
  if (!Number.isFinite(clickedAt.getTime())) {
    logRejection(context, receivedAt, "invalid_format", { clickedAt: null, deltaMs: null });
    throw new AppError("INVALID_TIME_RANGE");
  }

  const canonicalClickedAt = clickedAt.toISOString();
  const deltaMs = clickedAt.getTime() - receivedAt.getTime();
  if (canonicalClickedAt !== value) {
    logRejection(context, receivedAt, "non_canonical_iso", {
      clickedAt: canonicalClickedAt,
      deltaMs,
    });
    throw new AppError("INVALID_TIME_RANGE");
  }

  return { clickedAt, deltaMs };
}

function validateAfter(
  value: string,
  boundary: Date,
  receivedAt: Date,
  context: TimestampValidationContext | undefined,
  reason: TimestampRejectionReason,
  boundaryName: "intervalStartedAt" | "previousIntervalEndedAt",
) {
  const parsed = parseClientTimestamp(value, receivedAt, context);
  if (parsed.clickedAt.getTime() <= boundary.getTime()) {
    logRejection(context, receivedAt, reason, {
      clickedAt: parsed.clickedAt.toISOString(),
      deltaMs: parsed.deltaMs,
      [boundaryName]: boundary.toISOString(),
    });
    throw new AppError("INVALID_TIME_RANGE");
  }
  logAcceptance(context, receivedAt, parsed, { [boundaryName]: boundary.toISOString() });
  return parsed.clickedAt;
}

export function validateStartTimestamp(
  value: string,
  receivedAt: Date,
  context?: TimestampValidationContext,
): Date {
  const parsed = parseClientTimestamp(value, receivedAt, context);
  logAcceptance(context, receivedAt, parsed);
  return parsed.clickedAt;
}

export function validatePauseTimestamp(
  value: string,
  intervalStartedAt: Date,
  receivedAt: Date,
  context?: TimestampValidationContext,
): Date {
  return validateAfter(value, intervalStartedAt, receivedAt, context, "not_after_interval_start", "intervalStartedAt");
}

export function validateResumeTimestamp(
  value: string,
  previousIntervalEndedAt: Date,
  receivedAt: Date,
  context?: TimestampValidationContext,
): Date {
  return validateAfter(value, previousIntervalEndedAt, receivedAt, context, "not_after_previous_interval", "previousIntervalEndedAt");
}

export function validateFinishTimestamp(
  value: string,
  previousBoundary: Date,
  receivedAt: Date,
  context?: TimestampValidationContext,
  boundaryName: "intervalStartedAt" | "previousIntervalEndedAt" = "intervalStartedAt",
): Date {
  const reason = boundaryName === "previousIntervalEndedAt" ? "not_after_previous_interval" : "not_after_interval_start";
  return validateAfter(value, previousBoundary, receivedAt, context, reason, boundaryName);
}
